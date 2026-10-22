/**
 * Integration tests of the read side: lists, filters, pagination order, team planning, requesters.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDataSource, getDataSource } from "../../src/database/data-source";
import { listRequesters } from "../../src/modules/users/user.queries";
import { UserRole } from "../../src/modules/users/user.entity";
import { VacationRequestStatus } from "../../src/modules/vacation-requests/vacation-request.entity";
import {
  getTeamPlanning,
  listAllVacationRequests,
  listMyVacationRequests,
} from "../../src/modules/vacation-requests/vacation-request.queries";
import { createRequest, createUser, resetDatabase } from "./helpers";

const { Pending, Approved, Rejected } = VacationRequestStatus;

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await closeDataSource();
});

describe("listMyVacationRequests", () => {
  it("returns only the user's requests, newest first, with id as tie-breaker", async () => {
    const dataSource = await getDataSource();
    const maya = await createUser();
    const other = await createUser();
    const a = await createRequest(maya.id, "2030-01-10", "2030-01-12");
    const b = await createRequest(maya.id, "2030-02-10", "2030-02-12");
    const c = await createRequest(maya.id, "2030-03-10", "2030-03-12");
    await createRequest(other.id, "2030-01-10", "2030-01-12");
    // Same created_at for all three: the order must still be stable (id DESC).
    await dataSource.query(`UPDATE vacation_requests SET created_at = '2030-01-01T10:00:00Z'`);

    const page1 = await listMyVacationRequests(dataSource, maya.id, { page: 1, limit: 2 });
    const page2 = await listMyVacationRequests(dataSource, maya.id, { page: 2, limit: 2 });

    expect(page1.data.map((r) => r.id)).toEqual([c.id, b.id]);
    expect(page2.data.map((r) => r.id)).toEqual([a.id]);
    expect(page1.meta).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });
  });
});

describe("listAllVacationRequests", () => {
  async function seed() {
    const maya = await createUser({ name: "Maya" });
    const noa = await createUser({ name: "Noa" });
    await createRequest(maya.id, "2030-01-10", "2030-01-12", Pending);
    await createRequest(maya.id, "2030-02-10", "2030-02-12", Approved);
    await createRequest(noa.id, "2030-01-10", "2030-01-12", Pending);
    await createRequest(noa.id, "2030-03-10", "2030-03-12", Rejected);
    return { maya, noa };
  }

  it("includes the owner (id and name only) for every request", async () => {
    await seed();
    const result = await listAllVacationRequests(await getDataSource(), {}, { page: 1, limit: 10 });
    expect(result.meta.total).toBe(4);
    result.data.forEach((request) => {
      expect(Object.keys(request.user).sort()).toEqual(["id", "name"]);
    });
  });

  it("filters by status, by user, and by both", async () => {
    const { maya } = await seed();
    const dataSource = await getDataSource();
    const page = { page: 1, limit: 10 };

    const pending = await listAllVacationRequests(dataSource, { status: Pending }, page);
    expect(pending.data.every((r) => r.status === "Pending")).toBe(true);
    expect(pending.meta.total).toBe(2);

    const mine = await listAllVacationRequests(dataSource, { userId: maya.id }, page);
    expect(mine.data.every((r) => r.user.name === "Maya")).toBe(true);
    expect(mine.meta.total).toBe(2);

    const both = await listAllVacationRequests(dataSource, { status: Approved, userId: maya.id }, page);
    expect(both.meta.total).toBe(1);
  });
});

describe("getTeamPlanning", () => {
  it("returns Approved requests overlapping the range, without reason or comment", async () => {
    const maya = await createUser({ name: "Maya" });
    const noa = await createUser({ name: "Noa" });
    // Crosses the start of the range → included.
    await createRequest(maya.id, "2030-03-28", "2030-04-02", Approved);
    // Inside → included.
    await createRequest(noa.id, "2030-04-10", "2030-04-12", Approved);
    // Not approved → excluded.
    await createRequest(noa.id, "2030-04-20", "2030-04-22", Pending);
    // Outside the range → excluded.
    await createRequest(maya.id, "2030-05-01", "2030-05-03", Approved);

    const planning = await getTeamPlanning(await getDataSource(), { from: "2030-04-01", to: "2030-04-30" });

    expect(planning.from).toBe("2030-04-01");
    expect(planning.data).toEqual([
      { userId: maya.id, userName: "Maya", startDate: "2030-03-28", endDate: "2030-04-02" },
      { userId: noa.id, userName: "Noa", startDate: "2030-04-10", endDate: "2030-04-12" },
    ]);
  });
});

describe("listRequesters", () => {
  it("returns requesters only, sorted by name, with id and name only", async () => {
    await createUser({ name: "Zoe" });
    await createUser({ name: "Adam" });
    await createUser({ name: "Boss", role: UserRole.Validator });

    const requesters = await listRequesters(await getDataSource());

    expect(requesters.map((u) => u.name)).toEqual(["Adam", "Zoe"]);
    requesters.forEach((u) => expect(Object.keys(u).sort()).toEqual(["id", "name"]));
  });
});
