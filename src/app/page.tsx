import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function Landing() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/chat");

  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 font-semibold">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent" />
          <span className="tracking-wide">WTF</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/login" className="btn-ghost">Sign in</Link>
          <Link href="/signup" className="btn-primary">Get started</Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 pt-10 pb-24 md:grid-cols-2 md:pt-20">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
            Messages that
            <span className="block bg-gradient-to-r from-accent to-blue-500 bg-clip-text text-transparent">
              feel quiet.
            </span>
          </h1>
          <p className="mt-5 max-w-md text-base text-ink-600 dark:text-ink-300">
            A clean, fast messenger for people you actually want to talk to.
            One‑to‑one chats, groups, photos. Dark or light, your call.
          </p>
          <div className="mt-7 flex gap-3">
            <Link href="/signup" className="btn-primary">Create an account</Link>
            <Link href="/login" className="btn-ghost border border-ink-200 dark:border-ink-700">I have an account</Link>
          </div>
        </div>

        <div className="panel p-4 animate-in">
          <div className="flex items-center gap-3 border-b border-black/5 px-2 pb-3 dark:border-white/5">
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-accent to-blue-500" />
            <div>
              <div className="text-sm font-semibold">Riley</div>
              <div className="text-xs text-ink-500">online</div>
            </div>
          </div>
          <div className="space-y-2 px-2 pt-3">
            <div className="flex"><div className="bubble bubble-them max-w-[80%]">heyyy did you see the new place</div></div>
            <div className="flex justify-end"><div className="bubble bubble-me max-w-[80%]">yes — let's go saturday</div></div>
            <div className="flex"><div className="bubble bubble-them max-w-[80%]">bet 🤝</div></div>
          </div>
        </div>
      </section>
    </main>
  );
}
