/**
 * Users API calls.
 */
import type { UserSummary } from "@/types";
import { http } from "./http";

// GET /users (Validator) → requesters (id, name), sorted by name. Used by the dashboard filter.
export async function listUsers(): Promise<UserSummary[]> {
  const { data } = await http.get<{ data: UserSummary[] }>("/users");
  return data.data;
}
