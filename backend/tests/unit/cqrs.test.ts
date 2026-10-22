/**
 * Unit tests of the CommandBus and EventBus (the Command / Event architecture).
 */
import { describe, expect, it, vi } from "vitest";
import { Command, CommandBus, CommandHandler } from "../../src/shared/cqrs/command-bus";
import { DomainEvent, EventBus } from "../../src/shared/cqrs/event-bus";

class AddCommand extends Command<number> {
  constructor(
    readonly a: number,
    readonly b: number
  ) {
    super();
  }
}

class AddHandler implements CommandHandler<AddCommand> {
  async execute(command: AddCommand): Promise<number> {
    return command.a + command.b;
  }
}

class UnknownCommand extends Command<void> {}

class SomethingHappened extends DomainEvent {
  readonly name = "SomethingHappened";
}

class SomethingElseHappened extends DomainEvent {
  readonly name = "SomethingElseHappened";
}

describe("CommandBus", () => {
  it("runs the handler registered for the command and returns its result", async () => {
    const bus = new CommandBus();
    bus.register(AddCommand, new AddHandler());
    await expect(bus.execute(new AddCommand(2, 3))).resolves.toBe(5);
  });

  it("fails clearly when no handler is registered", async () => {
    const bus = new CommandBus();
    await expect(bus.execute(new UnknownCommand())).rejects.toThrow("No handler registered for UnknownCommand");
  });

  it("refuses to register two handlers for the same command", () => {
    const bus = new CommandBus();
    bus.register(AddCommand, new AddHandler());
    expect(() => bus.register(AddCommand, new AddHandler())).toThrow("already registered");
  });
});

describe("EventBus", () => {
  it("delivers an event to its own subscribers and to global subscribers", async () => {
    const bus = new EventBus();
    const specific = vi.fn();
    const global = vi.fn();
    const other = vi.fn();
    bus.subscribe(SomethingHappened, specific);
    bus.subscribe(SomethingElseHappened, other);
    bus.subscribeToAll(global);

    const event = new SomethingHappened();
    await bus.publish(event);

    expect(specific).toHaveBeenCalledWith(event);
    expect(global).toHaveBeenCalledWith(event);
    expect(other).not.toHaveBeenCalled();
  });

  it("does not throw when a subscriber fails, and still calls the others", async () => {
    const bus = new EventBus();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const healthy = vi.fn();
    bus.subscribeToAll(() => {
      throw new Error("boom");
    });
    bus.subscribeToAll(healthy);

    await expect(bus.publish(new SomethingHappened())).resolves.toBeUndefined();
    expect(healthy).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });

  it("timestamps events", () => {
    expect(new SomethingHappened().occurredAt).toBeInstanceOf(Date);
  });
});
