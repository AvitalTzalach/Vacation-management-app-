/**
 * TypeORM DataSource (database connection), initialized lazily and only once.
 *
 * Why lazy: environment variables are loaded asynchronously by `loadEnv()`, so the
 * connection settings can only be read on first use, not when this module is imported.
 * Why once: the init promise is cached, so concurrent first requests share one connection pool
 * instead of each opening their own.
 */
import "reflect-metadata";
import { types } from "pg";
import { DataSource } from "typeorm";
import { getDatabaseConfig } from "../config";
import { User } from "../modules/users/user.entity";
import { VacationRequest } from "../modules/vacation-requests/vacation-request.entity";
import { InitialSchema1792627200000 } from "./migrations/1792627200000-InitialSchema";

// OID 1082 is PostgreSQL's `date` type. By default node-postgres converts it to a JS Date at
// local midnight, which can shift the day when serialized in another time zone.
// Returning the raw "YYYY-MM-DD" string keeps dates exact.
const PG_DATE_OID = 1082;
types.setTypeParser(PG_DATE_OID, (value: string) => value);

// Cached initialization promise (null until the first call).
let dataSourcePromise: Promise<DataSource> | null = null;

/**
 * Builds the DataSource from the current configuration.
 * Entities and migrations are listed explicitly (no glob paths) so they survive bundling by esbuild.
 */
function createDataSource(): DataSource {
  const db = getDatabaseConfig();
  return new DataSource({
    type: "postgres",
    host: db.host,
    port: db.port,
    username: db.username,
    password: db.password,
    database: db.database,
    entities: [User, VacationRequest],
    migrations: [InitialSchema1792627200000],
    // The schema is managed only by migrations, never auto-synchronized from entities.
    synchronize: false,
    logging: ["error"],
  });
}

/**
 * Returns the initialized DataSource, creating and connecting it on the first call.
 * If the connection fails, the cache is cleared so the next call can retry.
 */
export function getDataSource(): Promise<DataSource> {
  if (!dataSourcePromise) {
    dataSourcePromise = createDataSource()
      .initialize()
      .catch((error: unknown) => {
        dataSourcePromise = null;
        throw error;
      });
  }
  return dataSourcePromise;
}

// Closes the connection pool (used by CLI scripts such as migrate and seed).
export async function closeDataSource(): Promise<void> {
  if (!dataSourcePromise) return;
  const dataSource = await dataSourcePromise;
  dataSourcePromise = null;
  await dataSource.destroy();
}
