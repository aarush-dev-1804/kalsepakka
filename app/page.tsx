"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Header } from "@/components/Header";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import { displayName } from "@/lib/constants";

type Subject = {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  resources: { count: number }[];
};

const ACCENTS = ["#ffd23f", "#ff5da2", "#3de8ff", "#5cffb0"];

export default function Home() {
  return (
    <RequireAuth>
      <Header />
      <SubjectsBoard />
    </RequireAuth>
  );
}

function SubjectsBoard() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    supabase
      .from("subjects")
      .select("id, name, created_by, created_at, resources(count)")
      .order("name")
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setError("Couldn't load subjects. Check your connection.");
        else setSubjects((data ?? []) as Subject[]);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshKey]);

  async function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = newName.trim().replace(/\s+/g, " ");
    if (!name || !user) return;
    if (name.length > 40) {
      setError("Keep the subject name under 40 characters.");
      return;
    }
    setAdding(true);
    setError("");
    const { error } = await supabase.from("subjects").insert({ name, created_by: user });
    setAdding(false);
    if (error) {
      setError(error.code === "23505" ? `"${name}" already exists.` : "Couldn't add the subject. Try again.");
      return;
    }
    setNewName("");
    setRefreshKey((k) => k + 1);
  }

  async function handleDelete(subject: Subject) {
    const count = subject.resources[0]?.count ?? 0;
    const ok = window.confirm(
      count > 0
        ? `Delete "${subject.name}" and its ${count} file(s)? This can't be undone.`
        : `Delete "${subject.name}"?`
    );
    if (!ok) return;
    setDeletingId(subject.id);
    setError("");
    const { data: files } = await supabase.from("resources").select("file_path").eq("subject_id", subject.id);
    const paths = (files ?? []).map((f) => f.file_path as string);
    if (paths.length > 0) await supabase.storage.from("resources").remove(paths);
    const { error } = await supabase.from("subjects").delete().eq("id", subject.id);
    setDeletingId(null);
    if (error) {
      setError("Couldn't delete the subject. Try again.");
      return;
    }
    setSubjects((prev) => prev.filter((s) => s.id !== subject.id));
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <section className="mb-10">
        <p className="font-pixel text-[10px] text-cyan tracking-widest">
          PLAYER {displayName(user ?? "").toUpperCase()} · READY
        </p>
        <h1 className="mt-4 font-pixel text-xl sm:text-3xl text-neon leading-relaxed glow-text">SELECT A SUBJECT</h1>
        <p className="mt-3 text-white/60">
          Every subject has 3 folders: VTOP material, teacher&apos;s material and AI material.
        </p>
      </section>

      <form onSubmit={handleAdd} className="card p-4 sm:p-5 mb-8 flex flex-col sm:flex-row gap-3">
        <input
          value={newName}
          onChange={(e) => {
            setNewName(e.target.value);
            if (error) setError("");
          }}
          placeholder="New subject, e.g. Calculus"
          maxLength={40}
          className="flex-1 rounded-xl bg-ink border-2 border-edge px-4 py-3 outline-none transition focus:border-cyan"
        />
        <button type="submit" disabled={adding || !newName.trim()} className="btn-arcade">
          {adding ? "ADDING..." : "+ ADD SUBJECT"}
        </button>
      </form>

      {error && <p className="mb-6 text-sm text-pink">{error}</p>}

      {loading ? (
        <p className="font-pixel text-xs text-cyan">
          LOADING<span className="animate-blink">...</span>
        </p>
      ) : subjects.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-5xl mb-4 animate-float">🗂️</p>
          <p className="font-pixel text-xs text-pink leading-relaxed">NO SUBJECTS YET</p>
          <p className="mt-3 text-white/60">Add your first subject above.</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((subject, i) => {
            const accent = ACCENTS[i % ACCENTS.length];
            const count = subject.resources[0]?.count ?? 0;
            return (
              <div
                key={subject.id}
                className="card relative overflow-hidden transition hover:-translate-y-1"
                style={{ borderColor: accent }}
              >
                <div className="h-2" style={{ background: accent }} />
                <Link href={`/subject/${subject.id}`} className="block p-5 pr-14">
                  <p className="font-pixel text-[10px] text-white/50">LEVEL {String(i + 1).padStart(2, "0")}</p>
                  <h2 className="mt-3 text-xl font-bold wrap-break-words" style={{ color: accent }}>
                    {subject.name}
                  </h2>
                  <p className="mt-2 text-sm text-white/60">
                    {count} file{count === 1 ? "" : "s"} · 3 folders
                  </p>
                  <p className="mt-1 text-xs text-white/40">added by {displayName(subject.created_by)}</p>
                </Link>
                <button
                  onClick={() => handleDelete(subject)}
                  disabled={deletingId === subject.id}
                  aria-label={`Delete ${subject.name}`}
                  className="absolute top-5 right-4 rounded-lg border-2 border-edge px-2 py-1 text-xs text-white/60 transition hover:border-pink hover:text-pink"
                >
                  {deletingId === subject.id ? "..." : "✕"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
