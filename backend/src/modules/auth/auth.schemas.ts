/**
 * Validation schemas for authentication input.
 */
import { z } from "zod";

// Body of POST /auth/login. The email is normalized (trimmed, lower-case) before lookup.
export const loginSchema = z
  .object({
    email: z
      .string({ required_error: "Email is required" })
      .trim()
      .toLowerCase()
      .email("Email is not valid"),
    password: z.string({ required_error: "Password is required" }).min(1, "Password is required"),
  })
  .strict();

export type LoginInput = z.infer<typeof loginSchema>;
