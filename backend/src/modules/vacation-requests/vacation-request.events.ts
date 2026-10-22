/**
 * Domain events of the vacation-requests module.
 * Published on the EventBus by command handlers, after their transaction is committed.
 */
import { DomainEvent } from "../../shared/cqrs/event-bus";

// A validator approved a Pending request.
export class VacationRequestApprovedEvent extends DomainEvent {
  readonly name = "VacationRequestApproved";

  constructor(
    readonly requestId: number,
    readonly userId: number,
    readonly validatorId: number
  ) {
    super();
  }
}

// A validator rejected a Pending request, with a mandatory comment.
export class VacationRequestRejectedEvent extends DomainEvent {
  readonly name = "VacationRequestRejected";

  constructor(
    readonly requestId: number,
    readonly userId: number,
    readonly validatorId: number,
    readonly comment: string
  ) {
    super();
  }
}

// A requester submitted a new vacation request (status Pending).
export class VacationRequestCreatedEvent extends DomainEvent {
  readonly name = "VacationRequestCreated";

  constructor(
    readonly requestId: number,
    readonly userId: number,
    readonly startDate: string,
    readonly endDate: string
  ) {
    super();
  }
}
