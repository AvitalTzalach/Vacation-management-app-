/**
 * Composition root: creates the buses and connects every command to its handler and every
 * event to its subscribers. This is the only file that knows all the pieces.
 *
 * Built lazily on first use and then reused (one CommandBus / EventBus per process).
 */
import { getDataSource } from "./database/data-source";
import { LoginCommand, LoginHandler } from "./modules/auth/login.command";
import {
  ApproveVacationRequestCommand,
  ApproveVacationRequestHandler,
} from "./modules/vacation-requests/commands/approve-vacation-request.command";
import {
  CreateVacationRequestCommand,
  CreateVacationRequestHandler,
} from "./modules/vacation-requests/commands/create-vacation-request.command";
import {
  RejectVacationRequestCommand,
  RejectVacationRequestHandler,
} from "./modules/vacation-requests/commands/reject-vacation-request.command";
import { registerAuditLogSubscriber } from "./modules/vacation-requests/audit-log.subscriber";
import { CommandBus } from "./shared/cqrs/command-bus";
import { EventBus } from "./shared/cqrs/event-bus";

export interface AppContainer {
  commandBus: CommandBus;
  eventBus: EventBus;
}

let container: AppContainer | null = null;

// Wires commands → handlers and events → subscribers.
function createContainer(): AppContainer {
  const eventBus = new EventBus();
  const commandBus = new CommandBus();

  // Event subscribers
  registerAuditLogSubscriber(eventBus);

  // Command handlers
  commandBus.register(LoginCommand, new LoginHandler(getDataSource));
  commandBus.register(
    CreateVacationRequestCommand,
    new CreateVacationRequestHandler(getDataSource, eventBus)
  );
  commandBus.register(
    ApproveVacationRequestCommand,
    new ApproveVacationRequestHandler(getDataSource, eventBus)
  );
  commandBus.register(
    RejectVacationRequestCommand,
    new RejectVacationRequestHandler(getDataSource, eventBus)
  );

  return { commandBus, eventBus };
}

// Returns the application's CommandBus (the container is created on the first call).
export function getCommandBus(): CommandBus {
  container ??= createContainer();
  return container.commandBus;
}
