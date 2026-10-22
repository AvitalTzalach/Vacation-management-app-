/**
 * CLI script: applies pending migrations, or reverts the last one with `--revert`.
 *
 *   npm run db:migrate   → run all pending migrations
 *   npm run db:revert    → undo the last applied migration
 *
 * Uses the same lazy DataSource as the API, so configuration lives in one place.
 */
import { loadEnv } from "commoneventframework";
import { closeDataSource, getDataSource } from "./data-source";

async function main(): Promise<void> {
  // Load .env before anything reads the configuration.
  await loadEnv();
  const dataSource = await getDataSource();

  if (process.argv.includes("--revert")) {
    await dataSource.undoLastMigration();
    console.log("[migrate] Last migration reverted.");
    return;
  }

  const applied = await dataSource.runMigrations({ transaction: "each" });
  if (applied.length === 0) {
    console.log("[migrate] Database is already up to date.");
  } else {
    applied.forEach((migration) => console.log(`[migrate] Applied ${migration.name}`));
  }
}

main()
  .catch((error: unknown) => {
    console.error("[migrate] Failed:", error);
    process.exitCode = 1;
  })
  .finally(() => closeDataSource());
