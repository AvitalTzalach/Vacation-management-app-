/**
 * Integration tests of CreateVacationRequestHandler against PostgreSQL:
 * rules 1, 2 and 4, the event, and the row lock that prevents parallel overlapping requests.
 * "Today" is fixed to 2030-01-01 through the injected clock, so the tests never depend on the real date.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDataSource, getDataSource } from "../../src/database/data-source";
import {
  CreateVacationRequestCommand,
  CreateVacationRequestHandler,
} from "../../src/modules/vacation-requests/commands/create-vacation-request.command";
import { VacationRequestStatus } from "../../src/modules/vacation-requests/vacation-request.entity";
import { VacationRequestCreatedEvent } from "../../src/modules/vacation-requests/vacation-request.events";
import { ConflictError, UnauthorizedError, ValidationError } from "../../src/shared/errors";
import { createRequest, createUser, findRequest, recordingEventBus, resetDatabase } from "./helpers";

const TODAY = "2030-01-01";

function setup() {
  const { eventBus, events } = recordingEventBus();
  const handler = new CreateVacationRequestHandler(getDataSource, eventBus, () => TODAY);
  return { handler, events };
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await closeDataSource();
});

describe("CreateVacationRequestHandler", () => {
  it("creates a Pending request owned by the user and publishes VacationRequestCreatedEvent", async () => {
    const { handler, events } = setup();
    const user = await createUser();

    const created = await handler.execute(new CreateVacationRequestCommand(user.id, "2030-02-10", "2030-02-14", "Ski"));

    expect(created).toMatchObject({
      userId: user.id,
      startDate: "2030-02-10",
      endDate: "2030-02-14",
      reason: "Ski",
      status: "Pending",
      comment: null,
    });
    const stored = await findRequest(created.id);
    expect(stored?.status).toBe(VacationRequestStatus.Pending);

    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(VacationRequestCreatedEvent);
    expect(events[0]).toMatchObject({ requestId: created.id, userId: user.id });
  });

  it("allows a request starting today", async () => {
    const { handler } = setup();
    const user = await createUser();
    await expect(
      handler.execute(new CreateVacationRequestCommand(user.id, TODAY, "2030-01-02", null))
    ).resolves.toMatchObject({ startDate: TODAY });
  });

  it("rule 1: rejects a same-day request without writing anything", async () => {
    const { handler, events } = setup();
    const user = await createUser();
    await expect(
      handler.execute(new CreateVacationRequestCommand(user.id, "2030-02-10", "2030-02-10", null))
    ).rejects.toBeInstanceOf(ValidationError);
    expect(events).toHaveLength(0);
    expect(await (await getDataSource()).query("SELECT count(*)::int AS n FROM vacation_requests")).toEqual([{ n: 0 }]);
  });

  it("rule 4: rejects a request starting in the past", async () => {
    const { handler } = setup();
    const user = await createUser();
    await expect(
      handler.execute(new CreateVacationRequestCommand(user.id, "2029-12-31", "2030-01-05", null))
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it.each([VacationRequestStatus.Pending, VacationRequestStatus.Approved])(
    "rule 2: rejects an overlap with a %s request (409 with the conflicting request)",
    async (status) => {
      const { handler, events } = setup();
      const user = await createUser();
      const existing = await createRequest(user.id, "2030-03-10", "2030-03-15", status);

      const attempt = handler.execute(new CreateVacationRequestCommand(user.id, "2030-03-14", "2030-03-20", null));

      await expect(attempt).rejects.toBeInstanceOf(ConflictError);
      await expect(attempt).rejects.toMatchObject({
        details: { conflictingRequest: { id: existing.id, startDate: "2030-03-10", endDate: "2030-03-15" } },
      });
      expect(events).toHaveLength(0);
    }
  );

  it("rule 2: dates are inclusive — starting on the last day of another request is an overlap", async () => {
    const { handler } = setup();
    const user = await createUser();
    await createRequest(user.id, "2030-03-10", "2030-03-15");
    await expect(
      handler.execute(new CreateVacationRequestCommand(user.id, "2030-03-15", "2030-03-17", null))
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("rule 2: the next day is not an overlap", async () => {
    const { handler } = setup();
    const user = await createUser();
    await createRequest(user.id, "2030-03-10", "2030-03-15");
    await expect(
      handler.execute(new CreateVacationRequestCommand(user.id, "2030-03-16", "2030-03-17", null))
    ).resolves.toMatchObject({ status: "Pending" });
  });

  it("rule 2: a Rejected request does not block its dates", async () => {
    const { handler } = setup();
    const user = await createUser();
    await createRequest(user.id, "2030-03-10", "2030-03-15", VacationRequestStatus.Rejected);
    await expect(
      handler.execute(new CreateVacationRequestCommand(user.id, "2030-03-10", "2030-03-15", null))
    ).resolves.toMatchObject({ status: "Pending" });
  });

  it("rule 2: other users' requests do not block", async () => {
    const { handler } = setup();
    const alice = await createUser();
    const bob = await createUser();
    await createRequest(alice.id, "2030-03-10", "2030-03-15");
    await expect(
      handler.execute(new CreateVacationRequestCommand(bob.id, "2030-03-10", "2030-03-15", null))
    ).resolves.toMatchObject({ userId: bob.id });
  });

  it("concurrency: 5 identical requests in parallel → exactly one is created (row lock)", async () => {
    const { handler, events } = setup();
    const user = await createUser();

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        handler.execute(new CreateVacationRequestCommand(user.id, "2030-04-01", "2030-04-05", null))
      )
    );

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(rejected).toHaveLength(4);
    rejected.forEach((r) => expect(r.reason).toBeInstanceOf(ConflictError));
    expect(events).toHaveLength(1);
  });

  it("rejects a token whose user no longer exists", async () => {
    const { handler } = setup();
    await expect(
      handler.execute(new CreateVacationRequestCommand(9999, "2030-02-10", "2030-02-12", null))
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
