/**
 * Auth store (Pinia): the signed-in user and their JWT.
 *
 * Both are persisted in localStorage so a page reload keeps the session. The token is not
 * decoded or trusted here: the API verifies it on every request, and an expired token is
 * handled by the Axios 401 interceptor.
 * (Known limitation, in the README: localStorage is readable by any script on the page.)
 */
import { defineStore } from "pinia";
import { computed, ref } from "vue";
import * as authApi from "@/api/auth";
import type { User } from "@/types";

const TOKEN_KEY = "away.token";
const USER_KEY = "away.user";

// localStorage can throw (private mode, blocked storage): the app then works without persistence.
function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Ignored: the session simply won't survive a reload.
  }
}

// Reads the saved user; a corrupted value is treated as "signed out".
function readUser(): User | null {
  const raw = readStorage(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export const useAuthStore = defineStore("auth", () => {
  const token = ref<string | null>(readStorage(TOKEN_KEY));
  const user = ref<User | null>(readUser());

  const isAuthenticated = computed(() => Boolean(token.value && user.value));

  // Saves (or clears) the session in memory and in localStorage.
  function setSession(newToken: string | null, newUser: User | null): void {
    token.value = newToken;
    user.value = newUser;
    writeStorage(TOKEN_KEY, newToken);
    writeStorage(USER_KEY, newUser ? JSON.stringify(newUser) : null);
  }

  // Signs in with the API. Errors (400 / 401 / network) are thrown to the caller (the login form).
  async function login(email: string, password: string): Promise<void> {
    const response = await authApi.login(email, password);
    setSession(response.token, response.user);
  }

  function logout(): void {
    setSession(null, null);
  }

  return { token, user, isAuthenticated, login, logout };
});
