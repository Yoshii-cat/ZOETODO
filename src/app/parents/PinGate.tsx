"use client";

import { useState } from "react";

export default function PinGate() {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/parents/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (!res.ok) {
        setErr("That's not it. Try again.");
        setPin("");
        return;
      }
      window.location.reload();
    } catch {
      setErr("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gate">
      <form onSubmit={submit}>
        <h2>Parents</h2>
        <p>Enter the PIN.</p>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          aria-label="Parent PIN"
        />
        <div className="row">
          <button className="btn primary" type="submit" disabled={busy || !pin}>
            {busy ? "Checking..." : "Enter"}
          </button>
        </div>
        <div className="err">{err}</div>
      </form>
    </div>
  );
}
