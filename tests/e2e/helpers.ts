import { createHmac } from "node:crypto";
import { expect, type Page } from "@playwright/test";

export const API = process.env.E2E_API_URL ?? "http://localhost:8080/api/v1";

// Seeded by LocalDevApplication (backend).
export const SCHOOL = process.env.E2E_SCHOOL ?? "DEMO";
export const OTHER_SCHOOL = process.env.E2E_OTHER_SCHOOL ?? "DEMO2";
export const USERNAME = process.env.E2E_USERNAME ?? "admin";
export const PASSWORD = process.env.E2E_PASSWORD ?? "Admin@12345";
export const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL ?? "owner@local.test";
export const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD ?? "Owner@123456";
export const OWNER_TOTP_SECRET = process.env.E2E_OWNER_TOTP_SECRET ?? "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";

function base32Decode(text: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of text.replace(/=+$/, "").toUpperCase()) {
    value = (value << 5) | alphabet.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** RFC 6238 code for the given secret, same as an authenticator app. */
export function totp(secret: string, at = Date.now()) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)));
  const hash = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hash[hash.length - 1] & 0x0f;
  const binary = (hash.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(binary).padStart(6, "0");
}

export async function signInSchool(page: Page, school = SCHOOL, username = USERNAME, password = PASSWORD) {
  await page.goto("/sign-in");
  await page.getByLabel("School code").fill(school);
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: /Welcome/ })).toBeVisible();
}

export async function signInOwner(page: Page) {
  await page.goto("/platform/sign-in");
  await page.getByLabel("Email").fill(OWNER_EMAIL);
  await page.getByLabel("Password").fill(OWNER_PASSWORD);
  await page.getByLabel("Authenticator code").fill(totp(OWNER_TOTP_SECRET));
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "All schools" })).toBeVisible();
}

/** Latest step-up code from the local dev outbox (local profile only). */
export async function latestCode(page: Page) {
  const response = await page.request.get(`${API}/dev/outbox`);
  const entries = (await response.json()) as { message: { subject: string | null; body: string } }[];
  // Newest first; an SMS being dispatched can land on top of the code
  const code = entries.find((e) => e.message.subject === "Your verification code");
  const match = code?.message.body.match(/\b(\d{6})\b/);
  if (!match) throw new Error("No verification code in the dev outbox");
  return match[1];
}

/** Calls the API with the page's session cookie and a CSRF token (test set-up only). */
export async function apiCall<T>(page: Page, method: "GET" | "POST" | "PUT", path: string, body?: unknown): Promise<T> {
  const csrf = (await (await page.request.get(`${API}/auth/csrf`)).json()) as { token: string };
  const response = await page.request.fetch(`${API}${path}`, {
    method,
    headers: { "X-XSRF-TOKEN": csrf.token, "Content-Type": "application/json" },
    data: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok()) throw new Error(`${method} ${path} failed: ${response.status()} ${await response.text()}`);
  return (response.status() === 204 ? undefined : await response.json()) as T;
}
