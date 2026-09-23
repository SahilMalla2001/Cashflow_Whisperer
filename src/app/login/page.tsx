"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { safeRedirect } from '@/lib/safe-redirect';

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSending(true);
    setStatus(null);
    const next = new URLSearchParams(window.location.search).get("next");
    const destination = safeRedirect(next, window.location.origin);
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(destination)}` },
    });
    setStatus(error ? error.message : "Check your email for a secure sign-in link.");
    setSending(false);
  };

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={submit}>
        <p className="login-kicker">Cashflow Whisperer</p>
        <h1>Sign in to your finances</h1>
        <p>We’ll email you a secure sign-in link. Only signed-in users can access financial data.</p>
        <label htmlFor="email">Email address</label>
        <input
          className="input"
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <button className="btn btn-primary" type="submit" disabled={sending}>
          {sending ? "Sending…" : "Email me a sign-in link"}
        </button>
        {status && <p className="login-status">{status}</p>}
      </form>
    </main>
  );
}
