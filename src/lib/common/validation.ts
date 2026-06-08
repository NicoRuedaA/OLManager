import { z } from "zod";

// ── Constants (shared concept with Rust backend) ───────────

export const MAX_NAME_LENGTH = 30;
export const MAX_NICKNAME_LENGTH = 30;
export const MAX_NATIONALITY_LENGTH = 3;

// ── Manager Profile ────────────────────────────────────────

/** Date format: YYYY-MM-DD */
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const managerProfileSchema = z.object({
  nickname: z
    .string()
    .max(MAX_NICKNAME_LENGTH, `Nickname must be at most ${MAX_NICKNAME_LENGTH} characters`)
    .optional(),
  first_name: z
    .string()
    .max(MAX_NAME_LENGTH, `First name must be at most ${MAX_NAME_LENGTH} characters`)
    .optional(),
  last_name: z
    .string()
    .max(MAX_NAME_LENGTH, `Last name must be at most ${MAX_NAME_LENGTH} characters`)
    .optional(),
  dob: z
    .string()
    .regex(dateRegex, "Date of birth must be in YYYY-MM-DD format")
    .optional(),
  nationality: z
    .string()
    .max(MAX_NATIONALITY_LENGTH, "Nationality code must be at most 3 characters")
    .optional(),
  avatar_path: z.string().optional(),
});

export type ManagerProfileInput = z.infer<typeof managerProfileSchema>;
