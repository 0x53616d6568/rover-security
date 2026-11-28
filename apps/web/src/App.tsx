import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Camera,
  Gamepad2,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Menu,
  PlugZap,
  RadioTower,
  X,
} from "lucide-react";

import { useRover } from "./app/useRover";
import { getMe, loginUser, logoutUser } from "./features/rovers/management";
import type { ManagementUser } from "./features/rovers/managementTypes";
import { formatAge } from "./protocol/telemetry";
import LoginScreen from "./features/auth/LoginScreen";
import WelcomeScreen from "./features/welcome/WelcomeScreen";
import FleetScreen from "./features/rovers/FleetScreen";
import ConnectionScreen from "./features/connection/ConnectionScreen";
import CockpitScreen from "./features/control/CockpitScreen";
import TelemetryScreen from "./features/telemetry/TelemetryScreen";
import CameraScreen from "./features/camera/CameraScreen";
import HelpScreen from "./features/help/HelpScreen";
import { Button, StatusPill } from "./shared/ui";

const PRIMARY_NAV = [
  { id: "welcome", label: "Overview", icon: LayoutDashboard },
  { id: "fleet", label: "Fleet", icon: RadioTower },
  { id: "connection", label: "Link", icon: PlugZap },
  { id: "control", label: "Drive", icon: Gamepad2 },
  { id: "telemetry", label: "Telemetry", icon: Activity },
] as const;

const SECONDARY_NAV = [
  { id: "camera", label: "Camera", icon: Camera },
  { id: "help", label: "Help", icon: HelpCircle },
] as const;

const ALL_NAV = [...PRIMARY_NAV, ...SECONDARY_NAV];
type TabId = (typeof ALL_NAV)[number]["id"];
const TAB_IDS = new Set<string>(ALL_NAV.map((item) => item.id));

function isTabId(value: string): value is TabId {
  return TAB_IDS.has(value);
}

