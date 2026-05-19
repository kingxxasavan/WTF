-- Run this in the Supabase SQL editor for a fresh project.
-- It creates profiles, contacts, conversations, members, and messages,
-- locks them down with RLS, and wires up an image-storage bucket.

create extension if not exists citext;
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Profiles
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username citext unique not null,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop policy if exists "profiles are readable to authed" on public.profiles;
create policy "profiles are readable to authed"
on public.profiles for select to authenticated using (true);

drop policy if exists "users update their own profile" on public.profiles;
create policy "users update their own profile"
on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "users insert their own profile" on public.profiles;
create policy "users insert their own profile"
on public.profiles for insert to authenticated
with check (id = auth.uid());

-- ----------------------------------------------------------------------------
-- Contacts
-- ----------------------------------------------------------------------------
create table if not exists public.contacts (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  contact_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, contact_id),
  check (owner_id <> contact_id)
);
alter table public.contacts enable row level security;

drop policy if exists "owner reads contacts" on public.contacts;
create policy "owner reads contacts"
on public.contacts for select to authenticated
using (owner_id = auth.uid());

drop policy if exists "owner manages contacts" on public.contacts;
create policy "owner manages contacts"
on public.contacts for all to authenticated
using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Conversations + membership
-- ----------------------------------------------------------------------------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  is_group boolean not null default false,
  name text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
alter table public.conversations enable row level security;

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
alter table public.conversation_members enable row level security;

-- Helper to avoid recursive RLS when checking membership.
create or replace function public.is_member(c uuid, u uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = c and user_id = u
  );
$$;

drop policy if exists "members can read conversation" on public.conversations;
create policy "members can read conversation"
on public.conversations for select to authenticated
using (public.is_member(id, auth.uid()));

drop policy if exists "any authed user creates conversation" on public.conversations;
create policy "any authed user creates conversation"
on public.conversations for insert to authenticated
with check (created_by = auth.uid());

drop policy if exists "members update last_message_at and name" on public.conversations;
create policy "members update last_message_at and name"
on public.conversations for update to authenticated
using (public.is_member(id, auth.uid()))
with check (public.is_member(id, auth.uid()));

drop policy if exists "read your memberships" on public.conversation_members;
create policy "read your memberships"
on public.conversation_members for select to authenticated
using (user_id = auth.uid() or public.is_member(conversation_id, auth.uid()));

drop policy if exists "insert members" on public.conversation_members;
create policy "insert members"
on public.conversation_members for insert to authenticated
with check (
  -- you can add yourself to a brand-new conversation you just created,
  -- OR you can add others to a conversation you're already in (groups)
  user_id = auth.uid()
  or public.is_member(conversation_id, auth.uid())
);

drop policy if exists "leave conversation" on public.conversation_members;
create policy "leave conversation"
on public.conversation_members for delete to authenticated
using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Messages
-- ----------------------------------------------------------------------------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text,
  image_path text,
  created_at timestamptz not null default now(),
  check (coalesce(content, '') <> '' or image_path is not null)
);
create index if not exists messages_convo_created_idx
  on public.messages (conversation_id, created_at);
alter table public.messages enable row level security;

drop policy if exists "members read messages" on public.messages;
create policy "members read messages"
on public.messages for select to authenticated
using (public.is_member(conversation_id, auth.uid()));

drop policy if exists "members send messages" on public.messages;
create policy "members send messages"
on public.messages for insert to authenticated
with check (
  sender_id = auth.uid()
  and public.is_member(conversation_id, auth.uid())
);

drop policy if exists "sender deletes own messages" on public.messages;
create policy "sender deletes own messages"
on public.messages for delete to authenticated
using (sender_id = auth.uid());

-- Keep conversation.last_message_at in sync.
create or replace function public.touch_conversation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations
    set last_message_at = new.created_at
    where id = new.conversation_id;
  return new;
end $$;
drop trigger if exists touch_conversation_t on public.messages;
create trigger touch_conversation_t
after insert on public.messages
for each row execute function public.touch_conversation();

-- ----------------------------------------------------------------------------
-- Auto-create a profile row when a user signs up
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Realtime
-- ----------------------------------------------------------------------------
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.conversation_members;

-- ----------------------------------------------------------------------------
-- Storage: chat-images bucket. Path layout: <conversation_id>/<uuid>.<ext>
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('chat-images', 'chat-images', false)
on conflict (id) do nothing;

drop policy if exists "members read images" on storage.objects;
create policy "members read images"
on storage.objects for select to authenticated
using (
  bucket_id = 'chat-images'
  and public.is_member((split_part(name, '/', 1))::uuid, auth.uid())
);

drop policy if exists "members upload images" on storage.objects;
create policy "members upload images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'chat-images'
  and public.is_member((split_part(name, '/', 1))::uuid, auth.uid())
  and owner = auth.uid()
);

drop policy if exists "uploader deletes images" on storage.objects;
create policy "uploader deletes images"
on storage.objects for delete to authenticated
using (bucket_id = 'chat-images' and owner = auth.uid());
