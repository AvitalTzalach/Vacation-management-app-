/**
 * Environment used by the tests.
 *
 * Integration tests run against a SEPARATE database (`vacation_management_test`) in the same
 * PostgreSQL container, so running them never touches the demo data. The test helpers refuse to
 * wipe a database whose name does not end with "_test".
 */
export const TEST_ENV = {
  DB_HOST: process.env.TEST_DB_HOST ?? "localhost",
  DB_PORT: process.env.TEST_DB_PORT ?? "5432",
  DB_USER: process.env.TEST_DB_USER ?? "vacation",
  DB_PASSWORD: process.env.TEST_DB_PASSWORD ?? "vacation",
  DB_NAME: "vacation_management_test",
  JWT_SECRET: "test-only-secret-not-used-anywhere-else",
};
