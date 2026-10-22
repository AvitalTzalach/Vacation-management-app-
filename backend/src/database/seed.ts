/**
 * CLI script: inserts demo data (npm run db:seed).
 *
 * - 1 Validator and 5 Requesters, all with the password "password".
 * - 25 vacation requests in mixed statuses, so pagination and filters are visible.
 *
 * Guarantees:
 * - Idempotent: users are upserted by email and the demo users' requests are deleted and
 *   re-inserted, so running it again always gives the same state. Other users are not touched.
 * - Valid data: no overlapping requests per user and every Rejected request has a comment
 *   (checked by `assertSeedIsValid` before anything is written).
 * - Dates are relative to today, so the demo always shows past, current and upcoming vacations.
 *   Past requests are allowed here on purpose: rule 4 only applies when a request is created.
 */
import { loadEnv } from "commoneventframework";
import bcrypt from "bcryptjs";
import { In } from "typeorm";
import { closeDataSource, getDataSource } from "./data-source";
import { User, UserRole } from "../modules/users/user.entity";
import {
  VacationRequest,
  VacationRequestStatus,
} from "../modules/vacation-requests/vacation-request.entity";
import { addDays, todayIso } from "../shared/dates";

// Password of every demo account (documented in the README).
const DEMO_PASSWORD = "password";

// bcrypt cost factor: 10 rounds is the common default (about 100 ms per hash).
const BCRYPT_ROUNDS = 10;

interface SeedUser {
  name: string;
  email: string;
  role: UserRole;
}

// A request described with day offsets from today (negative = in the past).
interface SeedRequest {
  startOffset: number;
  endOffset: number;
  status: VacationRequestStatus;
  reason: string | null;
  comment?: string;
}

const { Pending, Approved, Rejected } = VacationRequestStatus;

const DEMO_USERS: SeedUser[] = [
  { name: "Sarah Manager", email: "sarah.manager@example.com", role: UserRole.Validator },
  { name: "Maya Levi", email: "maya.levi@example.com", role: UserRole.Requester },
  { name: "Daniel Cohen", email: "daniel.cohen@example.com", role: UserRole.Requester },
  { name: "Noa Katz", email: "noa.katz@example.com", role: UserRole.Requester },
  { name: "Lucas Martin", email: "lucas.martin@example.com", role: UserRole.Requester },
  { name: "Emma Dubois", email: "emma.dubois@example.com", role: UserRole.Requester },
];

// Requests per requester email. Within one user the ranges never overlap.
const DEMO_REQUESTS: Record<string, SeedRequest[]> = {
  "maya.levi@example.com": [
    { startOffset: -40, endOffset: -36, status: Approved, reason: "Spring break" },
    { startOffset: 3, endOffset: 6, status: Approved, reason: "Long weekend" },
    { startOffset: 20, endOffset: 24, status: Pending, reason: "Family visit" },
    { startOffset: 45, endOffset: 49, status: Pending, reason: "Hiking in the Alps" },
    {
      startOffset: 70, endOffset: 72, status: Rejected, reason: "Personal",
      comment: "Team offsite that week, please choose other dates.",
    },
  ],
  "daniel.cohen@example.com": [
    { startOffset: -20, endOffset: -15, status: Approved, reason: "Family trip" },
    { startOffset: 8, endOffset: 12, status: Pending, reason: "Wedding" },
    {
      startOffset: 30, endOffset: 37, status: Rejected, reason: "Summer holiday",
      comment: "Release week, please pick other dates.",
    },
    { startOffset: 38, endOffset: 42, status: Approved, reason: "Summer holiday (new dates)" },
    { startOffset: 90, endOffset: 95, status: Pending, reason: null },
  ],
  "noa.katz@example.com": [
    {
      startOffset: -10, endOffset: -7, status: Rejected, reason: "Personal",
      comment: "Too many people away that week.",
    },
    { startOffset: 1, endOffset: 4, status: Approved, reason: "Long weekend" },
    { startOffset: 15, endOffset: 21, status: Pending, reason: null },
    { startOffset: 50, endOffset: 55, status: Approved, reason: "Family trip to the coast" },
    { startOffset: 80, endOffset: 84, status: Pending, reason: "Moving house" },
  ],
  "lucas.martin@example.com": [
    { startOffset: -60, endOffset: -50, status: Approved, reason: "Winter holiday" },
    { startOffset: 5, endOffset: 9, status: Pending, reason: "Ski trip" },
    {
      startOffset: 25, endOffset: 27, status: Rejected, reason: "Personal",
      comment: "Quarter-end closing, not possible.",
    },
    { startOffset: 28, endOffset: 31, status: Pending, reason: "Personal (new dates)" },
    { startOffset: 60, endOffset: 65, status: Approved, reason: "Visiting family in Lyon" },
  ],
  "emma.dubois@example.com": [
    { startOffset: -5, endOffset: -2, status: Approved, reason: "Short break" },
    { startOffset: 10, endOffset: 14, status: Approved, reason: "Wedding anniversary" },
    { startOffset: 35, endOffset: 40, status: Pending, reason: "Road trip" },
    {
      startOffset: 55, endOffset: 58, status: Rejected, reason: null,
      comment: "Critical project deadline.",
    },
    { startOffset: 100, endOffset: 105, status: Pending, reason: "Autumn holiday" },
  ],
};

