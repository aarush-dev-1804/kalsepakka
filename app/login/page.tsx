"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function LoginPage() {
  const { user, ready, login } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (ready && user) router.replace("/");
  }, [ready, user, router]);

  function triggerShake() {
    setShake(true);
    setTimeout(() => setShake(false), 450);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Type your name first.");
      triggerShake();
      return;
    }
    if (login(name)) {
      router.replace("/");
    } else {
      setError("Access denied. You're not on the squad list.");
      triggerShake();
    }
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center px-4 py-10 overflow-hidden">
      <span className="pointer-events-none absolute top-[12%] left-[10%] text-4xl opacity-40 animate-float">📚</span>
      <span className="pointer-events-none absolute top-[20%] right-[12%] text-3xl opacity-40 animate-float [animation-delay:1s]">🧠</span>
      <span className="pointer-events-none absolute bottom-[18%] left-[14%] text-3xl opacity-40 animate-float [animation-delay:2s]">📝</span>
      <span className="pointer-events-none absolute bottom-[12%] right-[10%] text-4xl opacity-40 animate-float [animation-delay:3s]">🎮</span>

      <div className={`relative w-full max-w-md ${shake ? "animate-shake" : ""}`}>
        <div className="text-center mb-8">
          <p className="font-pixel text-[10px] text-cyan tracking-widest mb-5">VIT VELLORE · SQUAD ONLY</p>
          <h1 className="font-pixel text-2xl sm:text-3xl text-neon leading-relaxed glow-text">KALSEPAKKA</h1>
          <p className="mt-4 text-sm text-white/60">VTOP notes, teacher material and AI stuff, all in one vault.</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 sm:p-8">
          <label htmlFor="name" className="font-pixel text-[10px] text-pink block mb-4 leading-relaxed">
            INSERT NAME TO CONTINUE<span className="animate-blink">_</span>
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError("");
            }}
            placeholder="your first name"
            autoComplete="off"
            autoFocus
            maxLength={20}
            className="w-full rounded-xl bg-ink border-2 border-edge px-4 py-3 text-lg outline-none transition focus:border-cyan"
          />
          {error && <p className="mt-3 text-sm text-pink">{error}</p>}
          <button type="submit" className="btn-arcade w-full mt-6">
            PRESS START ▶
          </button>
        </form>

        <p className="text-center text-xs text-white/40 mt-6">Just your first name. No password.</p>
      </div>
    </main>
  );
}
