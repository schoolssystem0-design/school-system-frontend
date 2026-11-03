import { z } from "zod";

export const signInSchema = z.object({
  schoolCode: z
    .string()
    .trim()
    .min(2, "Enter your school code")
    .max(20, "School code is too long")
    .regex(/^[A-Za-z0-9-]+$/, "Use letters, numbers and hyphens only")
    .transform((v) => v.toUpperCase()),
  username: z.string().trim().min(1, "Enter your username").max(60),
  password: z.string().min(1, "Enter your password").max(200),
});

export type SignInValues = z.infer<typeof signInSchema>;
export type SignInErrors = Partial<Record<keyof SignInValues, string>>;

export function validateSignIn(input: Record<keyof SignInValues, string>):
  | { ok: true; values: SignInValues }
  | { ok: false; errors: SignInErrors } {
  const result = signInSchema.safeParse(input);
  if (result.success) return { ok: true, values: result.data };
  const errors: SignInErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as keyof SignInValues;
    errors[field] ??= issue.message;
  }
  return { ok: false, errors };
}

/** English messages for the backend's sign-in error codes. */
export function signInErrorMessage(code: string): string {
  switch (code) {
    case "INVALID_CREDENTIALS":
      return "School code, username or password is incorrect.";
    case "ACCOUNT_LOCKED":
      return "Too many failed attempts. Try again in 15 minutes or ask your administrator.";
    case "SCHOOL_SUSPENDED":
      return "This school's account is suspended. Contact the system owner.";
    case "RATE_LIMITED":
      return "Too many sign-in attempts from this network. Wait a few minutes and try again.";
    case "VALIDATION_FAILED":
      return "Please check the highlighted fields.";
    default:
      return "Sign-in failed. Please try again.";
  }
}

export const SCHOOL_CODE_STORAGE_KEY = "sms.schoolCode";

/** Only allow redirects back into the school portal (prevents open redirects). */
export function safeNextPath(next: string | null): string {
  return next && /^\/app(\/[A-Za-z0-9\-_/]*)?$/.test(next) ? next : "/app";
}
