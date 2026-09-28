"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { RequireAuth } from "@/components/RequireAuth";
import { Header } from "@/components/Header";
import { supabase } from "@/lib/supabase";
import { FOLDERS, FolderKey, displayName } from "@/lib/constants";

type SubjectInfo = { id: string; name: string; created_by: string };

const FOLDER_ACCENTS: Record<FolderKey, string> = {
  vtop: "#3de8ff",
  teacher: "#ff5da2",
  ai: "#5cffb0",
};

export default function SubjectPage() {
  return (
    <RequireAuth>
      <Header />
      <SubjectFolders />
    </RequireAuth>
  );
}

function SubjectFolders() {
  const { id } = useParams<{ id: string }>();
  const [subject, setSubject] = useState<SubjectInfo | null>(null);
  const [counts, setCounts] = useState<Record<FolderKey, number>>({ vtop: 0, teacher: 0, ai: 0 });
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    let active = true;

    async function load() {
      const { data: subjectData } = await supabase
        .from("subjects")
        .select("id, name, created_by")
        .eq("id", id)
        .maybeSingle();
      if (!active) return;
      if (!subjectData) {
        setStatus("missing");
        return;
      }
      const { data: files } = await supabase.from("resources").select("folder").eq("subject_id", id);
      if (!active) return;
      const next: Record<FolderKey, number> = { vtop: 0, teacher: 0, ai: 0 };
      (files ?? []).forEach((f) => {
        const key = f.folder as FolderKey;
        if (key in next) next[key] += 1;
      });
      setSubject(subjectData as SubjectInfo);
      setCounts(next);
      setStatus("ready");
    }

    void load();
    return () => {
      active = false;
    };
  }, [id]);

  if (status === "loading") {
    return (
      <main className="mx-auto max-w-6xl px-4 py-16">
        <p className="font-pixel text-xs text-cyan">
          LOADING<span className="animate-blink">...</span>
        </p>
      </main>
    );
  }

  if (status === "missing" || !subject) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-16 text-center">
        <p className="text-5xl mb-4">👻</p>
        <p className="font-pixel text-sm text-pink leading-relaxed">SUBJECT NOT FOUND</p>
        <p className="mt-3 text-white/60">It may have been deleted.</p>
        <Link href="/" className="btn-arcade inline-block mt-8">
          ◀ BACK TO SUBJECTS
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <Link href="/" className="text-sm text-white/60 transition hover:text-cyan">
        ◀ All subjects
      </Link>
      <h1 className="mt-6 font-pixel text-lg sm:text-2xl text-neon leading-relaxed glow-text wrap-break-words">
        {subject.name.toUpperCase()}
      </h1>
      <p className="mt-3 text-sm text-white/50">added by {displayName(subject.created_by)}</p>

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {FOLDERS.map((folder) => {
          const accent = FOLDER_ACCENTS[folder.key];
          const count = counts[folder.key];
          return (
            <Link
              key={folder.key}
              href={`/subject/${id}/${folder.key}`}
              className="card group block p-6 transition hover:-translate-y-1"
              style={{ borderColor: accent }}
            >
              <div className="text-5xl transition group-hover:scale-110">{folder.emoji}</div>
              <h2 className="mt-5 font-pixel text-[11px] leading-relaxed" style={{ color: accent }}>
                {folder.label.toUpperCase()}
              </h2>
              <p className="mt-3 text-sm text-white/60">
                {count} file{count === 1 ? "" : "s"}
              </p>
              <p className="mt-6 text-sm font-semibold" style={{ color: accent }}>
                Open folder ▶
              </p>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
