import { expect, test, type Page } from "@playwright/test";
import { apiCall, latestCode, signInSchool } from "./helpers";

test.describe.configure({ mode: "serial" });

type Year = { id: number; status: string; startDate: string; endDate: string };

async function ensureCurrentYear(page: Page) {
  const today = new Date().toISOString().slice(0, 10);
  const years = await apiCall<Year[]>(page, "GET", "/school/years");
  if (years.some((y) => y.status === "CURRENT")) return;
  let year = years.find((y) => y.startDate <= today && y.endDate >= today);
  if (!year) {
    const start = new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10);
    const end = new Date(Date.now() + 300 * 86_400_000).toISOString().slice(0, 10);
    year = await apiCall<Year>(page, "POST", "/school/years", {
      name: `${start.slice(0, 4)}-${Number(start.slice(0, 4)) + 1}`,
      startDate: start,
      endDate: end,
    });
  }
  await apiCall(page, "POST", `/school/years/${year.id}/make-current`);
}

/** Answers the verification-code dialog if it appears (the code is read from the local dev outbox). */
async function confirmIfAsked(page: Page) {
  const heading = page.getByRole("heading", { name: /Confirm it/ });
  try {
    await heading.waitFor({ timeout: 3000 });
  } catch {
    return;
  }
  await page.getByLabel("Verification code").fill(await latestCode(page));
  await page.getByRole("button", { name: "Confirm" }).click();
}

const amount = String(1000 + (Date.now() % 900));

test("record an opening balance and an expense, then read the day book", async ({ page }) => {
  await signInSchool(page);
  await ensureCurrentYear(page);
  await page.reload();

  await page.getByRole("link", { name: "Cash & bank" }).click();
  await page.getByRole("row", { name: /Cash in hand/ }).getByRole("button", { name: "Opening balance" }).click();
  await page.getByLabel("Amount (Rs.)").fill("50000");
  await page.getByRole("button", { name: "Save" }).click();
  await confirmIfAsked(page);
  await expect(page.getByText("Opening balance recorded")).toBeVisible();

  await page.getByRole("link", { name: "Income & expenses" }).click();
  await page.getByRole("button", { name: "New entry" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Amount (Rs.)").fill(amount);
  await dialog.getByLabel("Category").selectOption({ label: "Utilities" });
  await dialog.getByLabel("Paid from").selectOption({ index: 1 });
  await dialog.getByLabel("Description").fill("Electricity bill");
  await dialog.getByRole("button", { name: "Save entry" }).click();
  await confirmIfAsked(page);
  await expect(page.getByText(/EXP-\d{5} recorded/)).toBeVisible();

  await page.getByRole("link", { name: "Day book & close" }).click();
  await expect(page.getByRole("cell", { name: "Expenses" })).toBeVisible();
  // A count that differs from the books asks for an explanation before the day can be closed
  await page.getByLabel("Counted / statement amount (Rs.)").fill("1");
  await expect(page.getByText(/Difference/)).toBeVisible();
  await expect(page.getByLabel("Explain the difference")).toBeVisible();

  await page.getByRole("link", { name: "Financial reports" }).click();
  await page.getByRole("tab", { name: "Trial balance" }).click();
  await expect(page.getByText("The books balance: total debits equal total credits.")).toBeVisible();
});

test("prepare a salary sheet and discard the draft", async ({ page }) => {
  await signInSchool(page);
  await page.getByRole("link", { name: "Payroll" }).click();
  const last = new Date();
  last.setDate(1);
  last.setMonth(last.getMonth() - 1);
  const month = last.toISOString().slice(0, 7);
  await page.getByLabel("Month").fill(month);
  await page.getByRole("button", { name: "Prepare salary sheet" }).click();
  await confirmIfAsked(page);
  await expect(page.getByRole("heading", { name: `Salaries for ${month}` })).toBeVisible();
  await page.getByRole("button", { name: "Discard" }).click();
  await page.getByLabel("Reason").fill("E2E test");
  await page.getByRole("dialog").getByRole("button", { name: "Discard" }).click();
  await expect(page.getByText("Draft discarded")).toBeVisible();
});
