"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Message } from "./conversation-view";

type Author = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
} | undefined;

export function MessageBubble({
  message,
  author,
  isMe,
  compact,
  onDelete,
}: {
  message: Message;
  author: Author;
  isMe: boolean;
  compact: boolean;
  onDelete?: () => void;
}) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!message.image_path) return;
    const supabase = createSupabaseBrowserClient();
    (async () => {
      const { data } = await supabase.storage
        .from("chat-images")
        .createSignedUrl(message.image_path!, 60 * 60);
      if (!cancelled) setImgUrl(data?.signedUrl ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [message.image_path]);

  return (
    <div className={clsx("flex items-end gap-2", isMe && "flex-row-reverse")}>
      <div className="w-8 shrink-0">
        {!compact && !isMe && author && (
          <div
            className="grid h-8 w-8 place-items-center rounded-full text-[11px] font-semibold text-white"
            style={{
              background: `linear-gradient(135deg, hsl(${hashHue(author.username)} 80% 60%), hsl(${(hashHue(author.username) + 40) % 360} 70% 50%))`,
            }}
            title={author.display_name}
          >
            {author.username.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>
      <div className={clsx("max-w-[78%] space-y-1", isMe && "items-end")}>
        {!compact && !isMe && author && (
          <div className="px-1 text-[11px] text-ink-500">{author.display_name}</div>
        )}
        <div className="group relative">
          {message.content && (
            <div className={clsx("bubble", isMe ? "bubble-me" : "bubble-them")}>
              {message.content}
              {message.pending && <span className="ml-2 opacity-60">…</span>}
            </div>
          )}
          {message.image_path && (
            <div className="overflow-hidden rounded-2xl border border-black/5 dark:border-white/5">
              {imgUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imgUrl}
                  alt=""
                  className="max-h-80 w-auto max-w-full object-cover"
                />
              ) : (
                <div className="h-48 w-64 shimmer bg-ink-200/40 dark:bg-ink-800/40" />
              )}
            </div>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="absolute -top-2 -right-2 hidden h-6 w-6 place-items-center rounded-full bg-red-500 text-white shadow group-hover:grid"
              aria-label="Delete"
              title="Delete"
            >
              ×
            </button>
          )}
        </div>
        <div className={clsx("px-1 text-[10px] text-ink-500", isMe && "text-right")}>
          {fmt(message.created_at)}
        </div>
      </div>
    </div>
  );
}

function fmt(ts: string) {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function hashHue(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}
