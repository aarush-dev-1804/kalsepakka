"use client";

import Link from "next/link";
import { DragEvent, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { RequireAuth } from "@/components/RequireAuth";
import { Header } from "@/components/Header";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import { FOLDERS, FolderKey, MAX_FILE_SIZE, displayName } from "@/lib/constants";

type Resource = {
  id: string;
  subject_id: string;
  folder: FolderKey;
  title: string;
  file_path: string;
  file_url: string;
  file_size: number | null;
  uploaded_by: string;
  created_at: string;
};

const FOLDER_ACCENTS: Record<FolderKey, string> = {
  vtop: "#3de8ff",
  teacher: "#ff5da2",
  ai: "#5cffb0",
};

function fileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "📕";
  if (["ppt", "pptx", "key"].includes(ext)) return "📊";
  if (["doc", "docx", "txt", "md", "rtf"].includes(ext)) return "📄";
  if (["xls", "xlsx", "csv"].includes(ext)) return "📈";
  if (["png", "jpg", "jpeg", "gif", "webp", "heic"].includes(ext)) return "🖼️";
  if (["zip", "rar", "7z"].includes(ext)) return "🗜️";
  if (["mp4", "mov", "mkv", "webm"].includes(ext)) return "🎬";
  if (["mp3", "wav", "m4a"].includes(ext)) return "🎧";
  if (["py", "c", "cpp", "java", "js", "ts", "ipynb"].includes(ext)) return "💻";
  return "📁";
}

function formatSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function FolderPage() {
  return (
    <RequireAuth>
      <Header />
      <FolderView />
    </RequireAuth>
  );
}

