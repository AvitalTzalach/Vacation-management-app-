/**
 * RejectVacationRequestCommand — a validator rejects a Pending request with a comment.
 *
 * Rule 5 (a rejection needs a comment) is checked first, as a pure rule.
 * Rule 6 (only validators) is checked by the HTTP layer before the command is sent.
 * Rule 3 (only Pending requests change) is enforced by the conditional update.
 */
import { DataSource } from "typeorm";
import { Command, CommandHandler } from "../../../shared/cqrs/command-bus";
import { EventBus } from "../../../shared/cqrs/event-bus";
import { toVacationRequestDto, VacationRequestDto } from "../vacation-request.dto";
import { VacationRequestStatus } from "../vacation-request.entity";
import { VacationRequestRejectedEvent } from "../vacation-request.events";
import { assertValidRejectionComment } from "../vacation-request.rules";
import { reviewPendingRequest } from "./review-pending-request";

export class RejectVacationRequestCommand extends Command<VacationRequestDto> {
  constructor(
    readonly requestId: number,
    // The validator, taken from the JWT (recorded in the event / audit log).
    readonly validatorId: number,
    readonly comment: string
  ) {
    super();
  }
}

export class RejectVacationRequestHandler implements CommandHandler<RejectVacationRequestCommand> {
  constructor(
    private readonly getDataSource: () => Promise<DataSource>,
    private readonly eventBus: EventBus
  ) {}

  async execute(command: RejectVacationRequestCommand): Promise<VacationRequestDto> {
    // Rule 5, before touching the database.
    assertValidRejectionComment(command.comment);
    const comment = command.comment.trim();

    const updated = await reviewPendingRequest(await this.getDataSource(), command.requestId, {
      status: VacationRequestStatus.Rejected,
      comment,
    });

    await this.eventBus.publish(
      new VacationRequestRejectedEvent(updated.id, updated.userId, command.validatorId, comment)
    );

    return toVacationRequestDto(updated);
  }
}
