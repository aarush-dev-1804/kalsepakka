@AGENTS.md
# Kalsepakka — project brief

A private college-resources website for Aarush (1st-year B.Tech CSE, VIT Vellore) and 9 friends. Hosted on Vercel, repo `kalsepakka` on GitHub.

## Working rules for Claude
- Do NOT write code until Aarush explicitly says to (e.g. "start coding", "give me the code").
- When giving code: just the code, no explanatory notes after it. Short instructions *before* the code (which file, where it goes, how to test) are fine.
- Aarush is on Windows, using PowerShell inside VS Code. PowerShell execution policy is already fixed.
- Give one feature at a time, then wait for him to test and confirm.

## Requirements (Aarush's plan)
1. **Login with name only** — no password. Only these 10 names are allowed (case-insensitive): arnav, aarush, atharv, adithya, anay, daivik, ishan, manu, shyam, nishant. Contents are only viewable after signing in. Name-only is intentional: it's a friends-only site and the point is attribution, not security.
2. **Subjects** — anyone signed in can add new subjects and remove existing ones.
3. **Auto folders** — every subject automatically has 3 folders: VTOP Material, Teacher's Personal Material, AI Material.
4. **Upload** — an "Add" option on the site to upload files from the laptop into a subject's folder.
5. **"Uploaded by [name]"** shown beside every material.
6. **Everyone can edit** — anyone logged in can add/delete subjects and files (decided default: anyone can delete anything).
7. **Creative look** — retro-arcade / neon theme (already started, see Design below).
8. **Mini game** — a small VIT-themed maze-chomper game (original characters, NOT Pac-Man or its ghosts). Each logged-in user's highest score is saved.

## Stack
- Next.js (App Router, TypeScript, Tailwind CSS v4, ESLint), no `src/` dir, import alias `@/*`.
- Supabase (free tier, Mumbai region) for database + file storage. Package: `@supabase/supabase-js`.
- `.env.local` (root) holds `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable key). Never commit it.
- Deploy: Vercel, import GitHub repo, add the same two env vars.

## Supabase (already created — SQL has been run once, don't re-run it)
- `subjects`: id uuid, name text (unique, case-insensitive), created_by text (must be an allowed name), created_at.
- `resources`: id uuid, subject_id → subjects (on delete cascade), folder text in ('vtop','teacher','ai'), title, file_path, file_url, file_size, uploaded_by (allowed name), created_at.
- `scores`: name text PK (allowed name), high_score int, updated_at.
- RPC `submit_score(p_name text, p_score integer)` → upserts and keeps the higher score, returns the high score.
- Storage bucket `resources` (public, 50 MB file limit).
- RLS enabled on all tables; `anon` role has policies for select/insert/delete on subjects & resources, select/insert/update on scores, and select/insert/delete on storage objects in the `resources` bucket.
- Names are stored lowercase.

## Files so far
- `lib/supabase.ts` — Supabase client.
- `lib/constants.ts` — `ALLOWED_NAMES`, `FOLDERS` (key/label/emoji for vtop, teacher, ai), `MAX_FILE_SIZE` (50 MB), `isAllowedName()`, `displayName()`.
- `components/AuthProvider.tsx` — name-only auth stored in localStorage (`kalsepakka-user`), uses `useSyncExternalStore`; exposes `useAuth()` → `{ user, ready, login, logout }`.
- `components/RequireAuth.tsx` — redirects to `/login` if not signed in.
- `components/Header.tsx` — sticky header with logo, player name, log out.
- `app/login/page.tsx` — arcade-style login ("INSERT NAME TO CONTINUE", "PRESS START").
- `app/page.tsx` — placeholder welcome page (to be replaced by subjects).
- `app/layout.tsx` — fonts (Press Start 2P as `--font-press`, Space Grotesk as `--font-grotesk`) + AuthProvider.
- `app/globals.css` — theme.

## Design system (keep consistent)
- Colors (Tailwind): `ink` #0b0b1a (bg), `panel` #15152e, `edge` #2c2c5a (borders), `neon` #ffd23f, `pink` #ff5da2, `cyan` #3de8ff, `mint` #5cffb0.
- Fonts: `font-pixel` for headings/labels (small sizes like text-[10px]–text-2xl), body is Space Grotesk.
- Classes: `.card`, `.btn-arcade`, `.btn-ghost`, `.glow-text`, `.animate-shake`, `.animate-blink`, `.animate-float`.
- Dark grid background with pink/cyan glows. Must work on phones.

## Status
- Done: Next.js setup, Supabase project + SQL, lib files, login feature code written.
- In progress: fixing login-step file placement errors and testing login.
- Next, in order:
  1. Subjects page — list subjects, add/remove, each opens to its 3 folders.
  2. Folder view + upload ("Add" button, uploads to storage, saves a `resources` row with uploaded_by), delete files, show "uploaded by [name]".
  3. VIT-themed maze game page with per-user high score via `submit_score`.
  4. Design polish + mobile check.
  5. Deploy to Vercel.
  