function FolderView() {
  const { id, folder } = useParams<{ id: string; folder: string }>();
  const { user } = useAuth();
  const folderInfo = FOLDERS.find((f) => f.key === folder);
  const accent = folderInfo ? FOLDER_ACCENTS[folderInfo.key] : "#ffd23f";

  const [subjectName, setSubjectName] = useState("");
  const [files, setFiles] = useState<Resource[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");
  const [uploading, setUploading] = useState<{ current: number; total: number; name: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!folderInfo) return;
    let active = true;
    Promise.all([
      supabase.from("subjects").select("id, name").eq("id", id).maybeSingle(),
      supabase
        .from("resources")
        .select("*")
        .eq("subject_id", id)
        .eq("folder", folderInfo.key)
        .order("created_at", { ascending: false }),
    ]).then(([subjectRes, filesRes]) => {
      if (!active) return;
      if (!subjectRes.data) {
        setStatus("missing");
        return;
      }
      setSubjectName(subjectRes.data.name as string);
      setFiles((filesRes.data ?? []) as Resource[]);
      setStatus("ready");
    });
    return () => {
      active = false;
    };
  }, [id, folderInfo]);

  async function uploadFiles(fileList: FileList | File[]) {
    if (!user || !folderInfo || uploading) return;
    const picked = Array.from(fileList);
    if (picked.length === 0) return;

    const tooBig = picked.filter((f) => f.size > MAX_FILE_SIZE);
    const allowed = picked.filter((f) => f.size <= MAX_FILE_SIZE);
    const messages: string[] = [];
    if (tooBig.length > 0) messages.push(`Skipped (over 50 MB): ${tooBig.map((f) => f.name).join(", ")}`);
    setError(messages.join(" · "));

    const failed: string[] = [];
    for (let i = 0; i < allowed.length; i++) {
      const file = allowed[i];
      setUploading({ current: i + 1, total: allowed.length, name: file.name });
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${id}/${folderInfo.key}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("resources")
        .upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (uploadError) {
        failed.push(file.name);
        continue;
      }

      const { data: urlData } = supabase.storage.from("resources").getPublicUrl(path);
      const { data: row, error: rowError } = await supabase
        .from("resources")
        .insert({
          subject_id: id,
          folder: folderInfo.key,
          title: file.name,
          file_path: path,
          file_url: urlData.publicUrl,
          file_size: file.size,
          uploaded_by: user,
        })
        .select()
        .single();

      if (rowError || !row) {
        await supabase.storage.from("resources").remove([path]);
        failed.push(file.name);
        continue;
      }
      setFiles((prev) => [row as Resource, ...prev]);
    }

    setUploading(null);
    if (failed.length > 0) messages.push(`Couldn't upload: ${failed.join(", ")}`);
    setError(messages.join(" · "));
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleDelete(file: Resource) {
    if (!window.confirm(`Delete "${file.title}"? This can't be undone.`)) return;
    setDeletingId(file.id);
    setError("");
    await supabase.storage.from("resources").remove([file.file_path]);
    const { error: deleteError } = await supabase.from("resources").delete().eq("id", file.id);
    setDeletingId(null);
    if (deleteError) {
      setError(`Couldn't delete: ${deleteError.message}`);
      return;
    }
    setFiles((prev) => prev.filter((f) => f.id !== file.id));
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!dragging) setDragging(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) void uploadFiles(e.dataTransfer.files);
  }

  if (!folderInfo || status === "missing") {
    return (
      <main className="mx-auto max-w-5xl px-4 py-16 text-center">
        <p className="text-5xl mb-4">👻</p>
        <p className="font-pixel text-sm text-pink leading-relaxed">FOLDER NOT FOUND</p>
        <p className="mt-3 text-white/60">The subject may have been deleted.</p>
        <Link href="/" className="btn-arcade inline-block mt-8">
          ◀ BACK TO SUBJECTS
        </Link>
      </main>
    );
  }

  if (status === "loading") {
    return (
      <main className="mx-auto max-w-5xl px-4 py-16">
        <p className="font-pixel text-xs text-cyan">
          LOADING<span className="animate-blink">...</span>
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <Link href={`/subject/${id}`} className="text-sm text-white/60 transition hover:text-cyan">
        ◀ {subjectName}
      </Link>

      <div className="mt-6 flex items-center gap-4">
        <span className="text-5xl">{folderInfo.emoji}</span>
        <div className="min-w-0">
          <p className="font-pixel text-[10px] text-white/50 leading-relaxed truncate">{subjectName.toUpperCase()}</p>
          <h1
            className="mt-2 font-pixel text-sm sm:text-xl leading-relaxed"
            style={{ color: accent, textShadow: `0 0 12px ${accent}66` }}
          >
            {folderInfo.label.toUpperCase()}
          </h1>
        </div>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`card mt-8 p-6 sm:p-8 text-center transition ${dragging ? "scale-[1.01]" : ""}`}
        style={{ borderStyle: "dashed", borderColor: dragging ? accent : undefined }}
      >
        <p className="text-4xl mb-3">{uploading ? "⏳" : dragging ? "📥" : "📤"}</p>
        {uploading ? (
          <>
            <p className="font-pixel text-[10px] leading-relaxed" style={{ color: accent }}>
              UPLOADING {uploading.current}/{uploading.total}
              <span className="animate-blink">...</span>
            </p>
            <p className="mt-2 text-sm text-white/60 break-all">{uploading.name}</p>
          </>
        ) : (
          <>
            <p className="text-white/70">{dragging ? "Drop it!" : "Drag files here, or"}</p>
            <button type="button" onClick={() => inputRef.current?.click()} className="btn-arcade mt-4">
              + ADD FILES
            </button>
            <p className="mt-3 text-xs text-white/40">Max 50 MB per file · you can pick several at once</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) void uploadFiles(e.target.files);
          }}
        />
      </div>

      {error && <p className="mt-4 text-sm text-pink">{error}</p>}

      {files.length === 0 ? (
        <div className="mt-10 text-center">
          <p className="font-pixel text-[10px] text-pink leading-relaxed">FOLDER IS EMPTY</p>
          <p className="mt-2 text-sm text-white/50">Be the first to add something.</p>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {files.map((file) => (
            <li key={file.id} className="card flex flex-wrap items-center gap-4 p-4">
              <span className="text-3xl shrink-0">{fileIcon(file.title)}</span>
              <div className="min-w-0 flex-1">
                <a
                  href={file.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate font-semibold transition hover:underline"
                  style={{ color: accent }}
                >
                  {file.title}
                </a>
                <p className="mt-1 text-xs text-white/50">
                  {formatSize(file.file_size)} · {formatDate(file.created_at)}
                </p>
              </div>
              <span className="hidden sm:inline-block shrink-0 rounded-full border-2 border-edge px-3 py-1 text-xs">
                <span className="text-white/50">uploaded by </span>
                <span className="font-semibold text-mint">{displayName(file.uploaded_by)}</span>
              </span>
              <div className="flex shrink-0 gap-2">
                <a
                  href={`${file.file_url}?download=${encodeURIComponent(file.title)}`}
                  aria-label={`Download ${file.title}`}
                  className="rounded-lg border-2 border-edge px-3 py-1 text-xs transition hover:border-cyan hover:text-cyan"
                >
                  ⬇
                </a>
                <button
                  onClick={() => handleDelete(file)}
                  disabled={deletingId === file.id}
                  aria-label={`Delete ${file.title}`}
                  className="rounded-lg border-2 border-edge px-3 py-1 text-xs text-white/60 transition hover:border-pink hover:text-pink"
                >
                  {deletingId === file.id ? "..." : "✕"}
                </button>
              </div>
              <p className="sm:hidden basis-full -mt-2 text-xs">
                <span className="text-white/50">uploaded by </span>
                <span className="font-semibold text-mint">{displayName(file.uploaded_by)}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
