# WTF

A clean, fast messenger. Next.js 15 + Supabase + Tailwind, ready to deploy on Vercel.

- Email + password accounts with display name and username
- Find people by username, add them as contacts
- 1‑to‑1 chats and group chats with realtime delivery
- Text and image messages
- Encrypted in transit (TLS) and at rest (Supabase managed Postgres + Storage)
- Dark and light themes

> Note on encryption: messages and images are encrypted at rest by Supabase
> (AES‑256, managed keys) and in transit by HTTPS. They are not end‑to‑end
> encrypted — the database can decrypt them. If you need E2EE, that's a bigger
> change to the schema and client.

## 1. Create the Supabase project

1. Make a free project at <https://supabase.com>.
2. In the SQL editor, paste the contents of `supabase/schema.sql` and run it.
   This creates `profiles`, `contacts`, `conversations`, `conversation_members`,
   `messages`, enables RLS, wires realtime, and creates the `chat-images`
   storage bucket with policies.
3. In **Auth → Providers → Email**, optionally turn off "Confirm email" while
   testing.
4. Copy your **Project URL** and **anon public key** from **Project settings →
   API**.

## 2. Run locally

```bash
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
npm install
npm run dev
```

Open <http://localhost:3000>, sign up, then sign up again in a second browser
to test messaging between two accounts.

## 3. Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel, **New Project → Import** the repo.
3. Add the two env vars (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`) for both Production and Preview.
4. Deploy. Add your Vercel URL to **Auth → URL Configuration → Site URL** and
   to "Redirect URLs" in Supabase.

## Architecture

- `src/app/` — App Router pages (`/`, `/login`, `/signup`, `/chat`, `/chat/[id]`)
- `src/components/` — UI: `chat-shell`, `chat-sidebar`, `conversation-view`,
  `message-bubble`, `composer`, `new-chat-dialog`, `auth-form`, `theme-toggle`
- `src/lib/supabase/` — browser, server, and middleware clients (cookie‑based
  SSR auth via `@supabase/ssr`)
- `middleware.ts` — refreshes the session and gates `/chat` behind auth
- `supabase/schema.sql` — tables, RLS policies, triggers, realtime, storage
