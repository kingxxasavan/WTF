"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { NewChatDialog } from "./new-chat-dialog";
import clsx from "clsx";

type ConvoRow = {
  id: string;
  is_group: boolean;
  name: string | null;
  last_message_at: string;
};
type MemberRow = {
  conversation_id: string;
  user_id: string;
  profiles: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
};
type LastMsg = {
  conversation_id: string;
  content: string | null;
  image_path: string | null;
  created_at: string;
};

export function ChatSidebar({ meId, onPick }: { meId: string; onPick?: () => void }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const path = usePathname();
  const [convos, setConvos] = useState<ConvoRow[]>([]);
  const [members, setMembers] = useState<Record<string, MemberRow[]>>({});
  const [previews, setPreviews] = useState<Record<string, LastMsg>>({});
  const [query, setQuery] = useState("");
  const [showNew, setShowNew] = useState(false);

  const loadAll = useCallback(async () => {
    // 1. Get the conversations I'm a member of.
    const { data: myMems, error: mErr } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", meId);
    if (mErr || !myMems) return;
    const ids = myMems.map((m) => m.conversation_id);
    if (ids.length === 0) {
      setConvos([]);
      setMembers({});
      setPreviews({});
      return;
    }
    const [{ data: convoRows }, { data: memberRows }, { data: lastMsgs }] = await Promise.all([
      supabase
        .from("conversations")
        .select("id, is_group, name, last_message_at")
        .in("id", ids)
        .order("last_message_at", { ascending: false }),
      supabase
        .from("conversation_members")
        .select(
          "conversation_id, user_id, profiles:profiles!conversation_members_user_id_fkey(id, username, display_name, avatar_url)",
        )
        .in("conversation_id", ids),
      supabase
        .from("messages")
        .select("conversation_id, content, image_path, created_at")
        .in("conversation_id", ids)
        .order("created_at", { ascending: false }),
    ]);
    setConvos(convoRows ?? []);
    const memberMap: Record<string, MemberRow[]> = {};
    for (const r of (memberRows ?? []) as unknown as MemberRow[]) {
      (memberMap[r.conversation_id] ||= []).push(r);
    }
    setMembers(memberMap);
    const previewMap: Record<string, LastMsg> = {};
    for (const m of (lastMsgs ?? []) as LastMsg[]) {
      if (!previewMap[m.conversation_id]) previewMap[m.conversation_id] = m;
    }
    setPreviews(previewMap);
  }, [supabase, meId]);

  useEffect(() => {
    loadAll();
    // Live updates: a new conversation I'm added to, or a new message anywhere.
    const ch = supabase
      .channel("sidebar")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversation_members", filter: `user_id=eq.${meId}` },
        () => loadAll(),
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => loadAll())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversations" }, () => loadAll())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [supabase, meId, loadAll]);

  function nameFor(c: ConvoRow): string {
    if (c.name) return c.name;
    if (c.is_group) return "Group";
    const others = (members[c.id] ?? []).filter((m) => m.user_id !== meId);
    if (others[0]?.profiles) {
      return others[0].profiles.display_name || ("@" + others[0].profiles.username);
    }
    return "Direct chat";
  }

  function previewFor(c: ConvoRow): string {
    const p = previews[c.id];
    if (!p) return "No messages yet";
    if (p.image_path) return "📷 Photo";
    return p.content ?? "";
  }

  const filtered = convos.filter((c) => nameFor(c).toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 px-4 py-3">
        <input
          className="input"
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          className="btn-primary !px-3"
          onClick={() => setShowNew(true)}
          aria-label="New chat"
          title="New chat"
        >
          +
        </button>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {filtered.length === 0 && (
          <li className="px-3 py-6 text-sm text-ink-500">
            No conversations yet. Tap + to add a friend by username.
          </li>
        )}
        {filtered.map((c) => {
          const active = path === `/chat/${c.id}`;
          const others = (members[c.id] ?? []).filter((m) => m.user_id !== meId);
          const avatarSeed = c.is_group ? c.id : others[0]?.profiles?.username ?? c.id;
          return (
            <li key={c.id}>
              <Link
                href={`/chat/${c.id}`}
                onClick={onPick}
                className={clsx(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 transition",
                  active
                    ? "bg-black/5 dark:bg-white/10"
                    : "hover:bg-black/5 dark:hover:bg-white/5",
                )}
              >
                <Avatar seed={avatarSeed} group={c.is_group} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{nameFor(c)}</span>
                    <span className="shrink-0 text-[10px] uppercase tracking-wide text-ink-500">
                      {fmt(c.last_message_at)}
                    </span>
                  </div>
                  <div className="truncate text-xs text-ink-500">{previewFor(c)}</div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      {showNew && (
        <NewChatDialog
          meId={meId}
          onClose={() => setShowNew(false)}
          onCreated={(id) => {
            setShowNew(false);
            router.push(`/chat/${id}`);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function Avatar({ seed, group }: { seed: string; group: boolean }) {
  const hue = hashHue(seed);
  return (
    <div
      className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-semibold text-white"
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 80% 60%), hsl(${(hue + 40) % 360} 70% 50%))`,
      }}
    >
      {group ? (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="9" cy="9" r="3" />
          <circle cx="17" cy="11" r="2.5" />
          <path d="M3 19a6 6 0 0 1 12 0M14 19a5 5 0 0 1 7 0" />
        </svg>
      ) : (
        seed.slice(0, 2).toUpperCase()
      )}
    </div>
  );
}

function hashHue(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

function fmt(ts: string) {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}
