/**
 * CreateVacationRequestCommand — a requester submits a new vacation request.
 *
 * Enforces:
 * - rule 1 (end after start) and rule 4 (not in the past), via the pure rules;
 * - rule 2 (no overlap with the user's Pending / Approved requests), in a transaction that
 *   locks the user's row, so two parallel submissions cannot both pass the overlap check.
 * Then publishes VacationRequestCreatedEvent.
 */
import { DataSource } from "typeorm";
import { Command, CommandHandler } from "../../../shared/cqrs/command-bus";
import { EventBus } from "../../../shared/cqrs/event-bus";
import { todayIso } from "../../../shared/dates";
import { ConflictError, UnauthorizedError } from "../../../shared/errors";
import { User } from "../../users/user.entity";
import { toVacationRequestDto, VacationRequestDto } from "../vacation-request.dto";
import { VacationRequest, VacationRequestStatus } from "../vacation-request.entity";
import { VacationRequestCreatedEvent } from "../vacation-request.events";
import { assertValidNewRequestDates } from "../vacation-request.rules";

export class CreateVacationRequestCommand extends Command<VacationRequestDto> {
  constructor(
    // Always taken from the JWT by the HTTP layer, never from the request body.
    readonly userId: number,
    readonly startDate: string,
    readonly endDate: string,
    readonly reason: string | null
  ) {
    super();
  }
}

// Statuses that "occupy" dates. A Rejected request does not block new requests on the same days.
const BLOCKING_STATUSES = [VacationRequestStatus.Pending, VacationRequestStatus.Approved];

export class CreateVacationRequestHandler implements CommandHandler<CreateVacationRequestCommand> {
  /**
   * Dependencies are injected so the handler can be tested:
   * @param getDataSource database access
   * @param eventBus      where the "created" event is published
   * @param today         clock used by rule 4 (replaceable in tests)
   */
  constructor(
    private readonly getDataSource: () => Promise<DataSource>,
    private readonly eventBus: EventBus,
    private readonly today: () => string = todayIso
  ) {}

  async execute(command: CreateVacationRequestCommand): Promise<VacationRequestDto> {
    // Rules 1 and 4: cheap checks first, before touching the database.
    assertValidNewRequestDates(command, this.today());

    const dataSource = await this.getDataSource();

    const created = await dataSource.transaction(async (manager) => {
      // Lock the owner's row until the end of the transaction (SELECT ... FOR UPDATE).
      // A second request of the same user waits here until the first one commits, then sees
      // its row in the overlap check below. Other users are not blocked.
      const owner = await manager
        .getRepository(User)
        .createQueryBuilder("user")
        .setLock("pessimistic_write")
        .where("user.id = :userId", { userId: command.userId })
        .getOne();
      if (!owner) {
        // The token refers to a user that no longer exists.
        throw new UnauthorizedError("Your account no longer exists.");
      }

      // Rule 2: same inclusive definition as `rangesOverlap` in vacation-request.rules.ts.
      // Served by the index (user_id, start_date, end_date).
      const overlapping = await manager
        .getRepository(VacationRequest)
        .createQueryBuilder("request")
        .where("request.user_id = :userId", { userId: command.userId })
        .andWhere("request.status IN (:...statuses)", { statuses: BLOCKING_STATUSES })
        .andWhere("request.start_date <= :endDate", { endDate: command.endDate })
        .andWhere("request.end_date >= :startDate", { startDate: command.startDate })
        .orderBy("request.start_date", "ASC")
        .getOne();
      if (overlapping) {
        throw new ConflictError(
          `These dates overlap your ${overlapping.status.toLowerCase()} request from ` +
            `${overlapping.startDate} to ${overlapping.endDate}.`,
          {
            conflictingRequest: {
              id: overlapping.id,
              startDate: overlapping.startDate,
              endDate: overlapping.endDate,
              status: overlapping.status,
            },
          }
        );
      }

      const repository = manager.getRepository(VacationRequest);
      return repository.save(
        repository.create({
          userId: command.userId,
          startDate: command.startDate,
          endDate: command.endDate,
          reason: command.reason,
          status: VacationRequestStatus.Pending,
          comments: null,
        })
      );
    });

    // Published only after the commit: subscribers never hear about a request that was rolled back.
    await this.eventBus.publish(
      new VacationRequestCreatedEvent(created.id, created.userId, created.startDate, created.endDate)
    );

    return toVacationRequestDto(created);
  }
}
