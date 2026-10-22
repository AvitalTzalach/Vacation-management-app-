/**
 * Runs once before the integration tests:
 * 1. creates the test database if it does not exist yet;
 * 2. applies the migrations to it (same migrations as the real database).
 */
import { Client } from "pg";
import { TEST_ENV } from "../test-env";

export default async function setup(): Promise<void> {
  Object.assign(process.env, TEST_ENV);

  // Connect to the default "postgres" database to be able to create the test database.
  const admin = new Client({
    host: TEST_ENV.DB_HOST,
    port: Number(TEST_ENV.DB_PORT),
    user: TEST_ENV.DB_USER,
    password: TEST_ENV.DB_PASSWORD,
    database: "postgres",
  });
  try {
    await admin.connect();
  } catch (error) {
    throw new Error(
      `Integration tests need PostgreSQL (run "docker compose up -d" at the project root). ${String(error)}`
    );
  }
  const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [TEST_ENV.DB_NAME]);
  if (exists.rowCount === 0) {
    // Identifiers cannot be query parameters; the name is a constant from test-env.ts.
    await admin.query(`CREATE DATABASE "${TEST_ENV.DB_NAME}"`);
  }
  await admin.end();

  const { getDataSource, closeDataSource } = await import("../../src/database/data-source");
  const dataSource = await getDataSource();
  await dataSource.runMigrations({ transaction: "each" });
  await closeDataSource();
}
