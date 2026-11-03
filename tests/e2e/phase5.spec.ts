import { expect, test, type Page } from "@playwright/test";
import { apiCall, signInSchool } from "./helpers";

test.describe.configure({ mode: "serial" });

const suffix = Date.now().toString().slice(-6);
const className = `Class T${suffix}`;
const child = `Hamid Att ${suffix}`;

type Year = { id: number; status: string; startDate: string; endDate: string };

/** A current year, a class with section A and one student; returns the section id. */
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
  const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10);
  await apiCall(page, "POST", "/students", {
    student: { name: child, gender: "MALE" },
    newFamily: { fatherName: `Tariq ${suffix}` },
    sectionId: section.id,
    admissionDate: tenDaysAgo,
  });
  return section.id;
}

/** The last day before today that is not a Sunday (a working day in the default week). */
function lastWorkingDay() {
  const d = new Date(Date.now() - 86_400_000);
  while (d.getDay() === 0) d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

test("take a class register with one absence", async ({ page }) => {
  await signInSchool(page);
  await prepare(page);
  await page.reload();
  await page.getByRole("link", { name: "Take attendance" }).click();
  await page.getByLabel("Section").selectOption({ label: `${className} - A` });
  await page.getByLabel("Date").fill(lastWorkingDay());
  await expect(page.getByText("Not taken yet")).toBeVisible();
  await page.getByRole("radiogroup", { name: `Attendance for ${child}` }).getByRole("radio", { name: "Absent" }).click();
  await page.getByRole("button", { name: "Save register" }).click();
  await expect(page.getByText("Register saved: 1 absent, 0 late")).toBeVisible();
  await expect(page.getByText(/Taken by/)).toBeVisible();
});

test("enter and approve leave for the student", async ({ page }) => {
  await signInSchool(page);
  await page.getByRole("link", { name: "Leave", exact: true }).click();
  await page.getByRole("button", { name: "Enter leave" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Find student" }).fill(child);
  await dialog.getByRole("button", { name: new RegExp(child) }).click();
  await dialog.getByLabel("First day").fill(lastWorkingDay());
  await dialog.getByLabel("Last day").fill(lastWorkingDay());
  await dialog.getByLabel("Reason").fill("Fever");
  await dialog.getByRole("button", { name: "Save leave" }).click();
  // The administrator may approve, so the leave is approved when entered
  await expect(page.getByText("Leave entered and approved")).toBeVisible();
});

test("the attendance report shows the leave, not an absence", async ({ page }) => {
  await signInSchool(page);
  await page.getByRole("link", { name: "Attendance reports" }).click();
  await page.getByLabel("Section").selectOption({ label: `${className} - A` });
  await page.getByLabel("From").fill(lastWorkingDay());
  await page.getByLabel("To", { exact: true }).fill(lastWorkingDay());
  const row = page.getByRole("row", { name: new RegExp(child) });
  await expect(row).toBeVisible();
  // 1 day marked, leave 1 → no percentage yet, and no absence
  await expect(row.getByRole("cell").nth(6)).toHaveText("0");
  await expect(row.getByRole("cell").nth(7)).toHaveText("1");
});
