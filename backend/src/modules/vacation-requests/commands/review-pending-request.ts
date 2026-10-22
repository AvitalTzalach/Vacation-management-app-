/**
 * Shared step of ApproveVacationRequestCommand and RejectVacationRequestCommand:
 * moves a request out of Pending with ONE conditional UPDATE.
 *
 *   UPDATE vacation_requests SET status = ..., comments = ..., updated_at = now()
 *   WHERE id = :id AND status = 'Pending'
 *
 * Rule 3 (an approved request cannot be modified) is enforced by the WHERE clause itself:
 * only a Pending row can change. Because the check and the write are a single statement, two
 * validators clicking at the same moment cannot both succeed — the second UPDATE finds no
 * Pending row and affects 0 rows. A "read, check, then write" sequence would allow that race.
 */
import { DataSource } from "typeorm";
import { ConflictError, NotFoundError } from "../../../shared/errors";
import { VacationRequest, VacationRequestStatus } from "../vacation-request.entity";

export interface ReviewDecision {
  status: VacationRequestStatus.Approved | VacationRequestStatus.Rejected;
  // Validator's comment, stored in the `comments` column (mandatory for a rejection).
  comment: string | null;
}

/**
 * Applies the decision to a Pending request and returns the updated request.
 * @throws NotFoundError  (404) when the request does not exist
 * @throws ConflictError  (409) when the request exists but is no longer Pending
 */
export async function reviewPendingRequest(
  dataSource: DataSource,
  requestId: number,
  decision: ReviewDecision
): Promise<VacationRequest> {
  const repository = dataSource.getRepository(VacationRequest);

  const result = await repository
    .createQueryBuilder()
    .update(VacationRequest)
    .set({ status: decision.status, comments: decision.comment, updatedAt: () => "now()" })
    .where("id = :id", { id: requestId })
    .andWhere("status = :pending", { pending: VacationRequestStatus.Pending })
    .execute();

  if (result.affected === 0) {
    // Nothing was updated: find out why, to answer 404 or 409.
    const existing = await repository.findOneBy({ id: requestId });
    if (!existing) {
      throw new NotFoundError(`Vacation request ${requestId} does not exist.`);
    }
    throw new ConflictError(
      `This request is already ${existing.status.toLowerCase()} and can no longer be changed.`,
      { currentStatus: existing.status }
    );
  }

  // Reads the row back for the response (new status, comment and updated_at).
  return repository.findOneByOrFail({ id: requestId });
}
