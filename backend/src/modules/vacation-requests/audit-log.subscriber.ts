/**
 * Audit log subscriber: writes one structured line per domain event to the server log.
 *
 * It shows the event side of the architecture: command handlers publish events without knowing
 * this subscriber exists. A real system could add an e-mail or Slack notification the same way,
 * without changing any command.
 */
import { DomainEvent, EventBus } from "../../shared/cqrs/event-bus";

// Logs the event name, time and payload as a single JSON line.
export function logDomainEvent(event: DomainEvent): void {
  const { name, occurredAt, ...payload } = event;
  console.log(
    `[audit] ${JSON.stringify({ event: name, at: occurredAt.toISOString(), ...payload })}`
  );
}

// Subscribes the audit log to every event published on the bus.
export function registerAuditLogSubscriber(eventBus: EventBus): void {
  eventBus.subscribeToAll(logDomainEvent);
}
