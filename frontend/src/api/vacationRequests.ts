/**
 * Vacation request API calls.
 */
import type {
  CreateVacationRequestPayload,
  Paginated,
  VacationRequest,
  VacationRequestWithUser,
  VacationStatus,
} from "@/types";
import { http } from "./http";

export interface PageParams {
  page: number;
  limit: number;
}

export interface ListAllParams extends PageParams {
  status?: VacationStatus;
  userId?: number;
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

// GET /vacation-requests (Validator) → one page of all requests with their owner.
// Undefined filters are left out of the query string by Axios.
export async function listAllVacationRequests(params: ListAllParams): Promise<Paginated<VacationRequestWithUser>> {
  const { data } = await http.get<Paginated<VacationRequestWithUser>>("/vacation-requests", { params });
  return data;
}

// PUT /vacation-requests/:id/approve (Validator) → the approved request.
export async function approveVacationRequest(id: number): Promise<VacationRequest> {
  const { data } = await http.put<VacationRequest>(`/vacation-requests/${id}/approve`);
  return data;
}

// PUT /vacation-requests/:id/reject (Validator) → the rejected request. The comment is mandatory.
export async function rejectVacationRequest(id: number, comment: string): Promise<VacationRequest> {
  const { data } = await http.put<VacationRequest>(`/vacation-requests/${id}/reject`, { comment });
  return data;
}
