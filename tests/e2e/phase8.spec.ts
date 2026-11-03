import { expect, test, type Page } from "@playwright/test";
import { apiCall, signInOwner, signInSchool } from "./helpers";

test.describe.configure({ mode: "serial" });

const suffix = Date.now().toString().slice(-6);
const className = `Class R${suffix}`;
const child = `Sara Report ${suffix}`;

type Year = { id: number; status: string; startDate: string; endDate: string };

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

/** A current year, a class with section A and one student. */
async function prepare(page: Page) {
  const today = day(0);
  const years = await apiCall<Year[]>(page, "GET", "/school/years");
  if (!years.some((y) => y.status === "CURRENT")) {
    let year = years.find((y) => y.startDate <= today && y.endDate >= today);
    if (!year) {
      const start = day(-60);
      year = await apiCall<Year>(page, "POST", "/school/years", {
        name: `${start.slice(0, 4)}-${Number(start.slice(0, 4)) + 1}`,
        startDate: start,
        endDate: day(300),
      });
    }
    await apiCall(page, "POST", `/school/years/${year.id}/make-current`);
  }
  const cls = await apiCall<{ id: number }>(page, "POST", "/academics/classes", { name: className });
  const section = await apiCall<{ id: number }>(page, "POST", `/academics/classes/${cls.id}/sections`, { name: "A" });
  await apiCall(page, "POST", "/students", {
    student: { name: child, gender: "FEMALE" },
    newFamily: { fatherName: `Father ${suffix}` },
    sectionId: section.id,
    admissionDate: day(-20),
  });
}

test("a student report shows its period and saves as Excel and PDF", async ({ page }) => {
  await signInSchool(page);
  await prepare(page);
  await page.reload();
  await page.getByRole("link", { name: "Reports", exact: true }).click();
  await page.getByRole("textbox", { name: "Find student" }).fill(child);
  await page.getByRole("button", { name: new RegExp(child) }).click();
  await expect(page.getByRole("heading", { name: "STUDENT REPORT" })).toBeVisible();
  await expect(page.getByText(/Academic Year/).first()).toBeVisible();
  await expect(page.getByText("Tests in this period")).toBeVisible();
  const save = page.getByRole("group", { name: "Save this report" });
  const excel = page.waitForEvent("download");
  await save.getByRole("button", { name: "Excel" }).click();
  expect((await excel).suggestedFilename()).toBe("student-report.xlsx");
  const pdf = page.waitForEvent("download");
  await save.getByRole("button", { name: "PDF" }).click();
  expect((await pdf).suggestedFilename()).toBe("student-report.pdf");
});

test("a class report and a teacher report open for the administrator", async ({ page }) => {
  await signInSchool(page);
  await page.getByRole("link", { name: "Reports", exact: true }).click();
  await page.getByRole("tab", { name: "Class" }).click();
  await page.getByRole("combobox", { name: "Class", exact: true }).selectOption({ label: className });
  await expect(page.getByRole("heading", { name: "CLASS REPORT" })).toBeVisible();
  await expect(page.getByRole("row", { name: /Students at the end of the period/ })).toContainText("1");
  await page.getByRole("tab", { name: "Teacher" }).click();
  await expect(page.getByRole("combobox", { name: "Teacher" })).toBeVisible();
  await page.getByRole("tab", { name: "All reports" }).click();
  await expect(page.getByRole("tabpanel").getByRole("link", { name: "Fee reports" })).toBeVisible();
});

test("a detailed report exports the table on screen", async ({ page }) => {
  await signInSchool(page);
  await page.getByRole("link", { name: "Attendance reports" }).click();
  await page.getByLabel("Section").selectOption({ label: `${className} - A` });
  await expect(page.getByRole("row", { name: new RegExp(child) })).toBeVisible();
  const excel = page.waitForEvent("download");
  await page.getByRole("group", { name: "Export this page" }).getByRole("button", { name: "Excel" }).click();
  expect((await excel).suggestedFilename()).toBe("Attendance reports.xlsx");
});

test("the super admin compares all schools and exports them", async ({ page }) => {
  await signInOwner(page);
  await page.getByRole("link", { name: "Reports" }).click();
  await expect(page.getByRole("heading", { name: "All-schools report" })).toBeVisible();
  await expect(page.getByRole("row", { name: /All schools/ })).toBeVisible();
  const excel = page.waitForEvent("download");
  await page.getByRole("button", { name: "Excel" }).click();
  expect((await excel).suggestedFilename()).toBe("all-schools-report.xlsx");
});
