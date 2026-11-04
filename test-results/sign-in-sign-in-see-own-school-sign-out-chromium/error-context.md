# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: sign-in.spec.ts >> sign in, see own school, sign out
- Location: tests\e2e\sign-in.spec.ts:19:5

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
  1  | import { expect, test } from "@playwright/test";
  2  | import { OTHER_SCHOOL, PASSWORD, SCHOOL, USERNAME, signInSchool } from "./helpers";
  3  | 
  4  | test("visiting the portal without a session goes to sign-in", async ({ page }) => {
  5  |   await page.goto("/app");
  6  |   await expect(page).toHaveURL(/\/sign-in\?next=%2Fapp/);
  7  |   await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  8  | });
  9  | 
  10 | test("wrong password shows a clear error", async ({ page }) => {
  11 |   await page.goto("/sign-in");
  12 |   await page.getByLabel("School code").fill(SCHOOL);
  13 |   await page.getByLabel("Username").fill(USERNAME);
  14 |   await page.getByLabel("Password").fill("definitely-wrong");
  15 |   await page.getByRole("button", { name: "Sign in" }).click();
  16 |   await expect(page.getByRole("alert").filter({ hasText: "incorrect" })).toBeVisible();
  17 | });
  18 | 
  19 | test("sign in, see own school, sign out", async ({ page }) => {
  20 |   await page.goto(`/s/${SCHOOL.toLowerCase()}`);
  21 |   await expect(page.getByLabel("School code")).toHaveValue(SCHOOL);
  22 |   await page.getByLabel("Username").fill(USERNAME);
  23 |   await page.getByLabel("Password").fill(PASSWORD);
  24 |   await page.getByRole("button", { name: "Sign in" }).click();
  25 | 
  26 |   await expect(page).toHaveURL(/\/app$/);
> 27 |   await expect(page.getByRole("heading", { name: /Welcome/ })).toBeVisible();
     |                                                                ^ Error: expect(locator).toBeVisible() failed
  28 |   await expect(page.getByText(`(${SCHOOL})`, { exact: true })).toBeVisible();
  29 | 
  30 |   // Session survives a reload (server-side session cookie).
  31 |   await page.reload();
  32 |   await expect(page.getByRole("heading", { name: /Welcome/ })).toBeVisible();
  33 | 
  34 |   await page.getByRole("button", { name: "Sign out" }).click();
  35 |   await expect(page).toHaveURL(/\/sign-in/);
  36 |   await page.goto("/app");
  37 |   await expect(page).toHaveURL(/\/sign-in/);
  38 | });
  39 | 
  40 | test("same username in another school is a separate account", async ({ page }) => {
  41 |   await signInSchool(page, OTHER_SCHOOL);
  42 |   await expect(page.getByText(`(${OTHER_SCHOOL})`, { exact: true })).toBeVisible();
  43 |   await expect(page.getByText(`(${SCHOOL})`, { exact: true })).toHaveCount(0);
  44 | });
  45 | 
```