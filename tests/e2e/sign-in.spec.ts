import { expect, test } from "@playwright/test";
import { OTHER_SCHOOL, PASSWORD, SCHOOL, USERNAME, signInSchool } from "./helpers";

test("visiting the portal without a session goes to sign-in", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fapp/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("wrong password shows a clear error", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("School code").fill(SCHOOL);
  await page.getByLabel("Username").fill(USERNAME);
  await page.getByLabel("Password").fill("definitely-wrong");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "incorrect" })).toBeVisible();
});

test("sign in, see own school, sign out", async ({ page }) => {
  await page.goto(`/s/${SCHOOL.toLowerCase()}`);
  await expect(page.getByLabel("School code")).toHaveValue(SCHOOL);
  await page.getByLabel("Username").fill(USERNAME);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("heading", { name: /Welcome/ })).toBeVisible();
  await expect(page.getByText(`(${SCHOOL})`, { exact: true })).toBeVisible();

  // Session survives a reload (server-side session cookie).
  await page.reload();
  await expect(page.getByRole("heading", { name: /Welcome/ })).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in/);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("same username in another school is a separate account", async ({ page }) => {
  await signInSchool(page, OTHER_SCHOOL);
  await expect(page.getByText(`(${OTHER_SCHOOL})`, { exact: true })).toBeVisible();
  await expect(page.getByText(`(${SCHOOL})`, { exact: true })).toHaveCount(0);
});
