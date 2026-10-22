/**
 * Team planning API call.
 */
import type { TeamPlanning } from "@/types";
import { http } from "./http";

// GET /team-planning?from&to (both roles) → approved absences overlapping the range.
export async function getTeamPlanning(from: string, to: string): Promise<TeamPlanning> {
  const { data } = await http.get<TeamPlanning>("/team-planning", { params: { from, to } });
  return data;
}
