/**
 * Integration tests of ApproveVacationRequestHandler and RejectVacationRequestHandler:
 * rule 3 (only Pending requests change), rule 5 (comment required), 404 / 409, events,
 * and the race between two validators.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDataSource, getDataSource } from "../../src/database/data-source";
import {
  ApproveVacationRequestCommand,
  ApproveVacationRequestHandler,
} from "../../src/modules/vacation-requests/commands/approve-vacation-request.command";
import {
  RejectVacationRequestCommand,
  RejectVacationRequestHandler,
} from "../../src/modules/vacation-requests/commands/reject-vacation-request.command";
import { VacationRequestStatus } from "../../src/modules/vacation-requests/vacation-request.entity";
import {
  VacationRequestApprovedEvent,
  VacationRequestRejectedEvent,
} from "../../src/modules/vacation-requests/vacation-request.events";
import { ConflictError, NotFoundError, ValidationError } from "../../src/shared/errors";
import { UserRole } from "../../src/modules/users/user.entity";
import { createRequest, createUser, findRequest, recordingEventBus, resetDatabase } from "./helpers";

const { Pending, Approved, Rejected } = VacationRequestStatus;

function setup() {
  const { eventBus, events } = recordingEventBus();
  return {
    approve: new ApproveVacationRequestHandler(getDataSource, eventBus),
    reject: new RejectVacationRequestHandler(getDataSource, eventBus),
    events,
  };
}

// A requester with one Pending request, and a validator.
async function fixture(status: VacationRequestStatus = Pending) {
  const requester = await createUser();
  const validator = await createUser({ role: UserRole.Validator });
  const request = await createRequest(requester.id, "2030-05-10", "2030-05-12", status);
  return { requester, validator, request };
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await closeDataSource();
});

describe("ApproveVacationRequestHandler", () => {
  it("approves a Pending request, updates updated_at and publishes the event with the validator", async () => {
    const { approve, events } = setup();
    const { requester, validator, request } = await fixture();

    const result = await approve.execute(new ApproveVacationRequestCommand(request.id, validator.id));

    expect(result).toMatchObject({ id: request.id, status: "Approved", comment: null });
    const stored = await findRequest(request.id);
    expect(stored?.status).toBe(Approved);
    expect(stored!.updatedAt.getTime()).toBeGreaterThanOrEqual(request.updatedAt.getTime());
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(VacationRequestApprovedEvent);
    expect(events[0]).toMatchObject({ requestId: request.id, userId: requester.id, validatorId: validator.id });
  });

  it("rule 3: an Approved request cannot be approved again (409)", async () => {
    const { approve, events } = setup();
    const { validator, request } = await fixture(Approved);
    await expect(approve.execute(new ApproveVacationRequestCommand(request.id, validator.id))).rejects.toBeInstanceOf(
      ConflictError
    );
    expect(events).toHaveLength(0);
  });

  it("rule 3: a Rejected request cannot be approved (409) and keeps its comment", async () => {
    const { approve } = setup();
    const { validator, request } = await fixture(Rejected);
    await expect(approve.execute(new ApproveVacationRequestCommand(request.id, validator.id))).rejects.toMatchObject({
      details: { currentStatus: "Rejected" },
    });
    expect((await findRequest(request.id))?.comments).toBe("Not possible");
  });

  it("returns 404 for an unknown request", async () => {
    const { approve } = setup();
    const { validator } = await fixture();
    await expect(approve.execute(new ApproveVacationRequestCommand(9999, validator.id))).rejects.toBeInstanceOf(
      NotFoundError
    );
  });

  it("rule 4 applies to creation only: a past Pending request can still be approved", async () => {
    const { approve } = setup();
    const requester = await createUser();
    const validator = await createUser({ role: UserRole.Validator });
    const past = await createRequest(requester.id, "2020-01-10", "2020-01-12");
    await expect(approve.execute(new ApproveVacationRequestCommand(past.id, validator.id))).resolves.toMatchObject({
      status: "Approved",
    });
  });
});

describe("RejectVacationRequestHandler", () => {
  it("rejects a Pending request, stores the trimmed comment and publishes the event", async () => {
    const { reject, events } = setup();
    const { validator, request } = await fixture();

    const result = await reject.execute(new RejectVacationRequestCommand(request.id, validator.id, "  Release week  "));

    expect(result).toMatchObject({ status: "Rejected", comment: "Release week" });
    expect((await findRequest(request.id))?.comments).toBe("Release week");
    expect(events[0]).toBeInstanceOf(VacationRequestRejectedEvent);
    expect(events[0]).toMatchObject({ comment: "Release week", validatorId: validator.id });
  });

  it.each(["", "   "])("rule 5: refuses comment %j before touching the database", async (comment) => {
    const { reject, events } = setup();
    const { validator, request } = await fixture();
    await expect(reject.execute(new RejectVacationRequestCommand(request.id, validator.id, comment))).rejects.toBeInstanceOf(
      ValidationError
    );
    expect((await findRequest(request.id))?.status).toBe(Pending);
    expect(events).toHaveLength(0);
  });

  it("rule 3: an Approved request cannot be rejected (409)", async () => {
    const { reject } = setup();
    const { validator, request } = await fixture(Approved);
    await expect(
      reject.execute(new RejectVacationRequestCommand(request.id, validator.id, "Too late"))
    ).rejects.toBeInstanceOf(ConflictError);
    expect((await findRequest(request.id))?.status).toBe(Approved);
  });

  it("the database also enforces rule 5 (CHECK constraint)", async () => {
    const { request } = await fixture();
    const dataSource = await getDataSource();
    await expect(
      dataSource.query(`UPDATE vacation_requests SET status = 'Rejected', comments = '  ' WHERE id = $1`, [request.id])
    ).rejects.toMatchObject({ constraint: "chk_vacation_requests_rejected_has_comment" });
  });
});

describe("race between validators", () => {
  it("5 approvals and 5 rejections at the same time → exactly one wins, the others get 409", async () => {
    const { approve, reject, events } = setup();
    const { validator, request } = await fixture();

    const results = await Promise.allSettled([
      ...Array.from({ length: 5 }, () => approve.execute(new ApproveVacationRequestCommand(request.id, validator.id))),
      ...Array.from({ length: 5 }, () =>
        reject.execute(new RejectVacationRequestCommand(request.id, validator.id, "No"))
      ),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    results
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .forEach((r) => expect(r.reason).toBeInstanceOf(ConflictError));
    expect(events).toHaveLength(1);
  });
});
