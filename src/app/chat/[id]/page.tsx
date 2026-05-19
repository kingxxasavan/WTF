import { redirect, notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ConversationView } from "@/components/conversation-view";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch conversation + members + recent messages in parallel.
  const [convoRes, membersRes, messagesRes] = await Promise.all([
    supabase.from("conversations").select("id, is_group, name, created_by, last_message_at").eq("id", id).single(),
    supabase
      .from("conversation_members")
      .select("user_id, profiles:profiles!conversation_members_user_id_fkey(id, username, display_name, avatar_url)")
      .eq("conversation_id", id),
    supabase
      .from("messages")
      .select("id, sender_id, content, image_path, created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true })
      .limit(100),
  ]);

  if (convoRes.error || !convoRes.data) notFound();

  const members = (membersRes.data ?? [])
    // The join returns profiles as either an object or array depending on the
    // generated types — normalize.
    .map((m: { user_id: string; profiles: unknown }) => {
      const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      return p as { id: string; username: string; display_name: string; avatar_url: string | null };
    })
    .filter(Boolean);

  return (
    <ConversationView
      meId={user.id}
      conversation={convoRes.data}
      members={members}
      initialMessages={messagesRes.data ?? []}
    />
  );
}
