/**
 * Vitest configuration — two projects:
 *
 * - unit:        pure code (business rules, dates, CQRS buses, pagination, validation schemas).
 *                No database, runs in milliseconds.
 * - integration: command handlers and queries against a real PostgreSQL test database
 *                (transactions, row locks, conditional updates and constraints cannot be faked
 *                faithfully with mocks). Files run one after another because they share the database.
 *
 *   npm test                  → both projects
 *   npm run test:unit         → unit only (no Docker needed)
 *   npm run test:integration  → integration only (needs `docker compose up -d`)
 *   npm run test:coverage     → unit tests + coverage report (100% required on the business rules)
 */
import { defineConfig } from "vitest/config";
import { TEST_ENV } from "./tests/test-env";

export default defineConfig({
  test: {
    env: TEST_ENV,
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          globalSetup: ["tests/integration/global-setup.ts"],
          fileParallelism: false,
          testTimeout: 20_000,
          hookTimeout: 30_000,
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["src/modules/vacation-requests/vacation-request.rules.ts", "src/shared/**/*.ts"],
      // skipFull: false → list fully covered files too (they are the point of the report).
      reporter: [["text", { skipFull: false }], "html"],
      thresholds: {
        // The pure business rules must be fully covered.
        "src/modules/vacation-requests/vacation-request.rules.ts": {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
      },
    },
  },
});
