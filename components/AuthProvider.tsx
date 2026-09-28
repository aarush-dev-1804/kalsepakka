"use client";

import { createContext, useContext, useSyncExternalStore, ReactNode } from "react";
import { isAllowedName } from "@/lib/constants";

type AuthContextValue = {
  user: string | null;
  ready: boolean;
  login: (name: string) => boolean;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const STORAGE_KEY = "kalsepakka-user";
const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function notify() {
  listeners.forEach((listener) => listener());
}

function readUser(): string | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved && isAllowedName(saved) ? saved.trim().toLowerCase() : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const user = useSyncExternalStore(subscribe, readUser, () => null);
  const ready = useSyncExternalStore(subscribe, () => true, () => false);

  function login(name: string) {
    const clean = name.trim().toLowerCase();
    if (!isAllowedName(clean)) return false;
    try {
      localStorage.setItem(STORAGE_KEY, clean);
    } catch {}
    notify();
    return true;
  }

  function logout() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    notify();
  }

  return (
    <AuthContext.Provider value={{ user, ready, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
