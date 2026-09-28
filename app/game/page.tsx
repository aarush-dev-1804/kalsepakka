"use client";

import { useEffect, useRef, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Header } from "@/components/Header";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import { displayName } from "@/lib/constants";
import { COLS, ROWS, UP, DOWN, LEFT, RIGHT, Dir, Game, GameStatus, createGame, draw, update } from "@/lib/game";

type ScoreRow = { name: string; high_score: number };
type Controls = { turn: (d: Dir) => void; start: () => void };

const KEYS: Record<string, Dir> = {
  ArrowUp: UP,
  ArrowDown: DOWN,
  ArrowLeft: LEFT,
  ArrowRight: RIGHT,
  w: UP,
  s: DOWN,
  a: LEFT,
  d: RIGHT,
  W: UP,
  S: DOWN,
  A: LEFT,
  D: RIGHT,
};

const MEDALS = ["🥇", "🥈", "🥉"];

export default function GamePage() {
  return (
    <RequireAuth>
      <Header />
      <Arcade />
    </RequireAuth>
  );
}

function Arcade() {
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<Controls | null>(null);
  const bestRef = useRef(0);

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [status, setStatus] = useState<GameStatus>("ready");
  const [best, setBest] = useState(0);
  const [board, setBoard] = useState<ScoreRow[]>([]);
  const [boardKey, setBoardKey] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [newBest, setNewBest] = useState(false);

  useEffect(() => {
    let active = true;
    supabase
      .from("scores")
      .select("name, high_score")
      .order("high_score", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (!active) return;
        const rows = (data ?? []) as ScoreRow[];
        const mine = rows.find((row) => row.name === user)?.high_score ?? 0;
        bestRef.current = Math.max(bestRef.current, mine);
        setBoard(rows);
        setBest(bestRef.current);
      });
    return () => {
      active = false;
    };
  }, [user, boardKey]);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    const wrapEl = wrapRef.current;
    const context = canvasEl?.getContext("2d");
    if (!canvasEl || !wrapEl || !context || !user) return;

    const canvas: HTMLCanvasElement = canvasEl;
    const wrap: HTMLDivElement = wrapEl;
    const ctx: CanvasRenderingContext2D = context;
    const player = user;
    const font = getComputedStyle(document.documentElement).getPropertyValue("--font-press").trim() || "monospace";
    let g: Game = createGame();
    let tile = 20;
    let raf = 0;
    let prev = performance.now();
    let touchStart: { x: number; y: number } | null = null;
    const last = { score: g.score, lives: g.lives, level: g.level, status: g.status };

    function resize() {
      const width = Math.min(wrap.clientWidth, 560);
      tile = Math.max(10, Math.floor(width / COLS));
      const dpr = window.devicePixelRatio || 1;
      canvas.width = COLS * tile * dpr;
      canvas.height = ROWS * tile * dpr;
      canvas.style.width = `${COLS * tile}px`;
      canvas.style.height = `${ROWS * tile}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function start() {
      if (g.status !== "ready" && g.status !== "over") return;
      g = createGame();
      g.status = "playing";
      setNewBest(false);
    }

    function turn(d: Dir) {
      if (g.status === "ready") start();
      g.player.want = d;
    }

    function sync() {
      if (g.score !== last.score) {
        last.score = g.score;
        setScore(g.score);
      }
      if (g.lives !== last.lives) {
        last.lives = g.lives;
        setLives(g.lives);
      }
      if (g.level !== last.level) {
        last.level = g.level;
        setLevel(g.level);
      }
      if (g.status !== last.status) {
        last.status = g.status;
        setStatus(g.status);
        if (g.status === "over") {
          const final = g.score;
          setFinalScore(final);
          setNewBest(final > bestRef.current);
          supabase.rpc("submit_score", { p_name: player, p_score: final }).then(({ data }) => {
            if (typeof data === "number") {
              bestRef.current = data;
              setBest(data);
            }
            setBoardKey((k) => k + 1);
          });
        }
      }
    }

    function frame(now: number) {
      const dt = Math.min((now - prev) / 1000, 0.05);
      prev = now;
      update(g, dt);
      draw(ctx, g, tile, now / 1000, font);
      sync();
      raf = requestAnimationFrame(frame);
    }

    function onKey(e: KeyboardEvent) {
      const d = KEYS[e.key];
      if (d) {
        e.preventDefault();
        turn(d);
        return;
      }
      if ((e.key === "Enter" || e.key === " ") && (g.status === "ready" || g.status === "over")) {
        e.preventDefault();
        start();
      }
    }

    function onTouchStart(e: TouchEvent) {
      const t = e.touches[0];
      touchStart = { x: t.clientX, y: t.clientY };
    }

    function onTouchEnd(e: TouchEvent) {
      if (!touchStart) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStart.x;
      const dy = t.clientY - touchStart.y;
      touchStart = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
      turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? RIGHT : LEFT) : dy > 0 ? DOWN : UP);
    }

    controlsRef.current = { turn, start };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);
    window.addEventListener("keydown", onKey);
    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchend", onTouchEnd);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("keydown", onKey);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchend", onTouchEnd);
      controlsRef.current = null;
    };
  }, [user]);

  const showBest = Math.max(best, score);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <p className="font-pixel text-[10px] text-cyan tracking-widest">KALSEPAKKA ARCADE</p>
        <h1 className="mt-3 font-pixel text-lg sm:text-2xl text-neon leading-relaxed glow-text">ATTENDANCE RUN</h1>
        <p className="mt-2 text-sm text-white/60">
          Grab every attendance point. Dodge CAT1, CAT2, FAT and DA. Chai lets you clear them.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section>
          <div className="mx-auto mb-3 grid max-w-[560px] grid-cols-4 gap-2">
            <Stat label="SCORE" value={score.toLocaleString("en-IN")} color="#ffd23f" />
            <Stat label="SEM" value={String(level)} color="#3de8ff" />
            <Stat label="LIVES" value={lives > 0 ? "🎓".repeat(lives) : "—"} color="#5cffb0" />
            <Stat label="BEST" value={showBest.toLocaleString("en-IN")} color="#ff5da2" />
          </div>

          <div ref={wrapRef} className="relative mx-auto w-full max-w-[560px]">
            <canvas ref={canvasRef} className="mx-auto block touch-none rounded-xl border-2 border-edge" />

            {status === "ready" && (
              <Overlay>
                <p className="text-5xl animate-float">🎓</p>
                <p className="mt-4 font-pixel text-sm text-neon leading-relaxed">READY, {displayName(user ?? "").toUpperCase()}?</p>
                <p className="mt-3 max-w-xs text-sm text-white/70">
                  Arrow keys or WASD on laptop. Swipe or use the pad on phone.
                </p>
                <button onClick={() => controlsRef.current?.start()} className="btn-arcade mt-6">
                  START ▶
                </button>
              </Overlay>
            )}

            {status === "over" && (
              <Overlay>
                <p className="font-pixel text-lg text-pink leading-relaxed">GAME OVER</p>
                <p className="mt-4 text-white/70">You scored</p>
                <p className="font-pixel text-2xl text-neon mt-2">{finalScore.toLocaleString("en-IN")}</p>
                {newBest ? (
                  <p className="mt-4 font-pixel text-[10px] text-mint leading-relaxed animate-blink">NEW HIGH SCORE!</p>
                ) : (
                  <p className="mt-4 text-sm text-white/60">Your best: {best.toLocaleString("en-IN")}</p>
                )}
                <button onClick={() => controlsRef.current?.start()} className="btn-arcade mt-6">
                  PLAY AGAIN ▶
                </button>
              </Overlay>
            )}
          </div>

          <div className="mx-auto mt-5 grid w-44 grid-cols-3 gap-2 lg:hidden">
            <span />
            <PadButton label="▲" onPress={() => controlsRef.current?.turn(UP)} />
            <span />
            <PadButton label="◀" onPress={() => controlsRef.current?.turn(LEFT)} />
            <PadButton label="▼" onPress={() => controlsRef.current?.turn(DOWN)} />
            <PadButton label="▶" onPress={() => controlsRef.current?.turn(RIGHT)} />
          </div>
        </section>

        <aside className="space-y-5">
          <div className="card p-5">
            <h2 className="font-pixel text-[11px] text-neon leading-relaxed">HALL OF FAME</h2>
            {board.length === 0 ? (
              <p className="mt-4 text-sm text-white/50">No scores yet. Be the first.</p>
            ) : (
              <ol className="mt-4 space-y-2">
                {board.map((row, i) => (
                  <li
                    key={row.name}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                      row.name === user ? "border-2 border-mint bg-mint/10" : "border-2 border-transparent"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-6 text-center">{MEDALS[i] ?? `${i + 1}.`}</span>
                      <span className={row.name === user ? "font-semibold text-mint" : ""}>{displayName(row.name)}</span>
                    </span>
                    <span className="font-pixel text-[10px] text-neon">{row.high_score.toLocaleString("en-IN")}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="card p-5 text-sm text-white/70">
            <h2 className="font-pixel text-[11px] text-cyan leading-relaxed">HOW TO PLAY</h2>
            <ul className="mt-4 space-y-2">
              <li>🟨 Attendance point: 10</li>
              <li>☕ Chai: 50, and exams panic for a few seconds</li>
              <li>📝 Clearing a panicked exam: 200, 400, 800, 1600</li>
              <li>🏁 Clearing the whole sem: 500 bonus</li>
              <li>🎓 You get 3 lives. Each sem gets faster.</li>
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="card px-2 py-2 text-center">
      <p className="font-pixel text-[8px] text-white/50">{label}</p>
      <p className="mt-1 truncate font-pixel text-[10px] sm:text-xs" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 mx-auto flex max-w-full flex-col items-center justify-center rounded-xl bg-ink/85 px-6 text-center backdrop-blur-sm">
      {children}
    </div>
  );
}

function PadButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.preventDefault();
        onPress();
      }}
      className="aspect-square rounded-xl border-2 border-edge bg-panel text-xl text-cyan transition active:scale-95 active:border-cyan"
    >
      {label}
    </button>
  );
}
