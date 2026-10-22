/**
 * Vacation request API calls.
 */
import type { CreateVacationRequestPayload, Paginated, VacationRequest } from "@/types";
import { http } from "./http";

export interface PageParams {
  page: number;
  limit: number;
}

// POST /vacation-requests (Requester) → the created request (status Pending).
export async function createVacationRequest(payload: CreateVacationRequestPayload): Promise<VacationRequest> {
  const { data } = await http.post<VacationRequest>("/vacation-requests", payload);
  return data;
}

// GET /vacation-requests/mine (Requester) → one page of the user's requests, newest first.
export async function listMyVacationRequests(params: PageParams): Promise<Paginated<VacationRequest>> {
  const { data } = await http.get<Paginated<VacationRequest>>("/vacation-requests/mine", { params });
  return data;
}
