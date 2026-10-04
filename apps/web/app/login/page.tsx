"use client";
import { useState } from "react";
import { ArrowRight } from "lucide-react";

export default function Login() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="login">
      <form
        className="login-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const r = await fetch("/api/auth", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ code }),
            });
            const data = await r.json();
            if (!r.ok)
              throw new Error(
                data.error?.message ?? "Sign-in failed. Check the access code.",
              );
            window.location.href = "/";
          } catch (e) {
            setError(
              e instanceof Error
                ? e.message
                : "Sign-in failed. Check the access code.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <header className="login-head">
          <span className="wordmark-name">manifest</span>
          <span className="mono">MIG-0001</span>
        </header>
        <h1>Open the migration declaration</h1>
        <p>
          This workspace holds shared migration plans and a mock target
          database. Enter the access code you were given to continue.
        </p>
        <div className="form-grid two">
          <div className="box">
            <span className="box-label">Source</span>
            <code className="box-value">legacy_crm.customers</code>
          </div>
          <div className="box">
            <span className="box-label">Target</span>
            <code className="box-value">target.customers</code>
          </div>
        </div>
        <label className="field">
          <span>Access code</span>
          <input
            type="password"
            autoComplete="current-password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            autoFocus
          />
        </label>
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
        <button className="button primary full" disabled={busy}>
          {busy ? "Verifying…" : "Open workbench"}
          {!busy && <ArrowRight size={16} aria-hidden="true" />}
        </button>
      </form>
    </main>
  );
}
