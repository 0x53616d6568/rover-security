import { useState } from "react";
import { ArrowRight, LockKeyhole, RadioTower, ShieldCheck } from "lucide-react";

import { Button, Field, Input, StatusPill } from "../../shared/ui";

const guarantees = [
  {
    icon: RadioTower,
    title: "Split command and telemetry",
    detail: "Driving uses the command broker. Telemetry stays read-only.",
  },
  {
    icon: ShieldCheck,
    title: "Arm and stop are explicit",
    detail: "No auto-resume after a lost link, fault, or page hide.",
  },
  {
    icon: LockKeyhole,
    title: "Owner-scoped bindings",
    detail: "Rovers are bound to the signed-in owner; MACs stay masked.",
  },
];

export default function LoginScreen({ onLogin, isLoading }) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onLogin(name, password);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Sign in failed.");
    } finally {
      setBusy(false);
    }
  };

  const disabled = isLoading || busy;

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden flex-col justify-between border-r border-line px-10 py-12 lg:flex">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-sm border border-accent/40 bg-accent-soft font-mono text-[11px] font-semibold text-accent">
                ES
              </span>
              <div>
                <div className="micro-label">ENISOLAR</div>
                <div className="text-sm font-medium text-ink">Field operations</div>
              </div>
            </div>

            <h1 className="mt-16 max-w-md text-4xl font-semibold leading-[1.08] tracking-tight text-ink">
              Supervised rover control,
              <span className="text-accent"> without the guesswork.</span>
            </h1>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-ink-muted">
              A dense instrument console for the Phase 1 rover: owner-bound access, a separate command
              channel, and telemetry that states its own age and validity.
            </p>

            <ul className="mt-10 space-y-4">
              {guarantees.map(({ icon: Icon, title, detail }) => (
                <li key={title} className="flex gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-line bg-surface-2 text-accent">
                    <Icon size={15} strokeWidth={1.75} />
                  </span>
                  <div>
                    <div className="text-sm font-medium text-ink">{title}</div>
                    <div className="text-xs leading-relaxed text-ink-muted">{detail}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center justify-between border-t border-line pt-5">
            <span className="micro-label">Phase 1 · manual operation</span>
            <img src="/rover.svg" alt="" aria-hidden="true" className="h-12 w-auto opacity-70" />
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-10 sm:px-10">
          <div className="w-full max-w-sm">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <span className="flex h-9 w-9 items-center justify-center rounded-sm border border-accent/40 bg-accent-soft font-mono text-[11px] font-semibold text-accent">
                ES
              </span>
              <div>
                <div className="micro-label">ENISOLAR</div>
                <div className="text-sm font-medium text-ink">Rover console</div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold tracking-tight text-ink">Operator sign-in</h2>
              <StatusPill tone={isLoading ? "warn" : "neutral"} label={isLoading ? "Checking" : "Locked"} />
            </div>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              Authenticate as an owner to select a bound rover and open the command channel.
            </p>

            <form className="mt-7 space-y-4" onSubmit={submit}>
              <Field label="Owner name" htmlFor="login-name">
                <Input
                  id="login-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Owner"
                  autoComplete="username"
                  autoFocus
                  disabled={disabled}
                />
              </Field>

              <Field label="Password" htmlFor="login-password">
                <Input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={disabled}
                />
              </Field>

              {error && (
                <p role="alert" className="rounded-sm border border-danger-line bg-danger-soft px-3 py-2 text-xs leading-relaxed text-danger">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                disabled={disabled || !name.trim() || !password}
              >
                {busy ? "Signing in…" : "Enter console"}
                {!busy && <ArrowRight size={14} />}
              </Button>
            </form>

            {isLoading && <p className="mt-3 text-xs text-ink-faint">Checking your existing session…</p>}

            <details className="mt-6 border-t border-line pt-4">
              <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint hover:text-ink-muted">
                Offline fallback
              </summary>
              <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
                When the API or PostgreSQL is unavailable, the console falls back to a browser-local owner
                (<span className="data-value text-ink-muted">Owner</span> /{" "}
                <span className="data-value text-ink-muted">Rover2026!</span>). Local data never leaves this browser.
              </p>
            </details>
          </div>
        </section>
      </div>
    </main>
  );
}
