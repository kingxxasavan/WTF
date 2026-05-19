"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Mode = "login" | "signup";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setNote(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const clean = username.trim().toLowerCase();
        if (!/^[a-z0-9_]{3,24}$/.test(clean)) {
          throw new Error("Username must be 3–24 chars, letters/numbers/underscore.");
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: clean,
              display_name: displayName.trim() || clean,
            },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setNote("Check your inbox to confirm your email, then sign in.");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      router.replace("/chat");
      router.refresh();
    } catch (e: unknown) {
      const m = e instanceof Error ? e.message : String(e);
      setErr(m);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {mode === "signup" && (
        <>
          <div>
            <label className="label">Display name</label>
            <input
              className="input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Sam"
              autoComplete="name"
              required
            />
          </div>
          <div>
            <label className="label">Username</label>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="sam_99"
              autoComplete="username"
              required
            />
          </div>
        </>
      )}
      <div>
        <label className="label">Email</label>
        <input
          className="input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
      </div>
      <div>
        <label className="label">Password</label>
        <input
          className="input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          required
        />
      </div>

      {err && <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{err}</div>}
      {note && <div className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">{note}</div>}

      <button className="btn-primary w-full" disabled={busy}>
        {busy ? "…" : mode === "signup" ? "Create account" : "Sign in"}
      </button>
    </form>
  );
}
