"use client";
import { useState } from "react";
export default function Login() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="login-page">
      <form
        className="login-card"
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
            if (!r.ok) throw new Error(data.error?.message ?? "Sign-in failed");
            window.location.href = "/";
          } catch (e) {
            setError(e instanceof Error ? e.message : "Sign-in failed");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="brand-mark">M</div>
        <p className="eyebrow">MANIFEST / CONTROLLED ACCESS</p>
        <h1>Enter the workbench.</h1>
        <p>
          This workspace contains shared migration plans and a mock target.
          Enter your access code to continue.
        </p>
        <label>
          Access code
          <input
            type="password"
            autoComplete="current-password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button className="button primary" disabled={busy}>
          {busy ? "Verifying…" : "Open workbench →"}
        </button>
      </form>
    </main>
  );
}
