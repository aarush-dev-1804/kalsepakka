export const ALLOWED_NAMES = [
  "arnav",
  "aarush",
  "atharv",
  "adithya",
  "anay",
  "daivik",
  "ishan",
  "manu",
  "shyam",
  "nishant",
] as const;

export type AllowedName = (typeof ALLOWED_NAMES)[number];

export const FOLDERS = [
  { key: "vtop", label: "VTOP Material", emoji: "🏛️" },
  { key: "teacher", label: "Teacher's Personal Material", emoji: "👩‍🏫" },
  { key: "ai", label: "AI Material", emoji: "🤖" },
] as const;

export type FolderKey = (typeof FOLDERS)[number]["key"];

export const MAX_FILE_SIZE = 50 * 1024 * 1024;

export function isAllowedName(name: string): name is AllowedName {
  return (ALLOWED_NAMES as readonly string[]).includes(name.trim().toLowerCase());
}

export function displayName(name: string): string {
  const n = name.trim().toLowerCase();
  return n.charAt(0).toUpperCase() + n.slice(1);
}