/**
 * User entity — maps the `users` table.
 *
 * Every column sets its database `name` (snake_case, as in the assignment) and its `type`
 * explicitly: the CEF build uses esbuild, which does not emit decorator metadata, so TypeORM
 * cannot infer column types from TypeScript types.
 *
 * The table itself (constraints, indexes) is created by the migration, not by `synchronize`.
 */
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

// The two roles of the application. Values are stored as-is in the `user_role` PostgreSQL enum.
export enum UserRole {
  Requester = "Requester",
  Validator = "Validator",
}

@Entity({ name: "users" })
export class User {
  @PrimaryGeneratedColumn("increment", { name: "id", type: "integer" })
  id!: number;

  @Column({ name: "name", type: "varchar", length: 100 })
  name!: string;

  // Unique login identifier (unique constraint defined in the migration).
  @Column({ name: "email", type: "varchar", length: 255, unique: true })
  email!: string;

  // bcrypt hash — never the plain password. `select: false` keeps it out of every query
  // unless it is explicitly requested (only the login command needs it).
  @Column({ name: "password", type: "varchar", length: 255, select: false })
  password!: string;

  @Column({ name: "role", type: "enum", enum: UserRole, enumName: "user_role" })
  role!: UserRole;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
