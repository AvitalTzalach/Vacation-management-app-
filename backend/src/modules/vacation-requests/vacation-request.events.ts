/**
 * Domain events of the vacation-requests module.
 * Published on the EventBus by command handlers, after their transaction is committed.
 */
import { DomainEvent } from "../../shared/cqrs/event-bus";

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
