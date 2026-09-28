"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { displayName } from "@/lib/constants";

export function Header() {
  const { user, logout } = useAuth();
  const router = useRouter();

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-20 border-b-2 border-edge bg-ink/80 backdrop-blur">
      <div className="mx-auto max-w-6xl flex items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="font-pixel text-xs sm:text-sm text-neon glow-text">
          KALSEPAKKA
        </Link>
        {user && (
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-sm text-white/70">
              Player: <span className="text-mint font-semibold">{displayName(user)}</span>
            </span>
            <button onClick={handleLogout} className="btn-ghost">
              Log out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
