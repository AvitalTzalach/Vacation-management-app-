/**
 * API representation of a vacation request (what the endpoints return).
 *
 * Kept separate from the entity so the API shape is explicit and stable:
 * - camelCase fields;
 * - the DB column `comments` is exposed as `comment` (the validator's single comment);
 * - timestamps as ISO strings.
 */
import { VacationRequest, VacationRequestStatus } from "./vacation-request.entity";

export interface VacationRequestDto {
  id: number;
  userId: number;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: VacationRequestStatus;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
}

// Maps an entity to its API representation.
export function toVacationRequestDto(entity: VacationRequest): VacationRequestDto {
  return {
    id: entity.id,
    userId: entity.userId,
    startDate: entity.startDate,
    endDate: entity.endDate,
    reason: entity.reason,
    status: entity.status,
    comment: entity.comments,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  };
}
