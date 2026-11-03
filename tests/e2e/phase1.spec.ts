import { expect, test } from "@playwright/test";
import { latestCode, signInOwner, signInSchool } from "./helpers";

test.describe.configure({ mode: "serial" });

test("super admin creates a school and opens it with full access", async ({ page }) => {
  const code = `E2E${Date.now().toString().slice(-6)}`;
  await signInOwner(page);

  await page.getByRole("link", { name: "Add school" }).first().click();
  await page.getByLabel("School name").fill(`E2E Academy ${code}`);
  await page.getByLabel("School code").fill(code);
  await page.getByLabel("Main administrator's name").fill("E2E Admin");
  await page.getByLabel("Their email").fill(`admin@${code.toLowerCase()}.test`);
  await page.getByRole("button", { name: "Create school" }).click();

  await expect(page.getByRole("heading", { name: `E2E Academy ${code} created` })).toBeVisible();
  await expect(page.getByText(/setup-account\?token=/)).toBeVisible();

  await page.getByRole("link", { name: "View school" }).click();
  await page.getByRole("button", { name: "Open school" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText(/Super admin: viewing/)).toBeVisible();
  // Full access: every menu item, including users and activity history.
  await expect(page.getByRole("link", { name: "Activity history" })).toBeVisible();

  await page.getByRole("button", { name: "Back to platform" }).click();
  await expect(page.getByRole("heading", { name: "All schools" })).toBeVisible();
  await expect(page.getByRole("cell", { name: code, exact: true })).toBeVisible();
});

test("school admin sets up a year, a class and a section", async ({ page }) => {
  await signInSchool(page);
  await page.getByRole("link", { name: "Academic years" }).click();
  await expect(page.getByRole("heading", { name: "Academic years" })).toBeVisible();

  const yearName = `${2040 + Math.floor(Math.random() * 50)}`;
  const start = Number(yearName);
  await page.getByLabel("Name", { exact: true }).fill(`${start}-${start + 1}`);
  await page.getByLabel("Start date").fill(`${start}-04-01`);
  await page.getByLabel("End date").fill(`${start + 1}-03-31`);
  await page.getByRole("button", { name: "Create year" }).click();
  await expect(page.getByRole("cell", { name: `${start}-${start + 1}` })).toBeVisible();

  await page.getByRole("link", { name: "Classes & sections" }).click();
  const className = `Class E2E ${Date.now().toString().slice(-5)}`;
  await page.getByLabel("New class").fill(className);
  await page.getByRole("button", { name: "Add class" }).click();
  await expect(page.getByText(className)).toBeVisible();
  await page.getByLabel(`New section for ${className}`).fill("A");
  await page.getByRole("button", { name: "Add section" }).last().click();
  await expect(page.getByRole("button", { name: "Remove section A" }).last()).toBeVisible();
});

test("changing a school rule asks for a verification code", async ({ page }) => {
  await signInSchool(page);
  await page.getByRole("link", { name: "Rules & settings" }).click();
  await page.getByRole("button", { name: "Change Message signature" }).click();
  await page.getByLabel("New value").fill(`Administration, Demo ${Date.now() % 1000}`);
  await page.getByLabel("Reason for the change").fill("E2E test");
  await page.getByRole("button", { name: "Save" }).click();

  // Step-up dialog: the code goes to the dev outbox locally.
  await expect(page.getByRole("heading", { name: /Confirm it/ })).toBeVisible();
  await expect(page.getByText(/We sent a 6-digit code/)).toBeVisible();
  await page.getByLabel("Verification code").fill(await latestCode(page));
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Message signature changed")).toBeVisible();
});
