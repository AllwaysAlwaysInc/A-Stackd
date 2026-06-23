export type UserRole = "user" | "admin";

export interface User {
  userId: string;
  email: string;
  passwordHash: string;
  role: UserRole;
}

/** Normalize emails so lookups are case-insensitive and trimmed. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
