/**
 * Authentication API calls.
 */
import type { LoginResponse } from "@/types";
import { http, LOGIN_URL } from "./http";

// POST /auth/login → { token, user }. Throws on 400 / 401.
export async function login(email: string, password: string): Promise<LoginResponse> {
  const { data } = await http.post<LoginResponse>(LOGIN_URL, { email, password });
  return data;
}
