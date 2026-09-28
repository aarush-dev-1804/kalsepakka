"use client";

import { RequireAuth } from "@/components/RequireAuth";
import { Header } from "@/components/Header";
import { useAuth } from "@/components/AuthProvider";
import { displayName } from "@/lib/constants";

export default function Home() {
  return (
    <RequireAuth>
      <Header />
      <HomeContent />
    </RequireAuth>
  );
}

function HomeContent() {
  const { user } = useAuth();

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="font-pixel text-lg sm:text-2xl text-neon leading-relaxed glow-text">
        WELCOME, {displayName(user ?? "").toUpperCase()}
      </h1>
      <p className="mt-4 text-white/70">You&apos;re in. Subjects are coming in the next step.</p>
    </main>
  );
}
