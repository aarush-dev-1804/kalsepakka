"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { displayName } from "@/lib/constants";

const NAV = [
  { href: "/", label: "📚 Subjects" },
  { href: "/game", label: "🎮 Arcade" },
];

export function Header() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  function isActive(href: string) {
    if (href === "/") return pathname === "/" || pathname.startsWith("/subject");
    return pathname.startsWith(href);
  }

  return (
    <header className="sticky top-0 z-20 border-b-2 border-edge bg-ink/80 backdrop-blur">
      <div className="mx-auto max-w-6xl flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-4 sm:gap-6">
          <Link href="/" className="font-pixel text-xs sm:text-sm text-neon glow-text">
            KALSEPAKKA
          </Link>
          <nav className="flex gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-2 sm:px-3 py-1 text-xs sm:text-sm transition ${
                  isActive(item.href) ? "bg-panel text-cyan border-2 border-cyan" : "border-2 border-transparent text-white/70 hover:text-cyan"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        {user && (
          <div className="flex items-center gap-3">
            <span className="hidden md:inline text-sm text-white/70">
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
