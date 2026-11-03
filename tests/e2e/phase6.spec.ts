import { expect, test, type Page } from "@playwright/test";
import { apiCall, signInSchool } from "./helpers";

test.describe.configure({ mode: "serial" });

const suffix = Date.now().toString().slice(-6);
const className = `Class M${suffix}`;
const subjectName = `Science ${suffix}`;
const testName = `Monthly ${suffix}`;
const children = [`Amna Marks ${suffix}`, `Bilal Marks ${suffix}`, `Danish Marks ${suffix}`, `Eman Marks ${suffix}`];

type Year = { id: number; status: string; startDate: string; endDate: string };

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

/** A current year, a class with section A, one subject and four students. */
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
  await apiCall(page, "POST", "/academics/subjects", { name: subjectName });
  for (const name of children) {
    await apiCall(page, "POST", "/students", {
      student: { name, gender: "FEMALE" },
      newFamily: { fatherName: `Father ${name}` },
      sectionId: section.id,
      admissionDate: day(-20),
    });
  }
}

async function openTest(page: Page) {
  await page.getByRole("link", { name: "Test marks" }).click();
  await page.getByLabel("Section").selectOption({ label: `${className} - A` });
  await page.getByRole("link", { name: testName }).click();
  await expect(page.getByRole("heading", { name: new RegExp(testName) })).toBeVisible();
}

test("the menu offers test marks, not exam set-up", async ({ page }) => {
  await signInSchool(page);
  await prepare(page);
  await page.reload();
  await expect(page.getByRole("link", { name: "Test marks" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Exams", exact: true })).toHaveCount(0);
});

test("add a test, enter marks and see positions with a tie", async ({ page }) => {
  await signInSchool(page);
  await page.getByRole("link", { name: "Test marks" }).click();
  await page.getByLabel("Section").selectOption({ label: `${className} - A` });
  await page.getByRole("button", { name: "New test" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Subject").selectOption({ label: subjectName });
  await dialog.getByLabel("Test name").fill(testName);
  await dialog.getByLabel("Out of").fill("100");
  await dialog.getByRole("button", { name: "Add test" }).click();
  await expect(page.getByRole("heading", { name: new RegExp(testName) })).toBeVisible();

  // More than the maximum is flagged before saving
  await page.getByLabel(`Marks for ${children[0]}`).fill("101");
  await expect(page.getByText("not a number between 0 and 100")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save marks" })).toBeDisabled();

  await page.getByLabel(`Marks for ${children[0]}`).fill("95");
  await page.getByLabel(`Marks for ${children[1]}`).fill("95");
  await page.getByLabel(`Marks for ${children[2]}`).fill("80");
  await page.getByRole("button", { name: `${children[3]} was absent` }).click();
  await page.getByRole("button", { name: "Save marks" }).click();
  await expect(page.getByText("Marks saved")).toBeVisible();

  const position = (name: string) => page.getByRole("row", { name: new RegExp(name) }).getByRole("cell").nth(5);
  await expect(position(children[0])).toHaveText("1");
  await expect(position(children[1])).toHaveText("1");
  await expect(position(children[2])).toHaveText("3");
  await expect(position(children[3])).toHaveText("—");
});

test("changing a saved mark asks for a reason", async ({ page }) => {
  await signInSchool(page);
  await openTest(page);
  await page.getByLabel(`Marks for ${children[2]}`).fill("96");
  const save = page.getByRole("button", { name: "Save marks" });
  await expect(save).toBeDisabled();
  await page.getByLabel("Reason for changing saved marks").fill("Added wrongly");
  await save.click();
  await expect(page.getByText("Marks saved")).toBeVisible();
  await expect(page.getByRole("row", { name: new RegExp(children[2]) }).getByRole("cell").nth(5)).toHaveText("1");
});

test("overall positions and the student's record show the marks", async ({ page }) => {
  await signInSchool(page);
  await page.getByRole("link", { name: "Test marks" }).click();
  await page.getByLabel("Section").selectOption({ label: `${className} - A` });
  await page.getByRole("tab", { name: "Overall positions" }).click();
  const first = page.getByRole("row", { name: new RegExp(children[2]) });
  await expect(first.getByRole("cell").first()).toHaveText("1");
  await expect(first).toContainText("96/100");

  await page.getByRole("link", { name: "Students", exact: true }).click();
  await page.getByRole("link", { name: new RegExp(children[2]) }).first().click();
  await page.getByRole("tab", { name: "Test marks" }).click();
  await expect(page.getByRole("row", { name: new RegExp(testName) })).toContainText("96/100");
});
