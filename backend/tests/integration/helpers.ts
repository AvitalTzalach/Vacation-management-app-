/**
 * Helpers shared by the integration tests: database reset, fixtures, and an event recorder.
 */
import bcrypt from "bcryptjs";
import { DataSource } from "typeorm";
import { getDataSource } from "../../src/database/data-source";
import { User, UserRole } from "../../src/modules/users/user.entity";
import {
  VacationRequest,
  VacationRequestStatus,
} from "../../src/modules/vacation-requests/vacation-request.entity";
import { DomainEvent, EventBus } from "../../src/shared/cqrs/event-bus";

// Low bcrypt cost: tests only need a valid hash, not a slow one.
const TEST_BCRYPT_ROUNDS = 4;
export const TEST_PASSWORD = "secret-password";

/**
 * Empties every table and resets the id sequences.
 * Safety: refuses to run on a database whose name does not end with "_test".
 */
export async function resetDatabase(): Promise<DataSource> {
  const dataSource = await getDataSource();
  const name = String(dataSource.options.database);
  if (!name.endsWith("_test")) {
    throw new Error(`Refusing to reset "${name}": not a test database`);
  }
  await dataSource.query("TRUNCATE vacation_requests, users RESTART IDENTITY CASCADE");
  return dataSource;
}

let userCounter = 0;

// Creates a user (Requester by default) with the password TEST_PASSWORD.
export async function createUser(overrides: Partial<Pick<User, "name" | "email" | "role">> = {}): Promise<User> {
  userCounter += 1;
  const dataSource = await getDataSource();
  return dataSource.getRepository(User).save({
    name: overrides.name ?? `User ${userCounter}`,
    email: overrides.email ?? `user${userCounter}@test.local`,
    role: overrides.role ?? UserRole.Requester,
    password: bcrypt.hashSync(TEST_PASSWORD, TEST_BCRYPT_ROUNDS),
  });
}

// Inserts a request directly (bypassing the business rules, e.g. to create past or conflicting data).
export async function createRequest(
  userId: number,
  startDate: string,
  endDate: string,
  status: VacationRequestStatus = VacationRequestStatus.Pending,
  comments: string | null = status === VacationRequestStatus.Rejected ? "Not possible" : null
): Promise<VacationRequest> {
  const dataSource = await getDataSource();
  return dataSource.getRepository(VacationRequest).save({ userId, startDate, endDate, status, comments, reason: null });
}

// Reads a request straight from the database.
export async function findRequest(id: number): Promise<VacationRequest | null> {
  const dataSource = await getDataSource();
  return dataSource.getRepository(VacationRequest).findOneBy({ id });
}

// An EventBus that also records every published event, to assert on them.
export function recordingEventBus(): { eventBus: EventBus; events: DomainEvent[] } {
  const eventBus = new EventBus();
  const events: DomainEvent[] = [];
  eventBus.subscribeToAll((event) => {
    events.push(event);
  });
  return { eventBus, events };
}
