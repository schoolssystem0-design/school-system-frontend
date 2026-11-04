# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: zz-visual-tmp.spec.ts >> mobile screens
- Location: tests\e2e\zz-visual-tmp.spec.ts:25:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: /Welcome/ })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('heading', { name: /Welcome/ }) with timeout 5000ms
  - waiting for getByRole('heading', { name: /Welcome/ })

```

```yaml
- img
- heading "This page couldn’t load" [level=1]
- paragraph: Reload to try again, or go back.
- button "Reload"
- button "Back"
```

# Test source

```ts
  1  | import { createHmac } from "node:crypto";
  2  | import { expect, type Page } from "@playwright/test";
  3  | 
  4  | export const API = process.env.E2E_API_URL ?? "http://localhost:8080/api/v1";
  5  | 
  6  | // Seeded by LocalDevApplication (backend).
  7  | export const SCHOOL = process.env.E2E_SCHOOL ?? "DEMO";
  8  | export const OTHER_SCHOOL = process.env.E2E_OTHER_SCHOOL ?? "DEMO2";
  9  | export const USERNAME = process.env.E2E_USERNAME ?? "admin";
  10 | export const PASSWORD = process.env.E2E_PASSWORD ?? "Admin@12345";
  11 | export const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL ?? "owner@local.test";
  12 | export const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD ?? "Owner@123456";
  13 | export const OWNER_TOTP_SECRET = process.env.E2E_OWNER_TOTP_SECRET ?? "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";
  14 | 
  15 | function base32Decode(text: string) {
  16 |   const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  17 |   let bits = 0;
  18 |   let value = 0;
  19 |   const out: number[] = [];
  20 |   for (const char of text.replace(/=+$/, "").toUpperCase()) {
  21 |     value = (value << 5) | alphabet.indexOf(char);
  22 |     bits += 5;
  23 |     if (bits >= 8) {
  24 |       out.push((value >>> (bits - 8)) & 0xff);
  25 |       bits -= 8;
  26 |     }
  27 |   }
  28 |   return Buffer.from(out);
  29 | }
  30 | 
  31 | /** RFC 6238 code for the given secret, same as an authenticator app. */
  32 | export function totp(secret: string, at = Date.now()) {
  33 |   const counter = Buffer.alloc(8);
  34 |   counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)));
  35 |   const hash = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  36 |   const offset = hash[hash.length - 1] & 0x0f;
  37 |   const binary = (hash.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  38 |   return String(binary).padStart(6, "0");
  39 | }
  40 | 
  41 | export async function signInSchool(page: Page, school = SCHOOL, username = USERNAME, password = PASSWORD) {
  42 |   await page.goto("/sign-in");
  43 |   await page.getByLabel("School code").fill(school);
  44 |   await page.getByLabel("Username").fill(username);
  45 |   await page.getByLabel("Password").fill(password);
  46 |   await page.getByRole("button", { name: "Sign in" }).click();
> 47 |   await expect(page.getByRole("heading", { name: /Welcome/ })).toBeVisible();
     |                                                                ^ Error: expect(locator).toBeVisible() failed
  48 | }
  49 | 
  50 | export async function signInOwner(page: Page) {
  51 |   await page.goto("/platform/sign-in");
  52 |   await page.getByLabel("Email").fill(OWNER_EMAIL);
  53 |   await page.getByLabel("Password").fill(OWNER_PASSWORD);
  54 |   await page.getByLabel("Authenticator code").fill(totp(OWNER_TOTP_SECRET));
  55 |   await page.getByRole("button", { name: "Sign in" }).click();
  56 |   await expect(page.getByRole("heading", { name: "All schools" })).toBeVisible();
  57 | }
  58 | 
  59 | /** Latest step-up code from the local dev outbox (local profile only). */
  60 | export async function latestCode(page: Page) {
  61 |   const response = await page.request.get(`${API}/dev/outbox`);
  62 |   const entries = (await response.json()) as { message: { subject: string | null; body: string } }[];
  63 |   // Newest first; an SMS being dispatched can land on top of the code
  64 |   const code = entries.find((e) => e.message.subject === "Your verification code");
  65 |   const match = code?.message.body.match(/\b(\d{6})\b/);
  66 |   if (!match) throw new Error("No verification code in the dev outbox");
  67 |   return match[1];
  68 | }
  69 | 
  70 | /** Calls the API with the page's session cookie and a CSRF token (test set-up only). */
  71 | export async function apiCall<T>(page: Page, method: "GET" | "POST" | "PUT", path: string, body?: unknown): Promise<T> {
  72 |   const csrf = (await (await page.request.get(`${API}/auth/csrf`)).json()) as { token: string };
  73 |   const response = await page.request.fetch(`${API}${path}`, {
  74 |     method,
  75 |     headers: { "X-XSRF-TOKEN": csrf.token, "Content-Type": "application/json" },
  76 |     data: body === undefined ? undefined : JSON.stringify(body),
  77 |   });
  78 |   if (!response.ok()) throw new Error(`${method} ${path} failed: ${response.status()} ${await response.text()}`);
  79 |   return (response.status() === 204 ? undefined : await response.json()) as T;
  80 | }
  81 | 
```