import { expect, test, type Page } from "@playwright/test";
import { apiCall, OTHER_SCHOOL, signInSchool } from "./helpers";

test.describe.configure({ mode: "serial" });

const suffix = Date.now().toString().slice(-6);
const className = `Class F${suffix}`;
const childName = `Bilal Fee ${suffix}`;
const headName = `Tuition ${suffix}`;

type Year = { id: number; status: string; startDate: string; endDate: string };

/** A current year containing today, a class with section A and one student in it. */
async function prepare(page: Page) {
  const today = new Date().toISOString().slice(0, 10);
  const years = await apiCall<Year[]>(page, "GET", "/school/years");
  if (!years.some((y) => y.status === "CURRENT")) {
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
  const cls = await apiCall<{ id: number }>(page, "POST", "/academics/classes", { name: className });
  const section = await apiCall<{ id: number }>(page, "POST", `/academics/classes/${cls.id}/sections`, { name: "A" });
  await apiCall(page, "POST", "/students", {
    student: { name: childName, gender: "MALE" },
    newFamily: { fatherName: `Kashif ${suffix}`, fatherPhone: `0301${suffix}2` },
    sectionId: section.id,
    admissionDate: today,
  });
}

test("fee set-up, bill run and a partial payment with a receipt", async ({ page }) => {
  await signInSchool(page);
  await prepare(page);
  await page.reload();

  // Fee head and the class amount
  await page.getByRole("link", { name: "Fee set-up" }).click();
  await page.getByRole("tab", { name: "Fee heads" }).click();
  await page.getByRole("button", { name: "Add fee head" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill(headName);
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("cell", { name: headName, exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Class amounts" }).click();
  await page.getByLabel(`${headName} for ${className}`).fill("3500");
  await page.getByRole("button", { name: /Save 1 changes/ }).click();
  await expect(page.getByText("Amounts saved")).toBeVisible();

  // Bill run for this class only
  await page.getByRole("link", { name: "Bills & vouchers" }).click();
  await page.getByRole("checkbox", { name: headName }).click();
  await page.getByRole("radio", { name: "Some classes" }).check();
  await page.getByRole("checkbox", { name: className }).click();
  await page.getByRole("button", { name: "Generate bills" }).click();
  await expect(page.getByText("1 bills made")).toBeVisible();
  // Running the same bills again charges nothing new
  await page.getByLabel("Title (optional)").fill("Again");
  await page.getByRole("button", { name: "Generate bills" }).click();
  await expect(page.getByText("No new bills: everything was already billed")).toBeVisible();

  // Collect 2,000 of 3,500
  await page.getByRole("link", { name: "Collect fees" }).click();
  await page.getByRole("textbox", { name: "Find student" }).fill(childName);
  await page.getByRole("button", { name: new RegExp(childName) }).click();
  await expect(page.getByText("Rs. 3,500").first()).toBeVisible();
  await page.getByLabel("Amount received (Rs.)").fill("2000");
  await page.getByRole("button", { name: "Receive Rs. 2,000" }).click();
  await expect(page.getByText(/Received Rs\. 2,000 — receipt \d{4}-\d{4}\/\d{5}/)).toBeVisible();
  await expect(page.getByText("Rs. 1,500").first()).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download receipt" }).click();
  expect((await download).suggestedFilename()).toMatch(/^receipt-.+\.pdf$/);
});

test("the student's Fees tab shows the running balance", async ({ page }) => {
  await signInSchool(page);
  await page.getByRole("link", { name: "Students", exact: true }).click();
  await page.getByRole("textbox", { name: "Search" }).fill(childName);
  await page.getByRole("link", { name: childName }).click();
  await page.getByRole("tab", { name: "Fees" }).click();
  await expect(page.getByRole("cell", { name: "Charged" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Paid", exact: true })).toBeVisible();
  await expect(page.getByText("Rs. 1,500").first()).toBeVisible();
});

test("another school sees none of these fees", async ({ page }) => {
  await signInSchool(page, OTHER_SCHOOL);
  await page.getByRole("link", { name: "Fee status & defaulters" }).click();
  await page.getByRole("textbox", { name: "Search" }).fill(childName);
  // Either an empty list or "create a year first" (the second demo school may have no year yet); never the student.
  await expect(page.getByText(/No students|Create and open an academic year first/)).toBeVisible();
  await expect(page.getByText(childName)).toHaveCount(0);
  const payments = await apiCall<{ items: { familyNo: string }[] }>(page, "GET", "/fees/payments?q=" + suffix);
  expect(payments.items).toHaveLength(0);
});