export default function App() {
  const { state, connect, disconnect, arm, disarm, stop, setAxes, toggleDemo, sendWifi } = useRover();
  const [tab, setTab] = useState<TabId>("welcome");
  const [auth, setAuth] = useState<ManagementUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [moreOpen, setMoreOpen] = useState(false);
  const selectedRoverId = state.selectedRoverId;

  useEffect(() => {
    let mounted = true;
    getMe()
      .then((user) => {
        if (mounted) setAuth(user);
      })
      .catch(() => {
        if (mounted) setAuth(null);
      })
      .finally(() => {
        if (mounted) setAuthLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleLogin = useCallback(async (name: string, password: string) => {
    const user = await loginUser(name, password);
    setAuth(user);
    setTab("fleet");
  }, []);

  const handleLogout = useCallback(async () => {
    if (state.connectionStatus === "connected" || state.selectedRoverId) {
      await disconnect();
    }
    await logoutUser();
    setAuth(null);
    setTab("welcome");
    setMoreOpen(false);
  }, [disconnect, state.connectionStatus, state.selectedRoverId]);

  const handleNavigate = useCallback((next: string) => {
    if (isTabId(next)) setTab(next);
    setMoreOpen(false);
  }, []);

  // Selecting and connecting a rover opens the driving view, as before.
  useEffect(() => {
    if (state.connectionStatus === "connected" && selectedRoverId) setTab("control");
  }, [state.connectionStatus, selectedRoverId]);

  const connected = state.connectionStatus === "connected" && Boolean(selectedRoverId);
  const commandOnline = state.links.command;
  const telemetryAge = state.telemetry
    ? formatAge(state.telemetry.ageMs, state.telemetry.receivedAt)
    : "—";
  const currentLabel = useMemo(
    () => ALL_NAV.find((item) => item.id === tab)?.label ?? "Console",
    [tab],
  );

  if (authLoading || !auth) {
    return <LoginScreen onLogin={handleLogin} isLoading={authLoading} />;
  }

  if (tab === "control") {
    return (
      <CockpitScreen
        state={state}
        connected={connected}
        arm={arm}
        disarm={disarm}
        stop={stop}
        setAxes={setAxes}
        onNavigate={handleNavigate}
        selectedRoverId={selectedRoverId}
      />
    );
  }

  const commandTone = commandOnline
    ? "live"
    : state.connectionStatus === "connecting"
      ? "warn"
      : "danger";
  const commandLabel = commandOnline
    ? "CMD online"
    : state.connectionStatus === "connecting"
      ? "CMD connecting"
      : "CMD offline";

  const screen = (() => {
    switch (tab) {
      case "welcome":
        return <WelcomeScreen state={state} auth={auth} onNavigate={handleNavigate} />;
      case "fleet":
        return (
          <FleetScreen
            connect={connect}
            disconnect={disconnect}
            state={state}
            auth={auth}
            onLogout={handleLogout}
          />
        );
      case "connection":
        return (
          <ConnectionScreen
            state={state}
            connected={connected}
            connect={connect}
            disconnect={disconnect}
            toggleDemo={toggleDemo}
            arm={arm}
            disarm={disarm}
            sendWifi={sendWifi}
            selectedRoverId={selectedRoverId}
          />
        );
      case "telemetry":
        return <TelemetryScreen state={state} />;
      case "camera":
        return <CameraScreen state={state} />;
      case "help":
        return <HelpScreen />;
      default:
        return null;
    }
  })();

  return (
    <div className="min-h-screen bg-bg lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-line bg-bg-elevated/60 px-3 py-4 lg:flex">
        <div className="flex items-center gap-2.5 px-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-sm border border-accent/40 bg-accent-soft font-mono text-[11px] font-semibold text-accent">
            ES
          </span>
          <div>
            <div className="micro-label">ENISOLAR</div>
            <div className="text-sm font-medium text-ink">Rover console</div>
          </div>
        </div>

        <div className="mt-8">
          <div className="micro-label px-2">Operate</div>
          <nav className="mt-2 space-y-1" aria-label="Primary">
            {PRIMARY_NAV.map(({ id, label, icon: Icon }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleNavigate(id)}
                  aria-current={active ? "page" : undefined}
                  className={`group flex w-full items-center gap-2.5 rounded-sm border px-2.5 py-2 text-left text-xs transition-colors ${
                    active
                      ? "border-line bg-surface-2 text-ink"
                      : "border-transparent text-ink-muted hover:bg-surface-2 hover:text-ink"
                  }`}
                >
                  <Icon size={15} className={active ? "text-accent" : "text-ink-faint group-hover:text-ink-muted"} />
                  <span className="font-medium">{label}</span>
                  {active && <span className="ml-auto h-1 w-1 rounded-full bg-accent" aria-hidden="true" />}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="mt-6">
          <div className="micro-label px-2">Payload</div>
          <nav className="mt-2 space-y-1" aria-label="Secondary">
            {SECONDARY_NAV.map(({ id, label, icon: Icon }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleNavigate(id)}
                  aria-current={active ? "page" : undefined}
                  className={`group flex w-full items-center gap-2.5 rounded-sm border px-2.5 py-2 text-left text-xs transition-colors ${
                    active
                      ? "border-line bg-surface-2 text-ink"
                      : "border-transparent text-ink-muted hover:bg-surface-2 hover:text-ink"
                  }`}
                >
                  <Icon size={15} className={active ? "text-accent" : "text-ink-faint group-hover:text-ink-muted"} />
                  <span className="font-medium">{label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto space-y-3 border-t border-line pt-4">
          <div className="px-2">
            <div className="micro-label">Signed in</div>
            <div className="mt-1 truncate text-sm font-medium text-ink">{auth.name}</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <StatusPill tone={connected ? "live" : "neutral"} label={connected ? "Rover linked" : "Rover offline"} />
              {state.demoMode && <StatusPill tone="warn" label="Demo" dot={false} />}
            </div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => void handleLogout()}>
            <LogOut size={13} />
            Sign out
          </Button>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-xl">
          <div className="flex h-14 items-center gap-3 px-4 lg:px-8">
            <div className="flex items-center gap-2 lg:hidden">
              <span className="flex h-8 w-8 items-center justify-center rounded-sm border border-accent/40 bg-accent-soft font-mono text-[10px] font-semibold text-accent">
                ES
              </span>
              <div>
                <div className="micro-label leading-none">ENISOLAR</div>
                <div className="text-xs font-medium text-ink">{currentLabel}</div>
              </div>
            </div>

            <div className="hidden items-center gap-2 lg:flex">
              <span className="micro-label">Console</span>
              <span className="text-line-strong">/</span>
              <span className="text-sm font-medium text-ink">{currentLabel}</span>
            </div>

            <div className="ml-auto flex items-center gap-1.5">
              <StatusPill tone={commandTone} label={commandLabel} title="Command MQTT link status" />
              <StatusPill
                tone={state.safetyState === "MANUAL" ? "live" : state.safetyState === "FAULT" ? "danger" : "neutral"}
                label={state.safetyState}
                dot={false}
                className="hidden xs:inline-flex"
              />
              <StatusPill tone="neutral" label={telemetryAge} dot={false} className="hidden sm:inline-flex" title="Telemetry age" />
              {state.demoMode && <StatusPill tone="warn" label="Demo" dot={false} className="hidden md:inline-flex" />}

              <button
                type="button"
                onClick={() => setMoreOpen((open) => !open)}
                className="ml-1 flex h-9 w-9 items-center justify-center rounded-sm border border-line bg-surface-2 text-ink-muted hover:text-ink lg:hidden"
                aria-label={moreOpen ? "Close menu" : "Open menu"}
                aria-expanded={moreOpen}
              >
                {moreOpen ? <X size={16} /> : <Menu size={16} />}
              </button>
            </div>
          </div>

          {moreOpen && (
            <div className="border-t border-line bg-bg-elevated px-4 py-3 lg:hidden">
              <div className="grid gap-1">
                {SECONDARY_NAV.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleNavigate(id)}
                    className="flex items-center gap-2.5 rounded-sm px-2 py-2 text-left text-xs text-ink-muted hover:bg-surface-2 hover:text-ink"
                  >
                    <Icon size={15} className="text-accent" />
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="flex items-center gap-2.5 rounded-sm px-2 py-2 text-left text-xs text-danger hover:bg-danger-soft"
                >
                  <LogOut size={15} />
                  Sign out
                </button>
              </div>
              <div className="mt-2 border-t border-line pt-2 text-[11px] text-ink-faint">
                {auth.name} · {selectedRoverId ? `Rover ${selectedRoverId}` : "No rover selected"}
              </div>
            </div>
          )}
        </header>

        <main className="mx-auto max-w-7xl px-4 pb-28 pt-6 lg:px-8 lg:pb-10">{screen}</main>

        <nav
          className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 backdrop-blur-xl lg:hidden"
          style={{ paddingBottom: "max(6px, env(safe-area-inset-bottom))" }}
          aria-label="Primary"
        >
          <div className="grid grid-cols-5">
            {PRIMARY_NAV.map(({ id, label, icon: Icon }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleNavigate(id)}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center gap-1 px-1 pb-1 pt-2 text-[9px] font-medium uppercase tracking-[0.08em] ${
                    active ? "text-accent" : "text-ink-faint hover:text-ink-muted"
                  }`}
                >
                  <Icon size={17} strokeWidth={active ? 2.1 : 1.7} />
                  {label}
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
