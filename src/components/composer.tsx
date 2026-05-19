"use client";

import { useRef, useState } from "react";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function Composer({
  onText,
  onImage,
}: {
  onText: (text: string) => void | Promise<void>;
  onImage: (file: File) => void | Promise<void>;
}) {
  const [value, setValue] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  function send() {
    const t = value.trim();
    if (!t) return;
    setValue("");
    if (taRef.current) taRef.current.style.height = "auto";
    onText(t);
  }

  function autosize(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function pickImage() {
    fileRef.current?.click();
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!ACCEPTED.includes(f.type)) {
      alert("Unsupported image type.");
      return;
    }
    if (f.size > MAX_IMAGE_BYTES) {
      alert("Image is too large (8 MB max).");
      return;
    }
    onImage(f);
  }

  return (
    <footer className="border-t border-black/5 bg-white/40 px-3 py-3 backdrop-blur-md dark:border-white/5 dark:bg-ink-900/30">
      <div className="flex items-end gap-2">
        <button
          onClick={pickImage}
          className="btn-ghost h-10 w-10 !p-0"
          aria-label="Send image"
          title="Send image"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="9" cy="11" r="2" />
            <path d="m21 17-5-5-9 9" />
          </svg>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED.join(",")}
          className="hidden"
          onChange={handleFile}
        />
        <textarea
          ref={taRef}
          rows={1}
          value={value}
          onChange={autosize}
          onKeyDown={onKeyDown}
          placeholder="Write a message…"
          className="input max-h-40 resize-none py-2.5"
        />
        <button onClick={send} className="btn-primary h-10 px-4" disabled={!value.trim()}>
          Send
        </button>
      </div>
    </footer>
  );
}
