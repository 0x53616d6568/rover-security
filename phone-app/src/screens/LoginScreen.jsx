import { useState } from "react";

const panel = "flex min-h-screen items-center justify-center bg-black p-4";
const card = "w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-text-primary";
const inputClass =
  "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-text-primary placeholder:text-white/30 focus:border-green-400/50 focus:outline-none disabled:opacity-40";

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
    } catch (error) {
      setError(error instanceof Error ? error.message : "Sign in failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={panel}>
      <form className={card} onSubmit={submit}>
        <div className="text-lg font-bold tracking-wide text-white">Welcome back</div>
        <div className="mt-1 text-xs text-white/60">Sign in to the RoverX console.</div>

        <label className="mt-4 block text-xs font-semibold text-white/70" htmlFor="login-name">
          Owner name
        </label>
        <input
          id="login-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Owner name"
          className={inputClass}
          disabled={isLoading || busy}
          autoComplete="username"
        />

        <label className="mt-4 block text-xs font-semibold text-white/70" htmlFor="login-password">
          Password
        </label>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          className={inputClass}
          disabled={isLoading || busy}
          autoComplete="current-password"
        />

        <button
          type="submit"
          disabled={isLoading || busy || !name.trim() || !password}
          className="mt-5 w-full rounded-xl bg-green-400/90 py-3 text-sm font-semibold text-deep disabled:opacity-40"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>

        {isLoading && <p className="mt-3 text-xs text-white/50">Checking your session…</p>}
        {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
      </form>
    </div>
  );
}
