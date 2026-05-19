"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ChatSidebar } from "./chat-sidebar";
import { ThemeToggle } from "./theme-toggle";

type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
};

export function ChatShell({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // If auth changes (sign out from another tab) bounce them.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.replace("/login");
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase, router]);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="grid min-h-screen grid-rows-[auto_1fr]">
      <header className="flex items-center justify-between border-b border-black/5 bg-white/60 px-4 py-3 backdrop-blur-md dark:border-white/5 dark:bg-ink-900/40">
        <div className="flex items-center gap-3">
          <button
            className="btn-ghost h-9 w-9 !p-0 md:hidden"
            aria-label="Toggle sidebar"
            onClick={() => setSidebarOpen((s) => !s)}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <Link href="/chat" className="flex items-center gap-2 font-semibold">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent" />
            <span className="tracking-wide">WTF</span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden text-right md:block">
            <div className="text-sm font-semibold leading-none">{profile.display_name}</div>
            <div className="text-xs text-ink-500">@{profile.username}</div>
          </div>
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-accent to-blue-500 text-white grid place-items-center text-sm font-semibold">
            {initials(profile.display_name)}
          </div>
          <ThemeToggle />
          <button className="btn-ghost" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <div className="grid min-h-0 md:grid-cols-[320px_1fr]">
        <aside
          className={
            "border-r border-black/5 bg-white/40 backdrop-blur-md dark:border-white/5 dark:bg-ink-900/30 " +
            (sidebarOpen ? "block" : "hidden md:block")
          }
        >
          <ChatSidebar meId={profile.id} onPick={() => setSidebarOpen(false)} />
        </aside>
        <main className="min-h-0">{children}</main>
      </div>
    </div>
  );
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
