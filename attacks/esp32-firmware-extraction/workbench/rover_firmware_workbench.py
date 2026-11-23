
from __future__ import annotations
import importlib.util, json, os, re, subprocess, sys, threading, queue, shutil, time
from pathlib import Path
import tkinter as tk
from tkinter import ttk, filedialog, messagebox

APP_TITLE = "ESP32 Rover Firmware Workbench"
APP_DIR = Path(__file__).resolve().parent
REQUIREMENTS_FILE = APP_DIR / "requirements.txt"
CONFIG_FILE = APP_DIR / "config.json"
# Module name -> package name as written in requirements.txt
DEPENDENCIES = {"esptool": "esptool", "serial": "pyserial"}
DEFAULT_PARTITIONS = [
    {"name":"nvs", "offset":"0x9000", "size":"0x5000"},
    {"name":"otadata", "offset":"0xE000", "size":"0x2000"},
    {"name":"app0", "offset":"0x10000", "size":"0x140000"},
    {"name":"app1", "offset":"0x150000", "size":"0x140000"},
    {"name":"spiffs", "offset":"0x290000", "size":"0x160000"},
    {"name":"coredump", "offset":"0x3F0000", "size":"0x10000"},
]
SECRET_RE = re.compile(
    r"(password|passwd|token|secret|credential|username|user(name)?|"
    r"authorization|private.?key|ssid|pmk|api.?key)", re.I
)
HOST_RE = re.compile(r"\b(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}\b")
IP_RE = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
URL_RE = re.compile(r"(?:mqtts?|tcp|ssl)://[^\s\"']+", re.I)
FLASH_PROGRESS_RE = re.compile(r"Reading (?:from|flash)\b.*?(\d{1,3}(?:\.\d+)?)\s*%", re.I)
PRINTABLE_RE = re.compile(rb"[\x20-\x7e]{4,}")
PATH_RE = re.compile(r"(?:^|@)(?:[A-Za-z]:/|/IDF/|IDF/)|^[A-Za-z0-9_.-]+\.(?:c|cc|cpp|h|hpp)$")
CANDIDATE_RE = re.compile(
    r"mqtt|broker|endpoint|topic|telemetry|availability|command|lwt|wifi|ssid|"
    r"password|passwd|token|secret|credential|api.?key|hivemq|"
    r"ble|gatt|uuid|characteristic|nimble|firmware|version|partiti", re.I)
MAX_RESULTS = 5000

def run_cmd(args, cwd=None, timeout=600):
    p = subprocess.run(args, cwd=cwd, capture_output=True, text=True,
                       errors="replace", timeout=timeout)
    if p.returncode:
        raise RuntimeError((p.stdout + "\n" + p.stderr).strip() or
                           f"Command failed: {args[0]} (exit {p.returncode})")
    return p.stdout + p.stderr

def run_cmd_stream(args, emit, cwd=None, timeout=None, filter_line=None):
    """Run a command and forward output lines to emit() as they arrive.

    filter_line(line) may return False to keep a line out of the log (used for
    very chatty progress-bar lines). Raises on a non-zero exit or a timeout.
    """
    p = subprocess.Popen(args, cwd=cwd, stdout=subprocess.PIPE,
                         stderr=subprocess.STDOUT, text=True,
                         errors="replace", bufsize=1)
    lines = queue.Queue()

    def reader():
        try:
            for line in p.stdout:
                lines.put(line)
        finally:
            lines.put(None)
    threading.Thread(target=reader,daemon=True).start()

    captured = []
    deadline = time.monotonic()+timeout if timeout else None
    while True:
        if deadline is None:
            item = lines.get()
        else:
            remaining = deadline-time.monotonic()
            if remaining <= 0:
                p.kill()
                raise RuntimeError(f"Timed out after {timeout}s: {' '.join(args)}")
            try:
                item = lines.get(timeout=remaining)
            except queue.Empty:
                p.kill()
                raise RuntimeError(f"Timed out after {timeout}s: {' '.join(args)}")
        if item is None: break
        line = item.rstrip()
        if not line: continue
        if filter_line is not None and not filter_line(line): continue
        captured.append(line)
        emit(line)
    code = p.wait()
    if code:
        tail = "\n".join(captured[-25:])
        raise RuntimeError(tail or f"Command failed: {args[0]} (exit {code})")
    return "\n".join(captured)