/**
 * Checks the seed data against the business rules before writing it:
 * end after start, a comment on every Rejected request, no overlap per user
 * (inclusive dates, among Pending and Approved requests — same rule as the API).
 */
function assertSeedIsValid(): void {
  for (const [email, requests] of Object.entries(DEMO_REQUESTS)) {
    for (const request of requests) {
      if (request.endOffset <= request.startOffset) {
        throw new Error(`Seed: end must be after start (${email})`);
      }
      if (request.status === Rejected && !request.comment?.trim()) {
        throw new Error(`Seed: rejected request without comment (${email})`);
      }
    }

    const blocking = requests.filter((r) => r.status !== Rejected);
    for (let i = 0; i < blocking.length; i++) {
      for (let j = i + 1; j < blocking.length; j++) {
        const a = blocking[i];
        const b = blocking[j];
        if (a.startOffset <= b.endOffset && a.endOffset >= b.startOffset) {
          throw new Error(`Seed: overlapping requests for ${email}`);
        }
      }
    }
  }
}

async function main(): Promise<void> {
  assertSeedIsValid();

  // Load .env before anything reads the configuration.
  await loadEnv();
  const dataSource = await getDataSource();
  // One hash PER USER: bcrypt generates a new random salt on every call, so even identical passwords
  // get different hashes. Reusing a single hash would reveal that the accounts share a password.
  const usersWithHashes = await Promise.all(
    DEMO_USERS.map(async (user) => ({ ...user, password: await bcrypt.hash(DEMO_PASSWORD, BCRYPT_ROUNDS) }))
  );
  const today = todayIso();

  // One transaction: the seed is applied completely or not at all.
  await dataSource.transaction(async (manager) => {
    const userRepository = manager.getRepository(User);
    const requestRepository = manager.getRepository(VacationRequest);

    // Insert the demo users, or update them if their email already exists.
    await userRepository.upsert(usersWithHashes, ["email"]);

    const users = await userRepository.findBy({ email: In(DEMO_USERS.map((u) => u.email)) });
    const userIdByEmail = new Map(users.map((user) => [user.email, user.id]));

    // Remove the previous demo requests so re-running the seed does not duplicate them.
    await requestRepository.delete({ userId: In(users.map((user) => user.id)) });

    // Build the rows. created_at is spread over the last hours (oldest first), so the
    // "newest first" ordering of the lists looks realistic.
    const rows = Object.entries(DEMO_REQUESTS).flatMap(([email, requests]) =>
      requests.map((request) => ({ email, request }))
    );
    const now = Date.now();
    const entities = rows.map(({ email, request }, index) =>
      requestRepository.create({
        userId: userIdByEmail.get(email),
        startDate: addDays(today, request.startOffset),
        endDate: addDays(today, request.endOffset),
        reason: request.reason,
        status: request.status,
        comments: request.comment ?? null,
        createdAt: new Date(now - (rows.length - index) * 60 * 60 * 1000),
      })
    );
    await requestRepository.insert(entities);
  });

  const requestCount = Object.values(DEMO_REQUESTS).flat().length;
  console.log(`[seed] ${DEMO_USERS.length} users and ${requestCount} requests ready.`);
  console.log(`[seed] Demo password for every account: "${DEMO_PASSWORD}"`);
  DEMO_USERS.forEach((user) => console.log(`[seed]   ${user.role.padEnd(9)} ${user.email}`));
}

main()
  .catch((error: unknown) => {
    console.error("[seed] Failed:", error);
    process.exitCode = 1;
  })
  .finally(() => closeDataSource());
