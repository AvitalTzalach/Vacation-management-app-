/**
 * Event bus — publishes domain events to their subscribers (in-process, in memory).
 *
 * A domain event states a fact that already happened ("a vacation request was created").
 * Command handlers publish events after their database transaction is committed; subscribers
 * react to them (audit log today, e-mail notifications tomorrow) without the command handler
 * knowing who listens. Adding a new reaction never requires changing the command.
 *
 * Limitation (documented in the README): events live in memory only — no persistence, no retry.
 */

// Base class of every domain event.
export abstract class DomainEvent {
  // Stable event name, used in logs (e.g. "VacationRequestCreated").
  abstract readonly name: string;

  readonly occurredAt: Date = new Date();
}

// A subscriber is a function called with the event. It may be synchronous or asynchronous.
export type EventSubscriber<TEvent extends DomainEvent> = (event: TEvent) => void | Promise<void>;

// Any class whose instances are events (used as the subscription key).
type EventClass<TEvent> = new (...args: any[]) => TEvent;

export class EventBus {
  // Subscribers of one specific event class.
  private readonly subscribers = new Map<Function, EventSubscriber<any>[]>();

  // Subscribers of every event (e.g. the audit log).
  private readonly globalSubscribers: EventSubscriber<DomainEvent>[] = [];

  // Subscribes to one event class.
  subscribe<TEvent extends DomainEvent>(
    eventClass: EventClass<TEvent>,
    subscriber: EventSubscriber<TEvent>
  ): void {
    const list = this.subscribers.get(eventClass) ?? [];
    list.push(subscriber);
    this.subscribers.set(eventClass, list);
  }

  // Subscribes to all events.
  subscribeToAll(subscriber: EventSubscriber<DomainEvent>): void {
    this.globalSubscribers.push(subscriber);
  }

  /**
   * Delivers the event to its subscribers.
   * The action that produced the event is already committed, so a failing subscriber must not
   * turn a successful request into an error: failures are logged, never thrown.
   */
  async publish(event: DomainEvent): Promise<void> {
    const specific = this.subscribers.get(event.constructor) ?? [];
    const all = [...specific, ...this.globalSubscribers];

    const results = await Promise.allSettled(all.map(async (subscriber) => subscriber(event)));
    results.forEach((result) => {
      if (result.status === "rejected") {
        console.error(`[event-bus] A subscriber of ${event.name} failed:`, result.reason);
      }
    });
  }
}
