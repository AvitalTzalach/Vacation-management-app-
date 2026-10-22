/**
 * Initial database schema: `users` and `vacation_requests`.
 *
 * Written by hand (plain SQL) so every constraint and index is explicit and documented.
 * Column names follow the assignment exactly (snake_case).
 */
import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1792627200000 implements MigrationInterface {
  name = "InitialSchema1792627200000";

  // Creates the enums, tables, constraints and indexes.
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enums restrict the allowed values at the database level.
    await queryRunner.query(`CREATE TYPE "user_role" AS ENUM ('Requester', 'Validator')`);
    await queryRunner.query(
      `CREATE TYPE "vacation_request_status" AS ENUM ('Pending', 'Approved', 'Rejected')`
    );

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"         SERIAL       PRIMARY KEY,
        "name"       VARCHAR(100) NOT NULL,
        "email"      VARCHAR(255) NOT NULL,
        "password"   VARCHAR(255) NOT NULL,
        "role"       "user_role"  NOT NULL,
        "created_at" TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "uq_users_email" UNIQUE ("email")
      )
    `);

    // The two CHECK constraints repeat business rules 1 and 5 at the database level
    // (defense in depth): even a bug in the application cannot store such rows.
    await queryRunner.query(`
      CREATE TABLE "vacation_requests" (
        "id"         SERIAL                    PRIMARY KEY,
        "user_id"    INTEGER                   NOT NULL,
        "start_date" DATE                      NOT NULL,
        "end_date"   DATE                      NOT NULL,
        "reason"     TEXT,
        "status"     "vacation_request_status" NOT NULL DEFAULT 'Pending',
        "comments"   TEXT,
        "created_at" TIMESTAMPTZ               NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ               NOT NULL DEFAULT now(),
        CONSTRAINT "fk_vacation_requests_user"
          FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT,
        CONSTRAINT "chk_vacation_requests_end_after_start"
          CHECK ("end_date" > "start_date"),
        CONSTRAINT "chk_vacation_requests_rejected_has_comment"
          CHECK ("status" <> 'Rejected' OR length(btrim(coalesce("comments", ''))) > 0)
      )
    `);

    // Serves the overlap check when a request is created (business rule 2):
    //   WHERE user_id = :userId AND start_date <= :newEnd AND end_date >= :newStart
    // The equality column (user_id) comes first, then the range columns.
    await queryRunner.query(`
      CREATE INDEX "idx_vacation_requests_user_dates"
        ON "vacation_requests" ("user_id", "start_date", "end_date")
    `);

    // Serves "my requests" (requester) and the dashboard's user filter (validator):
    //   WHERE user_id = :userId ORDER BY created_at DESC, id DESC LIMIT :limit OFFSET :offset
    // Rows of one user are already sorted in the index, so no separate sort step is needed.
    await queryRunner.query(`
      CREATE INDEX "idx_vacation_requests_user_created"
        ON "vacation_requests" ("user_id", "created_at", "id")
    `);

    // Serves the dashboard's status filter (validator):
    //   WHERE status = :status ORDER BY created_at DESC, id DESC LIMIT :limit OFFSET :offset
    // A (user_id, status) index could not serve this query: status would not be the leftmost column.
    await queryRunner.query(`
      CREATE INDEX "idx_vacation_requests_status_created"
        ON "vacation_requests" ("status", "created_at", "id")
    `);
  }

  // Drops everything created in `up`, in reverse order.
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_vacation_requests_status_created"`);
    await queryRunner.query(`DROP INDEX "idx_vacation_requests_user_created"`);
    await queryRunner.query(`DROP INDEX "idx_vacation_requests_user_dates"`);
    await queryRunner.query(`DROP TABLE "vacation_requests"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "vacation_request_status"`);
    await queryRunner.query(`DROP TYPE "user_role"`);
  }
}
