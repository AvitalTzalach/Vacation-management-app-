/**
 * VacationRequest entity — maps the `vacation_requests` table.
 *
 * Column names are snake_case exactly as in the assignment, and every column declares its
 * `type` explicitly (esbuild, used by the CEF build, does not emit decorator metadata).
 *
 * Indexes and CHECK constraints are defined in the migration (single source of truth for the schema).
 */
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "../users/user.entity";

// Lifecycle of a request: created as Pending, then Approved or Rejected by a validator.
export enum VacationRequestStatus {
  Pending = "Pending",
  Approved = "Approved",
  Rejected = "Rejected",
}

@Entity({ name: "vacation_requests" })
export class VacationRequest {
  @PrimaryGeneratedColumn("increment", { name: "id", type: "integer" })
  id!: number;

  // Owner of the request. Exposed as a plain column so it can be read and filtered
  // without loading the `user` relation.
  @Column({ name: "user_id", type: "integer" })
  userId!: number;

  // Same `user_id` column, mapped as a relation so queries can join the owner (name) in one query.
  @ManyToOne(() => User, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "user_id" })
  user?: User;

  // PostgreSQL `date` (no time, no time zone). Read back as a "YYYY-MM-DD" string
  // thanks to the pg type parser registered in data-source.ts.
  @Column({ name: "start_date", type: "date" })
  startDate!: string;

  @Column({ name: "end_date", type: "date" })
  endDate!: string;

  // Optional free text from the requester.
  @Column({ name: "reason", type: "text", nullable: true })
  reason!: string | null;

  @Column({
    name: "status",
    type: "enum",
    enum: VacationRequestStatus,
    enumName: "vacation_request_status",
    default: VacationRequestStatus.Pending,
  })
  status!: VacationRequestStatus;

  // Validator's comment. Mandatory when the request is Rejected (business rule 5).
  // The API field is named `comment`; the column keeps the assignment's name `comments`.
  @Column({ name: "comments", type: "text", nullable: true })
  comments!: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
