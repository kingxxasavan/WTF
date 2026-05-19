"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
};

export function NewChatDialog({
  meId,
  onClose,
  onCreated,
}: {
  meId: string;
  onClose: () => void;
  onCreated: (conversationId: string) => void;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [picked, setPicked] = useState<Profile[]>([]);
  const [groupName, setGroupName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const searchSeq = useRef(0);

  // Type-ahead search by username or display name.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const seq = ++searchSeq.current;
    const t = setTimeout(async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .neq("id", meId)
        .limit(10);
      if (seq !== searchSeq.current) return;
      if (!error) setResults((data ?? []) as Profile[]);
    }, 180);
    return () => clearTimeout(t);
  }, [query, supabase, meId]);

  function togglePick(p: Profile) {
    setPicked((cur) => (cur.some((x) => x.id === p.id) ? cur.filter((x) => x.id !== p.id) : [...cur, p]));
  }

  async function create() {
    if (picked.length === 0) return;
    setErr(null);
    setBusy(true);
    try {
      const isGroup = picked.length > 1;

      // For 1:1, reuse an existing direct conversation if there is one.
      if (!isGroup) {
        const other = picked[0].id;
        const { data: mine } = await supabase
          .from("conversation_members")
          .select("conversation_id")
          .eq("user_id", meId);
        const { data: theirs } = await supabase
          .from("conversation_members")
          .select("conversation_id")
          .eq("user_id", other);
        const overlap = new Set((mine ?? []).map((r) => r.conversation_id));
        const shared = (theirs ?? [])
          .map((r) => r.conversation_id)
          .filter((id) => overlap.has(id));
        if (shared.length) {
          const { data: directs } = await supabase
            .from("conversations")
            .select("id, is_group")
            .in("id", shared)
            .eq("is_group", false);
          if (directs && directs.length) {
            onCreated(directs[0].id);
            return;
          }
        }
      }

      const { data: convo, error: cErr } = await supabase
        .from("conversations")
        .insert({
          is_group: isGroup,
          name: isGroup ? (groupName.trim() || "New group") : null,
          created_by: meId,
        })
        .select("id")
        .single();
      if (cErr || !convo) throw cErr ?? new Error("Failed to create conversation");

      // Insert myself first so the `is_member` check passes when adding others.
      const { error: meErr } = await supabase
        .from("conversation_members")
        .insert({ conversation_id: convo.id, user_id: meId });
      if (meErr) throw meErr;
      if (picked.length > 0) {
        const { error: memErr } = await supabase
          .from("conversation_members")
          .insert(picked.map((p) => ({ conversation_id: convo.id, user_id: p.id })));
        if (memErr) throw memErr;
      }

      // Also add picks to my contacts list, idempotently.
      await supabase
        .from("contacts")
        .upsert(
          picked.map((p) => ({ owner_id: meId, contact_id: p.id })),
          { onConflict: "owner_id,contact_id" },
        );

      onCreated(convo.id);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="panel w-full max-w-md p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold">New chat</h3>
        <p className="mt-1 text-xs text-ink-500">
          Search by username or display name. Pick more than one for a group.
        </p>

        {picked.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {picked.map((p) => (
              <button
                key={p.id}
                className="rounded-full bg-accent/10 px-2.5 py-1 text-xs text-accent hover:bg-accent/20"
                onClick={() => togglePick(p)}
              >
                @{p.username} ×
              </button>
            ))}
          </div>
        )}

        <input
          className="input mt-3"
          autoFocus
          placeholder="username or name"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <ul className="mt-2 max-h-64 overflow-y-auto">
          {results.map((p) => {
            const isPicked = picked.some((x) => x.id === p.id);
            return (
              <li key={p.id}>
                <button
                  className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-black/5 dark:hover:bg-white/5 ${
                    isPicked ? "bg-accent/10" : ""
                  }`}
                  onClick={() => togglePick(p)}
                >
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-accent to-blue-500 text-xs font-semibold text-white">
                    {p.username.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{p.display_name}</span>
                    <span className="block text-xs text-ink-500">@{p.username}</span>
                  </span>
                </button>
              </li>
            );
          })}
          {query.trim().length >= 2 && results.length === 0 && (
            <li className="px-2 py-3 text-sm text-ink-500">No matches.</li>
          )}
        </ul>

        {picked.length > 1 && (
          <input
            className="input mt-3"
            placeholder="Group name (optional)"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
        )}

        {err && (
          <div className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{err}</div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={create} disabled={busy || picked.length === 0}>
            {busy ? "…" : picked.length > 1 ? "Create group" : "Start chat"}
          </button>
        </div>
      </div>
    </div>
  );
}
