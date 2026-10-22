/**
 * Axios instance used by every API call.
 *
 * - baseURL "/api": requests go to the Vite dev server, which proxies them to the backend.
 * - Request interceptor: reads the current token on EVERY request and adds
 *   "Authorization: Bearer <token>", so a new login or logout is picked up immediately.
 * - Response interceptor: on 401 (expired or invalid token) it calls the "unauthorized" callback
 *   (sign out + go to the login page) — except for the login request itself, whose 401 just means
 *   "wrong password" and must stay on the login form.
 *
 * The token source and the 401 reaction are injected from main.ts (`configureHttp`), so this
 * file does not import the store or the router (no circular dependency).
 */
import axios, { type InternalAxiosRequestConfig } from "axios";

export const LOGIN_URL = "/auth/login";

export const http = axios.create({
  baseURL: "/api",
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});

interface HttpOptions {
  // Returns the current JWT, or null when signed out.
  getToken: () => string | null;
  // Called when an authenticated request is rejected with 401.
  onUnauthorized: () => void;
}

let options: HttpOptions = {
  getToken: () => null,
  onUnauthorized: () => {},
};

// Connects the HTTP client to the auth store and the router (called once in main.ts).
export function configureHttp(newOptions: HttpOptions): void {
  options = newOptions;
}

// True for the login call, whose 401 must not trigger a redirect.
function isLoginRequest(config?: InternalAxiosRequestConfig): boolean {
  return config?.url === LOGIN_URL;
}

http.interceptors.request.use((config) => {
  const token = options.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401 && !isLoginRequest(error.config)) {
      options.onUnauthorized();
    }
    return Promise.reject(error);
  }
);
