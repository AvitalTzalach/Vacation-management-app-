/**
 * Shared TypeScript types, mirroring the backend API responses (see GET /doc on the API).
 */

export type Role = "Requester" | "Validator";

export type VacationStatus = "Pending" | "Approved" | "Rejected";

// The signed-in user, as returned by POST /auth/login.
export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface VacationRequest {
  id: number;
  userId: number;
  // Calendar dates, "YYYY-MM-DD".
  startDate: string;
  endDate: string;
  reason: string | null;
  status: VacationStatus;
  // Validator's comment (always present on Rejected requests).
  comment: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVacationRequestPayload {
  startDate: string;
  endDate: string;
  reason: string | null;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

// Uniform error body of the API: { error: { code, message, details? } }.
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
