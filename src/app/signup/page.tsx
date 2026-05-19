import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { ThemeToggle } from "@/components/theme-toggle";

export default function SignupPage() {
  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent" />
          <span className="tracking-wide">WTF</span>
        </Link>
        <ThemeToggle />
      </header>
      <section className="mx-auto max-w-md px-6 pt-6 pb-20">
        <div className="panel p-6">
          <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
          <p className="mt-1 text-sm text-ink-500">Pick a username — it's how friends find you.</p>
          <div className="mt-6">
            <AuthForm mode="signup" />
          </div>
          <p className="mt-5 text-sm text-ink-500">
            Already have one? <Link className="text-accent hover:underline" href="/login">Sign in</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
