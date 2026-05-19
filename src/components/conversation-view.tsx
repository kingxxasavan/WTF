"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Composer } from "./composer";
import { MessageBubble } from "./message-bubble";

type Member = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
};
type Conversation = {
  id: string;
  is_group: boolean;
  name: string | null;
  created_by: string | null;
  last_message_at: string;
};
export type Message = {
  id: string;
  sender_id: string;
  content: string | null;
  image_path: string | null;
  created_at: string;
  // Local-only optimistic flag
  pending?: boolean;
};

export function ConversationView({
  meId,
  conversation,
  members,
  initialMessages,
}: {
  meId: string;
  conversation: Conversation;
  members: Member[];
  initialMessages: Message[];
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const memberById = useMemo(() => {
    const m: Record<string, Member> = {};
    for (const x of members) m[x.id] = x;
    return m;
  }, [members]);

  const scrollToBottom = useCallback((smooth = true) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  useEffect(() => {
    scrollToBottom(false);
  }, [scrollToBottom]);

  // Realtime: new messages on this conversation only.
  useEffect(() => {
    const ch = supabase
      .channel(`convo:${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          const m = payload.new as Message;
          setMessages((cur) => {
            // De-dupe: a server insert may arrive after our optimistic copy.
            if (cur.some((x) => x.id === m.id)) return cur;
            // If we have a pending message with the same content/sender, replace it.
            const idx = cur.findIndex(
              (x) =>
                x.pending &&
                x.sender_id === m.sender_id &&
                (x.content ?? "") === (m.content ?? "") &&
                (x.image_path ?? "") === (m.image_path ?? ""),
            );
            if (idx >= 0) {
              const next = cur.slice();
              next[idx] = m;
              return next;
            }
            return [...cur, m];
          });
          setTimeout(() => scrollToBottom(true), 0);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          const id = (payload.old as { id: string }).id;
          setMessages((cur) => cur.filter((m) => m.id !== id));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [supabase, conversation.id, scrollToBottom]);

  function titleFor() {
    if (conversation.name) return conversation.name;
    if (conversation.is_group) return `${members.length} members`;
    const other = members.find((m) => m.id !== meId);
    return other?.display_name ?? "Direct chat";
  }

  function subtitleFor() {
    if (conversation.is_group) {
      return members.map((m) => m.display_name).join(", ");
    }
    const other = members.find((m) => m.id !== meId);
    return other ? "@" + other.username : "";
  }

  async function deleteMessage(id: string) {
    setMessages((cur) => cur.filter((m) => m.id !== id));
    await supabase.from("messages").delete().eq("id", id);
  }

  async function sendText(text: string) {
    const tempId = "tmp_" + Math.random().toString(36).slice(2);
    const optimistic: Message = {
      id: tempId,
      sender_id: meId,
      content: text,
      image_path: null,
      created_at: new Date().toISOString(),
      pending: true,
    };
    setMessages((cur) => [...cur, optimistic]);
    setTimeout(() => scrollToBottom(true), 0);
    const { error } = await supabase
      .from("messages")
      .insert({ conversation_id: conversation.id, sender_id: meId, content: text });
    if (error) {
      setMessages((cur) =>
        cur.map((m) => (m.id === tempId ? { ...m, pending: false, content: (m.content ?? "") + "  (failed)" } : m)),
      );
    }
  }

  async function sendImage(file: File) {
    const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
    const path = `${conversation.id}/${crypto.randomUUID()}.${ext}`;
    const tempId = "tmp_" + Math.random().toString(36).slice(2);
    const optimistic: Message = {
      id: tempId,
      sender_id: meId,
      content: null,
      image_path: path,
      created_at: new Date().toISOString(),
      pending: true,
    };
    setMessages((cur) => [...cur, optimistic]);
    setTimeout(() => scrollToBottom(true), 0);
    const { error: upErr } = await supabase.storage.from("chat-images").upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (upErr) {
      setMessages((cur) => cur.filter((m) => m.id !== tempId));
      alert("Upload failed: " + upErr.message);
      return;
    }
    const { error: insErr } = await supabase
      .from("messages")
      .insert({ conversation_id: conversation.id, sender_id: meId, image_path: path });
    if (insErr) {
      setMessages((cur) => cur.filter((m) => m.id !== tempId));
      alert("Send failed: " + insErr.message);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center justify-between border-b border-black/5 bg-white/40 px-4 py-3 backdrop-blur-md dark:border-white/5 dark:bg-ink-900/30">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{titleFor()}</div>
          <div className="truncate text-xs text-ink-500">{subtitleFor()}</div>
        </div>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="grid h-full place-items-center text-sm text-ink-500">
            Say hi 👋
          </div>
        )}
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const groupedWithPrev =
            prev && prev.sender_id === m.sender_id &&
            new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60 * 1000;
          const mine = m.sender_id === meId;
          return (
            <MessageBubble
              key={m.id}
              message={m}
              author={memberById[m.sender_id]}
              isMe={mine}
              compact={!!groupedWithPrev}
              onDelete={mine && !m.pending ? () => deleteMessage(m.id) : undefined}
            />
          );
        })}
      </div>

      <Composer onText={sendText} onImage={sendImage} />
    </div>
  );
}
