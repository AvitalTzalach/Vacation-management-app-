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

// Request with its owner's public data (validator dashboard). Never the owner's email or password.
export interface VacationRequestWithUserDto extends VacationRequestDto {
  user: { id: number; name: string };
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

// Same, plus the owner. The `user` relation must have been loaded (joined) by the query.
export function toVacationRequestWithUserDto(entity: VacationRequest): VacationRequestWithUserDto {
  if (!entity.user) {
    throw new Error(`VacationRequest ${entity.id} was loaded without its user`);
  }
  return {
    ...toVacationRequestDto(entity),
    user: { id: entity.user.id, name: entity.user.name },
  };
}
