import { create } from "zustand";
import type { UserProfile } from "@/api/auth";

interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  setAuth: (user: UserProfile, accessToken: string) => void;
  clearAuth: () => void;
}

const STORAGE_KEY_USER = "projectai:user";
const STORAGE_KEY_TOKEN = "projectai:access_token";

function loadInitialState(): Pick<AuthState, "user" | "accessToken"> {
  if (typeof window === "undefined") {
    return { user: null, accessToken: null };
  }
  try {
    const userJson = window.localStorage.getItem(STORAGE_KEY_USER);
    const token = window.localStorage.getItem(STORAGE_KEY_TOKEN);
    const user = userJson ? (JSON.parse(userJson) as UserProfile) : null;
    return { user, accessToken: token };
  } catch {
    return { user: null, accessToken: null };
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  ...loadInitialState(),
  setAuth: (user, accessToken) => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
        window.localStorage.setItem(STORAGE_KEY_TOKEN, accessToken);
      } catch {
        // ignore storage errors
      }
    }
    set({ user, accessToken });
  },
  clearAuth: () => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(STORAGE_KEY_USER);
        window.localStorage.removeItem(STORAGE_KEY_TOKEN);
      } catch {
        // ignore
      }
    }
    set({ user: null, accessToken: null });
  },
}));