class Workbench(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title(APP_TITLE)
        self.geometry("1040x820")
        self.minsize(850,640)
        self.q = queue.Queue()
        # ---- visual theme ---------------------------------------------------
        try:
            ttk.Style(self).theme_use("clam")
        except tk.TclError:
            pass
        st = ttk.Style(self)
        st.configure(".", font=("Segoe UI", 10))
        st.configure("TFrame", background="#f5f6f8")
        st.configure("TLabel", background="#f5f6f8", foreground="#1f2937")
        st.configure("TButton", padding=(10, 4))
        st.configure("TLabelframe", background="#ffffff", borderwidth=1, relief="solid")
        st.configure("TLabelframe.Label", background="#ffffff", font=("Segoe UI", 10, "bold"),
                    foreground="#374151")
        st.configure("Header.TLabel", font=("Segoe UI", 12, "bold"), foreground="#111827")
        st.configure("Muted.TLabel", foreground="#6b7280", font=("Segoe UI", 9))
        st.configure("Danger.TLabel", foreground="#b91c1c", font=("Segoe UI", 9))
        st.configure("TEntry", padding=4)
        st.configure("TCombobox", padding=4)
        st.configure("Horizontal.TProgressbar", thickness=6)
        self.configure(background="#f5f6f8")
        self.project = tk.StringVar(value=str(Path.cwd() / "rover_case"))
        self.evidence = tk.StringVar(value="evidence/esp32_full_flash.bin")
        self.port = tk.StringVar()
        self.baud = tk.StringVar(value="460800")
        self.flash_size = tk.StringVar(value="0x400000")
        self.esptool = tk.StringVar(value="esptool")
        self.nvs_tool = tk.StringVar()
        self.image_parser = tk.StringVar()
        self.parser_args = tk.StringVar(value="")  # Set after checking parser --help
        self.include_paths = tk.BooleanVar(value=False)
        self.nvs_mode = tk.StringVar(value="all")
        self.search_var = tk.StringVar()
        self.scope_var = tk.StringVar(value="All extracted partitions")
        self.regex_var = tk.BooleanVar(value=False)
        self.filter_var = tk.StringVar()
        self.result_summary = tk.StringVar(value="No results yet.")
        self._summary_text = "No results yet."
        self.inspect_offset = tk.StringVar(value="0x2000")
        self.inspect_size = tk.StringVar(value="0x200")
        self.inspect_source = tk.StringVar(value="app0.bin")
        self.results = []
        self.dep_status = tk.StringVar(value="Checking…")
        self._installing = False
        self.load_config()
        self._build()
        self.protocol("WM_DELETE_WINDOW",self.on_close)
        self.refresh_dependency_status()
        self.refresh_sources()
        self.refresh_ports()
        self.after(100, self._poll)

    def _build(self):
        # ---- menu bar -------------------------------------------------------
        menubar = tk.Menu(self, tearoff=0)
        filem = tk.Menu(menubar, tearoff=0)
        filem.add_command(label="Save settings", command=self.save_settings, accelerator="Ctrl+S")
        filem.add_command(label="Open reports folder", command=self.open_reports)
        filem.add_separator()
        filem.add_command(label="Exit", command=self.on_close)
        menubar.add_cascade(label="File", menu=filem)
        toolsm = tk.Menu(menubar, tearoff=0)
        toolsm.add_command(label="Refresh ports", command=self.refresh_ports, accelerator="F5")
        toolsm.add_command(label="Install dependencies", command=self.install_dependencies)
        toolsm.add_separator()
        toolsm.add_command(label="Save settings", command=self.save_settings)
        menubar.add_cascade(label="Tools", menu=toolsm)
        helpm = tk.Menu(menubar, tearoff=0)
        helpm.add_command(label="User guide", command=self.show_guide, accelerator="F1")
        helpm.add_command(label="About", command=self.show_about)
        menubar.add_cascade(label="Help", menu=helpm)
        self.config(menu=menubar)
        self.bind("<Control-s>", lambda e: self.save_settings())
        self.bind("<F5>", lambda e: self.refresh_ports())
        self.bind("<F1>", lambda e: self.show_guide())

        top = ttk.LabelFrame(self, text="Project", padding=10)
        top.pack(fill="x", padx=10, pady=(8, 4))
        ttk.Label(top, text="Case directory (evidence root)").grid(row=0, column=0, sticky="w")
        ttk.Entry(top, textvariable=self.project, width=62).grid(row=0, column=1, sticky="ew", padx=6)
        ttk.Button(top, text="Browse…", command=self.pick_project).grid(row=0, column=2)
        ttk.Label(top, text="Flash dump file").grid(row=1, column=0, sticky="w", pady=(6, 0))
        ttk.Entry(top, textvariable=self.evidence, width=62).grid(row=1, column=1, sticky="ew", padx=6, pady=(6, 0))
        ttk.Button(top, text="Browse…", command=self.pick_evidence).grid(row=1, column=2, pady=(6, 0))
        top.columnconfigure(1, weight=1)

        deps = ttk.Frame(self, padding=(10,0,10,4)); deps.pack(fill="x")
        ttk.Label(deps,text="Dependencies:").pack(side="left")
        self.dep_label = ttk.Label(deps,textvariable=self.dep_status)
        self.dep_label.pack(side="left",padx=6)
        self.install_btn = ttk.Button(deps,text="Install dependencies",
                                      command=self.install_dependencies)
        self.install_btn.pack(side="right")
        ttk.Button(deps,text="Save settings",command=self.save_settings).pack(side="right",padx=6)

        paned = ttk.Panedwindow(self, orient="vertical")
        paned.pack(fill="both",expand=True,padx=10,pady=5)

        nb = ttk.Notebook(paned)
        paned.add(nb,weight=3)
        self.nb = nb
        device = ttk.Frame(nb,padding=12); nb.add(device,text="1 · Device & flash")
        tools = ttk.Frame(nb,padding=12); nb.add(tools,text="2 · Tools")
        analysis = ttk.Frame(nb,padding=12); nb.add(analysis,text="3 · Analyze")
        guide = ttk.Frame(nb,padding=8); nb.add(guide,text="4 · Guide")
        self.guide_tab = guide
        self._build_guide_tab(guide)

        ttk.Label(device,text="Serial port").grid(row=0,column=0,sticky="w")
        self.port_box=ttk.Combobox(device,textvariable=self.port,width=22,state="readonly")
        self.port_box.grid(row=0,column=1,sticky="w",padx=6)
        ttk.Button(device,text="Refresh ports",command=self.refresh_ports).grid(row=0,column=2,padx=4)
        ttk.Label(device,text="Baud").grid(row=1,column=0,sticky="w",pady=8)
        ttk.Entry(device,textvariable=self.baud,width=14).grid(row=1,column=1,sticky="w",padx=6)
        ttk.Label(device,text="Flash size").grid(row=2,column=0,sticky="w")
        ttk.Entry(device,textvariable=self.flash_size,width=14).grid(row=2,column=1,sticky="w",padx=6)
        ttk.Label(device,text="esptool executable/module").grid(row=3,column=0,sticky="w",pady=8)
        ttk.Entry(device,textvariable=self.esptool,width=42).grid(row=3,column=1,columnspan=2,sticky="w",padx=6)
        row=4
        ttk.Button(device,text="Check ESP32 / flash ID",command=self.check_device).grid(row=row,column=0,columnspan=2,sticky="ew",pady=6)
        ttk.Button(device,text="Read full flash",command=self.read_flash).grid(row=row,column=2,sticky="ew",pady=6)
        ttk.Label(device,text="Read operation is non-destructive. Do not erase or write flash from this tool.",
                  foreground="#276749").grid(row=5,column=0,columnspan=3,sticky="w",pady=12)
        ttk.Label(device,text="Expected current board: ESP32, 4 MiB flash. Change flash size if your hardware differs.",
                  wraplength=700).grid(row=6,column=0,columnspan=3,sticky="w")
        device.columnconfigure(2,weight=1)

        fields = [
            ("NVS decoder script",self.nvs_tool),
            ("ESP32 image parser script",self.image_parser),
            ("Parser arguments (use {input} and {output})",self.parser_args),
        ]
        for i,(label,var) in enumerate(fields):
            ttk.Label(tools,text=label).grid(row=i,column=0,sticky="w",pady=8)
            ttk.Entry(tools,textvariable=var,width=90).grid(row=i,column=1,sticky="ew",padx=6)
            if i<2:
                ttk.Button(tools,text="Browse",command=lambda v=var:self.pick_script(v)).grid(row=i,column=2)
        ttk.Label(tools,text="Parser arguments are intentionally not guessed. Run the parser's --help first, then enter its verified CLI arguments.",
                  wraplength=850).grid(row=3,column=0,columnspan=3,sticky="w",pady=12)
        tools.columnconfigure(1,weight=1)

        ana_row = ttk.Frame(analysis); ana_row.pack(fill="x")
        for txt,cmd in (
            ("Extract known partitions",self.extract_partitions),
            ("Scan app strings",self.scan_strings),
            ("Decode NVS",self.decode_nvs),
            ("Reconstruct ELF",self.reconstruct_elf),
            ("Open reports folder",self.open_reports),
        ):
            ttk.Button(ana_row,text=txt,command=cmd).pack(side="left",padx=(0,6))
        ttk.Checkbutton(ana_row,text="include paths",variable=self.include_paths).pack(side="left",padx=6)

        nvs_row = ttk.Frame(analysis); nvs_row.pack(fill="x",pady=(4,2))
        ttk.Label(nvs_row,text="NVS dump mode").pack(side="left")
        ttk.Combobox(nvs_row,textvariable=self.nvs_mode,width=14,state="readonly",
                     values=("all","written","minimal","blobs","namespaces","storage_info","none")).pack(side="left",padx=6)
        ttk.Label(nvs_row,text="(use 'all' or 'blobs' to recover erased SSID/password values)",foreground="#4a5568").pack(side="left",padx=6)

        find_row = ttk.Frame(analysis); find_row.pack(fill="x",pady=(8,3))
        ttk.Label(find_row,text="Search").pack(side="left")
        ttk.Entry(find_row,textvariable=self.search_var,width=26).pack(side="left",padx=6)
        self.scope_box=ttk.Combobox(find_row,textvariable=self.scope_var,width=21,state="readonly",
                                    values=("All extracted partitions","app0.bin","nvs.bin","spiffs.bin"))
        self.scope_box.pack(side="left")
        ttk.Checkbutton(find_row,text="regex",variable=self.regex_var).pack(side="left",padx=6)
        ttk.Button(find_row,text="Search",command=self.search_strings).pack(side="left")
        ttk.Button(find_row,text="Clear results",command=self.clear_results).pack(side="left",padx=6)

        region_row = ttk.Frame(analysis); region_row.pack(fill="x",pady=(0,3))
        ttk.Label(region_row,text="Inspect region").pack(side="left")
        ttk.Label(region_row,text="offset").pack(side="left",padx=(10,2))
        ttk.Entry(region_row,textvariable=self.inspect_offset,width=10).pack(side="left")
        ttk.Label(region_row,text="size").pack(side="left",padx=(8,2))
        ttk.Entry(region_row,textvariable=self.inspect_size,width=8).pack(side="left")
        self.inspect_box=ttk.Combobox(region_row,textvariable=self.inspect_source,width=20,state="readonly")
        self.inspect_box.pack(side="left",padx=6)
        ttk.Button(region_row,text="Inspect",command=self.inspect_region).pack(side="left")

        filt_row = ttk.Frame(analysis); filt_row.pack(fill="x",pady=(4,2))
        ttk.Label(filt_row,text="Filter results").pack(side="left")
        ttk.Entry(filt_row,textvariable=self.filter_var,width=30).pack(side="left",padx=6)
        self.filter_var.trace_add("write",lambda *a:self._render_results())
        ttk.Label(analysis,textvariable=self.result_summary,foreground="#4a5568",
                  wraplength=940).pack(anchor="w")

        split = ttk.Panedwindow(analysis,orient="vertical")
        split.pack(fill="both",expand=True,pady=(4,0))
        treef = ttk.Frame(split); split.add(treef,weight=3)
        cols=("offset","source","category","text")
        self.tree=ttk.Treeview(treef,columns=cols,show="headings",height=11)
        for c,w in (("offset",90),("source",85),("category",95),("text",560)):
            self.tree.heading(c,text=c.title())
            self.tree.column(c,width=w,anchor="w",stretch=(c=="text"))
        treesb=ttk.Scrollbar(treef,orient="vertical",command=self.tree.yview)
        self.tree.configure(yscrollcommand=treesb.set)
        self.tree.pack(side="left",fill="both",expand=True)
        treesb.pack(side="right",fill="y")
        self.tree.bind("<<TreeviewSelect>>",self._on_result_select)
        self.tree.bind("<Double-1>",self._copy_selected_offset)

        ctxf = ttk.Frame(split); split.add(ctxf,weight=2)
        ttk.Label(ctxf,text="Context around selection (±0x80 bytes, redacted)").pack(anchor="w")
        self.context=tk.Text(ctxf,height=7,wrap="char",relief="solid",borderwidth=1)
        self.context.pack(fill="both",expand=True)
        self.context.configure(state="disabled")

        ttk.Label(analysis,text="No redaction: reports and the results table contain the raw strings from the firmware. "
                                "Keep the case folder private — firmware dumps may contain Wi-Fi and broker credentials. "
                                "Double-click a row to copy its offset; select a row to see nearby strings.",
                  foreground="#b91c1c",wraplength=940).pack(anchor="w")

        logf = ttk.Frame(paned,padding=(0,4,0,0))
        paned.add(logf,weight=1)
        loghead = ttk.Frame(logf); loghead.pack(fill="x")
        ttk.Label(loghead,text="Log",font=("",9,"bold")).pack(side="left")
        ttk.Button(loghead,text="Clear",width=7,command=self.clear_log).pack(side="right")
        ttk.Button(loghead,text="Copy all",width=9,command=self.copy_log).pack(side="right",padx=4)
        logbody = ttk.Frame(logf); logbody.pack(fill="both",expand=True)
        self.log= tk.Text(logbody,wrap="word",height=8,relief="solid",borderwidth=1)
        self.log_scroll=ttk.Scrollbar(logbody,orient="vertical",command=self.log.yview)
        self.log.configure(yscrollcommand=self.log_scroll.set,state="disabled")
        self.log.pack(side="left",fill="both",expand=True)
        self.log_scroll.pack(side="right",fill="y")

        self.status=tk.StringVar(value="Ready")
        bar = ttk.Frame(self); bar.pack(fill="x",side="bottom")
        ttk.Label(bar,textvariable=self.status,relief="sunken",anchor="w",
                  padding=(6,3)).pack(side="left",fill="x",expand=True)
        self.progress_label=ttk.Label(bar,text="",relief="sunken",anchor="e",padding=(6,3),width=24)
        self.progress_bar=ttk.Progressbar(bar,orient="horizontal",length=200,
                                          mode="determinate",maximum=100,value=0)

    def progress(self,mode="determinate",value=0,text=""):
        """Queue a progress-bar update (safe to call from worker threads)."""
        self.q.put(("progress",(mode,float(value),text)))

    def _apply_progress(self,mode,value,text):
        if not self.progress_bar.winfo_ismapped():
            self.progress_bar.pack(side="right",padx=(0,6))
            self.progress_label.pack(side="right",padx=4)
        self.progress_label.configure(text=text)
        if mode=="indeterminate":
            if str(self.progress_bar.cget("mode"))!="indeterminate":
                self.progress_bar.configure(mode="indeterminate")
                self.progress_bar.start(15)
            return
        self.progress_bar.stop()
        self.progress_bar.configure(mode="determinate",maximum=100,value=value)

    def _hide_progress(self):
        if self.progress_bar.winfo_ismapped():
            self.progress_bar.stop()
            self.progress_bar.pack_forget()
            self.progress_label.pack_forget()
        self.progress_label.configure(text="")

    def clear_log(self):
        self.log.configure(state="normal")
        self.log.delete("1.0","end")
        self.log.configure(state="disabled")

    def copy_log(self):
        text=self.log.get("1.0","end").strip()
        self.clipboard_clear(); self.clipboard_append(text)
        self.status.set("Log copied to clipboard")

    def logmsg(self,s):
        self.q.put(("log",f"[{time.strftime('%H:%M:%S')}] {s}"))

    def _poll(self):
        try:
            while True:
                kind,payload = self.q.get_nowait()
                if kind == "install_done":
                    self._install_finished(payload)
                    continue
                if kind == "progress":
                    mode,value,text = payload
                    if mode == "hide": self._hide_progress()
                    else: self._apply_progress(mode,value,text)
                    continue
                if kind == "status":
                    self.status.set(payload)
                    continue
                if kind == "results":
                    self.set_results(*payload)
                    continue
                if kind == "sources":
                    self.refresh_sources()
                    continue
                if kind == "evidence":
                    self.evidence.set(payload)
                    self.refresh_sources()
                    continue
                # Keep the view steady if the user scrolled up to read history.
                follow = self.log.yview()[1] > 0.999
                self.log.configure(state="normal")
                self.log.insert("end",payload+"\n")
                if follow: self.log.see("end")
                self.log.configure(state="disabled")
        except queue.Empty: pass
        self.after(100,self._poll)

    def missing_dependencies(self):
        return [pkg for module,pkg in DEPENDENCIES.items()
                if importlib.util.find_spec(module) is None]

    def refresh_dependency_status(self):
        missing = self.missing_dependencies()
        if missing:
            self.dep_status.set(", ".join(f"missing {p}" for p in missing))
            self.dep_label.configure(foreground="#b7791f")
        else:
            self.dep_status.set("all installed")
            self.dep_label.configure(foreground="#276749")
        return missing

    def install_dependencies(self):
        if self._installing: return
        if not REQUIREMENTS_FILE.is_file():
            messagebox.showerror(APP_TITLE,f"requirements.txt not found next to the app:\n{REQUIREMENTS_FILE}")
            return
        self._installing = True
        self.install_btn.configure(state="disabled")
        self.dep_status.set("installing…")
        self.dep_label.configure(foreground="#2b6cb0")
        self.status.set("Installing dependencies…")
        self.progress("indeterminate",0,"Installing dependencies…")

        def task():
            ok = False
            try:
                importlib.invalidate_caches()
                if importlib.util.find_spec("pip") is None:
                    self.logmsg("pip is missing; bootstrapping it with ensurepip…")
                    run_cmd_stream([sys.executable,"-m","ensurepip","--upgrade"],self.logmsg)
                cmd=[sys.executable,"-m","pip","install","--upgrade","-r",str(REQUIREMENTS_FILE)]
                self.logmsg(f"Installing dependencies into: {sys.executable}")
                self.logmsg("$ "+" ".join(cmd))
                run_cmd_stream(cmd,self.logmsg)
                self.logmsg("Dependency installation finished.")
                ok = True
            except Exception as e:
                self.logmsg("ERROR: "+str(e))
            finally:
                importlib.invalidate_caches()
                self.q.put(("install_done",ok))
        threading.Thread(target=task,daemon=True).start()

    def _install_finished(self,ok):
        self._installing = False
        self._hide_progress()
        self.install_btn.configure(state="normal")
        self.status.set("Ready")
        missing = self.refresh_dependency_status()
        if ok and not missing:
            self.refresh_ports()
            messagebox.showinfo(APP_TITLE,"All dependencies are installed and the app is ready to use.")
        elif ok and missing:
            messagebox.showwarning(APP_TITLE,
                "pip finished, but these packages still cannot be imported:\n"
                + ", ".join(missing)
                + "\n\nCheck the Log tab, then restart the app.")
        else:
            messagebox.showerror(APP_TITLE,
                "Dependency installation failed. See the Log tab for the pip output.\n"
                "If you are offline, connect to the internet and try again.")

    def work(self,fn):
        def runner():
            self.q.put(("status","Working…"))
            try: fn()
            except Exception as e: self.logmsg("ERROR: "+str(e))
            finally:
                self.q.put(("progress",("hide",0.0,"")))
                self.q.put(("status","Ready"))
        threading.Thread(target=runner,daemon=True).start()

    def case_dir(self):
        p=Path(self.project.get()).expanduser()
        p.mkdir(parents=True,exist_ok=True)
        for d in ("evidence","extracted","reports","tools"): (p/d).mkdir(exist_ok=True)
        return p

    def evidence_path(self):
        raw=self.evidence.get().strip()
        if not raw: raise RuntimeError("Set the flash dump file (top of the window).")
        p=Path(raw).expanduser()
        if not p.is_absolute(): p=self.case_dir()/p
        return p

    def load_config(self):
        cfg={}
        if CONFIG_FILE.is_file():
            try: cfg=json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
            except Exception: cfg={}
        mapping={"case_dir":self.project,"evidence_file":self.evidence,"baud":self.baud,
                 "flash_size":self.flash_size,"esptool":self.esptool,
                 "nvs_tool_path":self.nvs_tool,"image_parser_path":self.image_parser,
                 "image_parser_args":self.parser_args}
        for key,var in mapping.items():
            val=cfg.get(key)
            if isinstance(val,str) and val: var.set(val)
        if not self.nvs_tool.get().strip():
            local=APP_DIR/"tools"/"nvs_tool"/"nvs_tool.py"
            if local.is_file(): self.nvs_tool.set(str(local))
        if not self.image_parser.get().strip():
            local=APP_DIR/"tools"/"esp32_image_parser"/"esp32_image_parser.py"
            if local.is_file(): self.image_parser.set(str(local))

    def save_config(self):
        case=self.project.get().strip()
        if not case: return
        cfg={"case_dir":case,"evidence_file":self.evidence.get(),
             "baud":self.baud.get(),"flash_size":self.flash_size.get(),
             "esptool":self.esptool.get(),"nvs_tool_path":self.nvs_tool.get(),
             "image_parser_path":self.image_parser.get(),
             "image_parser_args":self.parser_args.get()}
        (APP_DIR/"config.json").write_text(json.dumps(cfg,indent=2),encoding="utf-8")

    def show_about(self):
        messagebox.showinfo(APP_TITLE,
            "ESP32 Rover Firmware Workbench\n\n"
            "Read-only, authorized firmware audit tool.\n"
            "Reads flash, extracts partitions, decodes NVS, scans strings.\n\n"
            "Dependencies: esptool, pyserial, makeelf, hexdump.\n"
            "Settings: config.json (next to the app).")

    def show_guide(self):
        try:
            self.nb.select(self.guide_tab)
        except Exception:
            pass

    def _build_guide_tab(self, parent):
        body = ttk.Frame(parent)
        body.pack(fill="both", expand=True)
        txt = tk.Text(body, wrap="word", font=("Segoe UI", 10), relief="flat",
                      padx=12, pady=8, background="#ffffff")
        sb = ttk.Scrollbar(body, orient="vertical", command=txt.yview)
        txt.configure(yscrollcommand=sb.set, state="normal")
        txt.pack(side="left", fill="both", expand=True)
        sb.pack(side="right", fill="y")
        guide = r"""ESP32 ROVER FIRMWARE WORKBENCH - USER GUIDE
===========================================

PURPOSE
  Read-only, authorized audit of an ESP32 firmware image.
  Extracts partitions, decodes NVS, scans strings for MQTT endpoints,
  hostnames, IPs, BLE UUIDs, Wi-Fi config and credentials.

SAFETY
  - Never erases, flashes, or writes the device.
  - Reports contain RAW strings (no redaction). Keep the case folder private.
  - Use only on hardware/firmware you own or are authorized to assess.

GETTING STARTED
  1. Double-click run.bat (installs deps on first run via .venv).
  2. Plug in the ESP32. Tab 1 -> "Refresh ports" -> pick the COM port.
  3. Click "Check ESP32 / flash ID" to confirm the chip and flash size.
  4. If you already have a dump, set "Flash dump file" (top bar) to it.
     Otherwise click "Read full flash" (4 MiB, ~1-2 min).
  5. Tab 3 -> "Extract known partitions".
  6. Tab 3 -> "Scan app strings" (and optionally "Decode NVS").
  7. Browse results in the table; filter, search, inspect regions.

TAB 1 - DEVICE & FLASH
  Serial port   : COM port of the ESP32.
  Baud          : 460800 (default). Lower if unstable.
  Flash size    : 0x400000 for a 4 MiB board.
  esptool       : "esptool" (uses python -m esptool) or a full path.
  Check ESP32   : prints chip type and flash ID (activity bar shown).
  Read full flash: writes evidence/esp32_full_flash.bin (progress bar shown).
  Read is non-destructive. Never erase/write from this tool.

TAB 2 - TOOLS
  NVS decoder script   : bundled tools/nvs_tool/nvs_tool.py (ESP-IDF).
  ESP32 image parser   : bundled tools/esp32_image_parser/esp32_image_parser.py.
  Parser arguments     : leave empty until you run the parser with --help
                         and enter its verified CLI using {input} and {output}.
  All paths persist in config.json (auto-saved on close / "Save settings").

TAB 3 - ANALYZE
  Extract known partitions
      Slices the dump using the known 4 MiB layout (nvs, otadata, app0, app1,
      spiffs, coredump). Asks before overwriting. Writes partition_manifest.json.
  Scan app strings
      Scans app0.bin (filtered) + nvs.bin (all printable strings) and fills the
      results table. Reports: reports/app0_candidates.txt + strings_report.json.
      "include paths" checkbox also shows toolchain/library paths.
  Decode NVS
      Runs the NVS decoder. Use "NVS dump mode":
        all / blobs  -> recovers erased SSID/password values (recommended)
        minimal      -> only currently-written entries
        written      -> written entries only
        namespaces   -> list namespaces
        storage_info -> storage stats
        none         -> integrity check only
      Output: reports/nvs_decoded.txt (raw, no redaction).
  Search
      Substring or regex over any extracted partition (or all of them).
  Inspect region
      Printable strings from offset/size in any extracted file or the full dump.
      Output: reports/inspect_<source>_<offset>.txt.
  Reconstruct ELF
      Runs the configured image parser. Raw ESP32 app images are not ELF files;
      reconstruction is partial and toolchain-specific.
  Open reports folder
      Opens reports/ in Explorer.

RESULTS TABLE
  Columns: Offset, Source, Category, Text.
  Categories: endpoint, mqtt/topic, ble, wifi/nvs, credential, path, other, search.
  Filter box narrows rows live. Select a row to see +/-0x80 bytes of context.
  Double-click a row to copy its offset to the clipboard.

PROGRESS & LOG
  The log panel is always visible at the bottom. Drag the splitter to resize.
  Timestamps on every line. Smart auto-scroll (pauses when you scroll up).
  Clear / Copy all buttons in the log header.
  Progress bar + percentage shown in the status strip during flash read.
  Dependencies status + Install button in the status strip.

KEYBOARD SHORTCUTS
  Ctrl+S   Save settings (config.json)
  F5       Refresh serial ports
  F1       Open this guide

WHERE THE REAL SECRETS LIVE
  - app0.bin contains code/format strings (e.g. "SSID : %s") - templates, not values.
  - Real SSID/password/Wi-Fi creds live in nvs.bin (often in erased entries) -> Decode NVS with mode "all"/"blobs".
  - Broker username/password are hardcoded as plain strings in app0.bin -> Scan app strings shows them unredacted.
  - BLE device name / UUIDs are compiled-in constants in app0.bin.

SAFETY
  - Reports contain RAW values (no redaction). Keep the case folder private.
  - Rotate any credentials found in the firmware (Wi-Fi, HiveMQ, BLE).
  - Use only on hardware/firmware you own or are authorized to assess.
"""
        txt.insert("1.0", guide)
        txt.configure(state="disabled")

    def show_guide(self):
        try:
            self.nb.select(self.guide_tab)
        except Exception:
            pass

    def save_settings(self):
        try: self.save_config()
        except OSError as e:
            messagebox.showerror(APP_TITLE,f"Could not save settings:\n{e}"); return
        self.status.set("Settings saved")
        self.logmsg(f"Settings saved: {CONFIG_FILE}")

    def on_close(self):
        try: self.save_config()
        except OSError: pass
        self.destroy()

    def pick_project(self):
        p=filedialog.askdirectory(initialdir=str(self.case_dir()))
        if p:self.project.set(p); self.refresh_sources()

    def pick_evidence(self):
        p=filedialog.askopenfilename(title="Select the full flash dump",
                                     initialdir=str(self.case_dir()),
                                     filetypes=[("Firmware dumps","*.bin"),("All files","*.*")])
        if not p: return
        p=Path(p)
        try: p=p.relative_to(self.case_dir())
        except ValueError: pass
        self.evidence.set(str(p).replace("\\","/"))
        self.refresh_sources()

    def pick_script(self,var):
        p=filedialog.askopenfilename(filetypes=[("Python scripts","*.py"),("All files","*.*")])
        if p:var.set(p)

    def refresh_ports(self):
        try:
            from serial.tools import list_ports
            ports=[p.device for p in list_ports.comports()]
        except Exception:
            ports=[]
        self.port_box["values"]=ports
        if ports and self.port.get() not in ports:self.port.set(ports[0])
        self.logmsg("Serial ports: "+(", ".join(ports) if ports else "none detected (install pyserial / check USB driver)"))

    def esptool_prefix(self):
        exe=self.esptool.get().strip()
        if exe=="esptool": return [sys.executable,"-m","esptool"]
        return [exe]

    def require_port(self):
        if not self.port.get(): raise RuntimeError("Select the ESP32 serial port first.")
        return self.port.get()

    def check_device(self):
        port=self.require_port()
        baud=self.baud.get()
        prefix=self.esptool_prefix()
        def task():
            cmd=prefix+["--chip","esp32","--port",port,"--baud",baud,"flash-id"]
            self.logmsg("$ "+" ".join(cmd))
            self.progress("indeterminate",0,"Checking ESP32…")
            out=run_cmd(cmd,timeout=90)
            self.logmsg(out)
        self.work(task)

    def read_flash(self):
        dest=self.case_dir()/"evidence"/"esp32_full_flash.bin"
        if dest.exists() and not messagebox.askyesno(APP_TITLE,
                f"{dest.name} already exists in the evidence folder.\n\n"
                "Overwrite it with a fresh read from the board?"):
            return
        port=self.require_port()
        size_str=self.flash_size.get()
        baud=self.baud.get()
        prefix=self.esptool_prefix()
        def task():
            size=int(size_str,0)
            if size<=0 or size>64*1024*1024: raise ValueError("Flash size must be between 1 byte and 64 MiB.")
            cmd=prefix+["--chip","esp32","--port",port,"--baud",baud,
                        "read-flash","0x0",hex(size),str(dest)]
            self.logmsg("$ "+" ".join(cmd))
            self.progress("determinate",0,"Reading flash 0%")
            last=[-1.0]
            def on_line(line):
                m=FLASH_PROGRESS_RE.search(line)
                if not m: return True
                try: pct=float(m.group(1))
                except ValueError: return False
                if pct-last[0]>=0.5:
                    last[0]=pct
                    self.progress("determinate",pct,f"Reading flash {pct:g}%")
                return False
            run_cmd_stream(cmd,self.logmsg,timeout=900,filter_line=on_line)
            self.progress("determinate",100,"Reading flash 100%")
            actual=dest.stat().st_size
            self.logmsg(f"Flash image saved: {dest} ({actual:,} bytes)")
            if actual!=size:
                self.logmsg(f"WARNING: requested {size:,} bytes but the file is {actual:,} bytes. Re-read and verify the board.")
            self.q.put(("evidence","evidence/esp32_full_flash.bin"))
        self.work(task)

    def set_results(self,rows,summary):
        self._summary_text=summary
        self.results=rows
        self._render_results()
        self.logmsg(summary)
        children=self.tree.get_children()
        if children:
            self.tree.selection_set(children[0])
            self.tree.focus(children[0])
            self.tree.see(children[0])

    def _render_results(self):
        self.tree.delete(*self.tree.get_children())
        needle=self.filter_var.get().strip().lower()
        shown=0
        for i,r in enumerate(self.results):
            if needle and needle not in f"{r['source']} {r['category']} {r['text']}".lower():
                continue
            self.tree.insert("","end",iid=str(i),
                values=(f"0x{r['offset']:06X}",r["source"],r["category"],r["text"]))
            shown+=1
        total=len(self.results)
        suffix="" if shown==total or not needle else f"  |  filter shows {shown}/{total}"
        self.result_summary.set(self._summary_text+suffix)

    def _on_result_select(self,event=None):
        sel=self.tree.selection()
        if not sel: return
        try: idx=int(sel[0])
        except ValueError: return
        if idx<0 or idx>=len(self.results): return
        r=self.results[idx]
        self.show_context(r["source"],r["offset"])

    def show_context(self,source,offset):
        try: path=self.source_path(source)
        except Exception as e:
            self._set_context(f"Could not resolve {source}: {e}"); return
        if not path.exists():
            self._set_context(f"{source} not found."); return
        data=path.read_bytes()
        start=max(0,offset-0x80); end=min(len(data),offset+0x100)
        out=[]
        for m in PRINTABLE_RE.finditer(data[start:end]):
            s=m.group().decode("ascii","replace")
            text,_=self.redact(s)
            off=start+m.start()
            out.append(f"{'→' if off==offset else ' '} 0x{off:06X}: {text}")
        self._set_context("\n".join(out) if out else "(no printable strings in this window)")

    def _set_context(self,text):
        self.context.configure(state="normal")
        self.context.delete("1.0","end")
        self.context.insert("1.0",text)
        self.context.configure(state="disabled")

    def _copy_selected_offset(self,event=None):
        sel=self.tree.selection()
        if not sel: return
        try: r=self.results[int(sel[0])]
        except (ValueError,IndexError): return
        self.clipboard_clear()
        self.clipboard_append(f"0x{r['offset']:06X}")
        self.status.set(f"Copied offset 0x{r['offset']:06X}")

    def clear_results(self):
        self.results=[]
        self._summary_text="No results."
        self._render_results()
        self._set_context("")

    def open_reports(self):
        p=self.case_dir()/"reports"
        p.mkdir(parents=True,exist_ok=True)
        try:
            if os.name=="nt": os.startfile(p)  # type: ignore[attr-defined]
            else: subprocess.Popen(["xdg-open",str(p)])
        except OSError as e:
            messagebox.showerror(APP_TITLE,f"Could not open the reports folder:\n{e}")

    def refresh_sources(self):
        case=self.case_dir()
        names=sorted(p.name for p in (case/"extracted").glob("*.bin"))
        try:
            dump=self.evidence_path()
            if dump.exists() and dump.name not in names: names.append(dump.name)
        except Exception: pass
        if not names: names=["app0.bin"]
        self.inspect_box.configure(values=names)
        self.scope_box.configure(values=["All extracted partitions"]+names)
        if self.inspect_source.get() not in names: self.inspect_source.set(names[0])

    def source_path(self,name):
        try:
            dump=self.evidence_path()
            if name==dump.name: return dump
        except Exception: pass
        return self.case_dir()/"extracted"/name

    def scope_files(self,scope):
        if scope!="All extracted partitions":
            try: p=self.source_path(scope)
            except Exception: p=self.case_dir()/"extracted"/scope
            return [(p.name,p)]
        return [(p.name,p) for p in sorted((self.case_dir()/"extracted").glob("*.bin"))]

    def search_strings(self):
        query=self.search_var.get().strip()
        if not query:
            messagebox.showerror(APP_TITLE,"Enter a string to search for."); return
        use_regex=self.regex_var.get()
        if use_regex:
            try: re.compile(query)
            except re.error as e:
                messagebox.showerror(APP_TITLE,f"Invalid regular expression:\n{e}"); return
        files=self.scope_files(self.scope_var.get())
        if not files:
            messagebox.showinfo(APP_TITLE,"No .bin files in the extracted folder yet."); return
        def task():
            needle=query.lower()
            pattern=re.compile(query,re.I) if use_regex else None
            rows=[]
            for name,path in files:
                if not path.exists(): continue
                data=path.read_bytes()
                for m in PRINTABLE_RE.finditer(data):
                    s=m.group().decode("ascii","replace")
                    hit = bool(pattern.search(s)) if pattern else (needle in s.lower())
                    if not hit: continue
                    text,_=self.redact(s)
                    rows.append({"offset":m.start(),"source":name,"category":"search","text":text})
                    if len(rows)>=MAX_RESULTS:
                        self.q.put(("results",(rows,f"Search '{query}': stopped at {MAX_RESULTS} results (refine the query).")))
                        return
            self.q.put(("results",(rows,f"Search '{query}': {len(rows)} matching strings in {len(files)} file(s).")))
        self.work(task)

    def inspect_region(self):
        try:
            off=int(self.inspect_offset.get(),0)
            size=int(self.inspect_size.get(),0)
        except ValueError:
            messagebox.showerror(APP_TITLE,"Offset and size must be numbers (0x… hex or decimal)."); return
        if off<0 or size<=0 or size>0x100000:
            messagebox.showerror(APP_TITLE,"Size must be between 1 byte and 1 MiB."); return
        source=self.inspect_source.get()
        path=self.source_path(source)
        if not path.exists():
            messagebox.showerror(APP_TITLE,f"{source} not found."); return
        case=self.case_dir()
        start=min(off,path.stat().st_size)
        end=min(path.stat().st_size,off+size)
        if start>=end:
            messagebox.showerror(APP_TITLE,"Offset is at or past the end of the file."); return
        def task():
            data=path.read_bytes()[start:end]
            rows=[]
            for m in PRINTABLE_RE.finditer(data):
                s=m.group().decode("ascii","replace")
                text,secret=self.redact(s)
                rows.append({"offset":start+m.start(),"source":source,
                             "category":"credential" if secret else self.classify(s),"text":text})
            report=case/"reports"/f"inspect_{source.replace('.bin','')}_{start:06X}.txt"
            note=("# Note: this region is written verbatim (no redaction). Keep the report private.\n"
                  if any(r["category"]=="endpoint" for r in rows) else "")
            report.write_text(f"# Inspect {source} 0x{start:06X}..0x{end:06X} ({len(rows)} strings)\n{note}"
                              + "\n".join(f"0x{r['offset']:06X}  [{r['category']}]  {r['text']}" for r in rows),
                              encoding="utf-8")
            self.q.put(("results",(rows,f"Inspected {source} 0x{start:06X}..0x{end:06X}: {len(rows)} strings -> {report.name}")))
        self.work(task)

    @staticmethod
    def redact(s):
        return (s, False)

    @staticmethod
    def classify(s):
        is_format = bool(re.search(r"%[-+ #0-9.*]*[sdouxXeEfFgGcCpP]", s))
        if PATH_RE.search(s): return "path"
        if (not is_format) and SECRET_RE.search(s): return "credential"
        if URL_RE.search(s) or IP_RE.search(s) or HOST_RE.search(s): return "endpoint"
        if re.search(r"mqtt|topic|telemetry|availability|command|broker|lwt|publish|subscribe",s,re.I): return "mqtt/topic"
        if re.search(r"ble|gatt|uuid|characteristic|nimble",s,re.I): return "ble"
        if re.search(r"wifi|ssid|bssid|sta\.|ap\.|80211|netmask|nvs",s,re.I): return "wifi/nvs"
        return "other"

    @staticmethod
    def is_candidate(s):
        if not (URL_RE.search(s) or IP_RE.search(s) or HOST_RE.search(s) or CANDIDATE_RE.search(s)):
            return False
        return True

    def extract_partitions(self):
        case=self.case_dir()
        try: dump=self.evidence_path()
        except RuntimeError as e:
            messagebox.showerror(APP_TITLE,str(e)); return
        if not dump.exists():
            messagebox.showerror(APP_TITLE,f"Flash dump not found:\n{dump}\n\nRead the flash first or point the app at an existing dump.")
            return
        existing=[p["name"] for p in DEFAULT_PARTITIONS if (case/"extracted"/f"{p['name']}.bin").exists()]
        if existing and not messagebox.askyesno(APP_TITLE,
                "These extracted files already exist and will be overwritten:\n  "
                + ", ".join(existing) + "\n\nContinue?"):
            return

        def task():
            data=dump.read_bytes()
            manifest=[]
            for p in DEFAULT_PARTITIONS:
                off,size=int(p["offset"],0),int(p["size"],0)
                if off+size>len(data):
                    self.logmsg(f"Skip {p['name']}: outside dump bounds"); continue
                out=case/"extracted"/f"{p['name']}.bin"
                out.write_bytes(data[off:off+size])
                manifest.append({**p,"actual_size":out.stat().st_size,"file":str(out)})
                self.logmsg(f"{p['name']}: offset {p['offset']} size {p['size']} -> {out.name}")
            (case/"reports"/"partition_manifest.json").write_text(json.dumps(manifest,indent=2))
            self.logmsg("Partition extraction complete. Layout is the known 4 MiB ESP32 layout; verify against the partition table for other builds.")
            self.q.put(("sources",None))
        self.work(task)

    def decode_nvs(self):
        case=self.case_dir()
        nvs=case/"extracted"/"nvs.bin"
        script=Path(self.nvs_tool.get())
        mode=self.nvs_mode.get().strip() or "all"
        if not nvs.exists():
            messagebox.showerror(APP_TITLE,f"nvs.bin not found in {nvs.parent}."); return
        if not script.is_file():
            messagebox.showerror(APP_TITLE,f"NVS decoder not found:\n{script}"); return
        def task():
            out=case/"reports"/"nvs_decoded.txt"
            cmd=[sys.executable,str(script),str(nvs),"-d",mode,"-f","text","--color","never"]
            self.logmsg("$ "+" ".join(cmd))
            raw=run_cmd(cmd,timeout=180)
            out.write_text(raw,encoding="utf-8")
            stale=case/"reports"/"nvs_decoded_redacted.txt"
            if stale.exists(): stale.unlink()
            self.logmsg(f"NVS report written: {out}")
        self.work(task)

    def scan_strings(self):
        case=self.case_dir()
        app=case/"extracted"/"app0.bin"
        nvs=case/"extracted"/"nvs.bin"
        if not app.exists() and not nvs.exists():
            messagebox.showerror(APP_TITLE,"No extracted files found.\nExtract partitions first."); return
        include_paths=self.include_paths.get()
        def task():
            rows=[]; counts={}
            # app0.bin: filtered candidate scan
            if app.exists():
                data=app.read_bytes()
                for m in PRINTABLE_RE.finditer(data):
                    s=m.group().decode("ascii","replace")
                    if not self.is_candidate(s): continue
                    cat=self.classify(s)
                    if cat=="path" and not include_paths: continue
                    text,_=self.redact(s)
                    rows.append({"offset":m.start(),"source":"app0.bin","category":cat,"text":text})
                    counts[cat]=counts.get(cat,0)+1
            # nvs.bin: surface every printable string (this is where real SSID/password values live)
            if nvs.exists():
                data=nvs.read_bytes()
                for m in PRINTABLE_RE.finditer(data):
                    s=m.group().decode("ascii","replace")
                    text,_=self.redact(s)
                    rows.append({"offset":m.start(),"source":"nvs.bin","category":self.classify(s),"text":text})
                    counts[self.classify(s)]=counts.get(self.classify(s),0)+1
            groups={}
            for r in rows: groups.setdefault(r["category"],[]).append(r)
            lines=["# ESP32 Rover Firmware Workbench - string candidates",
                   f"# Generated: {time.strftime('%Y-%m-%d %H:%M:%S')}",
                   "# Source: app0.bin (filtered) + nvs.bin (all printable strings)",
                   "# No redaction: reports contain the raw strings from the firmware.",
                   "# Keep this file private - it may contain Wi-Fi and broker credentials.",
                   "# Counts: " + ", ".join(f"{k}={len(v)}" for k,v in sorted(groups.items())),
                   ""]
            for cat in sorted(groups):
                lines.append(f"== {cat} ({len(groups[cat])}) ==")
                for r in groups[cat]:
                    lines.append(f"0x{r['offset']:06X}  [{r['source']}]  {r['text']}")
                lines.append("")
            (case/"reports"/"app0_candidates.txt").write_text("\n".join(lines),encoding="utf-8")
            (case/"reports"/"strings_report.json").write_text(json.dumps({
                "generated":time.strftime("%Y-%m-%dT%H:%M:%S"),
                "sources":["app0.bin","nvs.bin"],"counts":{k:len(v) for k,v in groups.items()},
                "rows":rows},indent=2),encoding="utf-8")
            # Remove stale redacted reports from older versions.
            for stale in ("app0_candidates_redacted.txt","sensitive_findings_LOCAL_ONLY.txt"):
                p=case/"reports"/stale
                if p.exists(): p.unlink()
            summary=f"Scanned app0.bin + nvs.bin: {len(rows)} strings (" + ", ".join(f"{k}={len(v)}" for k,v in sorted(groups.items())) + ")."
            self.q.put(("results",(rows,summary)))
        self.work(task)

    def reconstruct_elf(self):
        case=self.case_dir()
        app=case/"extracted"/"app0.bin"
        parser=Path(self.image_parser.get())
        template=self.parser_args.get().strip()
        if not app.exists():
            messagebox.showerror(APP_TITLE,f"app0.bin not found in {app.parent}."); return
        if not parser.is_file():
            messagebox.showerror(APP_TITLE,f"Image parser not found:\n{parser}"); return
        if not template:
            messagebox.showerror(APP_TITLE,"First run the parser's --help and enter verified arguments using {input} and {output}."); return
        def task():
            output=case/"extracted"/"app0_reconstructed.elf"
            import shlex
            parts=shlex.split(template.replace("{input}",str(app)).replace("{output}",str(output)),posix=(os.name!="nt"))
            cmd=[sys.executable,str(parser)]+parts
            self.logmsg("$ "+" ".join(cmd))
            out=run_cmd(cmd,timeout=600)
            if out.strip(): self.logmsg(out)
            if output.exists(): self.logmsg(f"ELF created: {output}")
            else: self.logmsg("Parser completed but expected output path was not created. Check parser CLI syntax and output path.")
        self.work(task)

if __name__=="__main__":
    Workbench().mainloop()
