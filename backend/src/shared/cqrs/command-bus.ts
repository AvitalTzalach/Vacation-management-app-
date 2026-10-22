/**
 * Command bus — the entry point for every action that changes the system.
 *
 * A command is a small object describing an intention ("create this vacation request").
 * The bus finds the one handler registered for the command's class and runs it.
 * Callers (the HTTP handlers) only know the command, never the handler or the database,
 * which keeps the HTTP layer thin and the business logic in one place.
 */

/**
 * Base class of every command.
 * `TResult` is the type returned by the command's handler. The phantom field below is never
 * set at runtime: it only lets TypeScript infer the result type of `CommandBus.execute`.
 */
export abstract class Command<TResult = void> {
  declare readonly __resultType?: TResult;
}

// Extracts the result type from a command type (e.g. LoginCommand → LoginResult).
export type CommandResult<TCommand> = TCommand extends Command<infer TResult> ? TResult : never;

// A handler executes exactly one type of command.
export interface CommandHandler<TCommand extends Command<unknown>> {
  execute(command: TCommand): Promise<CommandResult<TCommand>>;
}

// Any class whose instances are commands (used as the registration key).
type CommandClass<TCommand> = new (...args: any[]) => TCommand;

export class CommandBus {
  // One handler per command class.
  private readonly handlers = new Map<Function, CommandHandler<any>>();

  // Registers the handler of a command class. Registering twice is a wiring bug, so it throws.
  register<TCommand extends Command<unknown>>(
    commandClass: CommandClass<TCommand>,
    handler: CommandHandler<TCommand>
  ): void {
    if (this.handlers.has(commandClass)) {
      throw new Error(`A handler is already registered for ${commandClass.name}`);
    }
    this.handlers.set(commandClass, handler);
  }

  // Runs the handler registered for this command and returns its result.
  async execute<TCommand extends Command<unknown>>(
    command: TCommand
  ): Promise<CommandResult<TCommand>> {
    // The map loses the specific types; `register` guarantees this handler matches the command class.
    const handler = this.handlers.get(command.constructor) as CommandHandler<TCommand> | undefined;
    if (!handler) {
      throw new Error(`No handler registered for ${command.constructor.name}`);
    }
    return handler.execute(command);
  }
}
