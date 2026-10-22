/**
 * ApproveVacationRequestCommand — a validator approves a Pending request.
 *
 * Rule 6 (only validators) is checked by the HTTP layer before the command is sent.
 * Rule 3 (only Pending requests change) is enforced by the conditional update.
 * Rule 4 (no past dates) applies to creation only: a request whose start date has passed
 * can still be approved, so pending requests never get stuck.
 */
import { DataSource } from "typeorm";
import { Command, CommandHandler } from "../../../shared/cqrs/command-bus";
import { EventBus } from "../../../shared/cqrs/event-bus";
import { toVacationRequestDto, VacationRequestDto } from "../vacation-request.dto";
import { VacationRequestStatus } from "../vacation-request.entity";
import { VacationRequestApprovedEvent } from "../vacation-request.events";
import { reviewPendingRequest } from "./review-pending-request";

export class ApproveVacationRequestCommand extends Command<VacationRequestDto> {
  constructor(
    readonly requestId: number,
    // The validator, taken from the JWT (recorded in the event / audit log).
    readonly validatorId: number
  ) {
    super();
  }
}

export class ApproveVacationRequestHandler implements CommandHandler<ApproveVacationRequestCommand> {
  constructor(
    private readonly getDataSource: () => Promise<DataSource>,
    private readonly eventBus: EventBus
  ) {}

  async execute(command: ApproveVacationRequestCommand): Promise<VacationRequestDto> {
    const updated = await reviewPendingRequest(await this.getDataSource(), command.requestId, {
      status: VacationRequestStatus.Approved,
      comment: null,
    });

    await this.eventBus.publish(
      new VacationRequestApprovedEvent(updated.id, updated.userId, command.validatorId)
    );

    return toVacationRequestDto(updated);
  }
}
