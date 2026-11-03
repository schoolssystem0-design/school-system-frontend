import { expect, test, type Page } from "@playwright/test";
import { API, OTHER_SCHOOL, signInSchool } from "./helpers";

test.describe.configure({ mode: "serial" });

const suffix = Date.now().toString().slice(-6);
const className = `Class P2 ${suffix}`;
const childName = `Ayesha Test ${suffix}`;
const staffName = `Imran Teacher ${suffix}`;

/** Calls the API with the page's session cookie and a CSRF token (for test set-up only). */
async function call<T>(page: Page, method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const csrf = (await (await page.request.get(`${API}/auth/csrf`)).json()) as { token: string };
  const response = await page.request.fetch(`${API}${path}`, {
    method,
    headers: { "X-XSRF-TOKEN": csrf.token, "Content-Type": "application/json" },
    data: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok()) throw new Error(`${method} ${path} failed: ${response.status()} ${await response.text()}`);
  return (response.status() === 204 ? undefined : await response.json()) as T;
}

type Year = { id: number; status: string; startDate: string; endDate: string };

/** Makes sure the school has a current year containing today, and a class with section A. */
async function prepareSchool(page: Page) {
  const today = new Date().toISOString().slice(0, 10);
  const years = await call<Year[]>(page, "GET", "/school/years");
  if (!years.some((y) => y.status === "CURRENT")) {
    let year = years.find((y) => y.startDate <= today && y.endDate >= today);
    if (!year) {
      const start = new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10);
      const end = new Date(Date.now() + 300 * 86_400_000).toISOString().slice(0, 10);
      const name = `${start.slice(0, 4)}-${Number(start.slice(0, 4)) + 1}`;
      year = await call<Year>(page, "POST", "/school/years", { name, startDate: start, endDate: end });
    }
    await call(page, "POST", `/school/years/${year.id}/make-current`);
  }
  const created = await call<{ id: number }>(page, "POST", "/academics/classes", { name: className });
  await call(page, "POST", `/academics/classes/${created.id}/sections`, { name: "A" });
}

test("an enquiry is followed up and enrolled as a student", async ({ page }) => {
  await signInSchool(page);
  await prepareSchool(page);
  await page.reload(); // the class was created behind the UI's back

  await page.getByRole("link", { name: "Admissions" }).click();
  await page.getByRole("button", { name: "New enquiry" }).click();
  const form = page.getByRole("dialog");
  await form.getByLabel("Child's name").fill(childName);
  await form.getByLabel("Parent's name").fill(`Tariq ${suffix}`);
  await form.getByLabel("Parent's mobile").fill(`0300${suffix}1`);
  await form.getByRole("button", { name: "Save enquiry" }).click();

  await expect(page.getByRole("heading", { name: childName })).toBeVisible();
  await page.getByLabel("New remark").fill("Called father, visiting Monday");
  await page.getByRole("button", { name: "Add remark" }).click();
  await expect(page.getByText("Called father, visiting Monday")).toBeVisible();

  await expect(page.getByRole("button", { name: "Enrol" })).toBeDisabled();
  await page.getByLabel("New status").selectOption({ label: "Admission approved" });
  await page.getByRole("button", { name: "Change status" }).click();
  await page.getByRole("button", { name: "Enrol" }).click();
  const enrol = page.getByRole("dialog");
  await enrol.getByLabel("Class and section").selectOption({ label: `${className} - A` });
  await enrol.getByLabel("Gender").selectOption("FEMALE");
  await enrol.getByRole("button", { name: "Enrol student" }).click();

  await expect(page).toHaveURL(/\/app\/students\/\d+$/);
  await expect(page.getByRole("heading", { name: childName })).toBeVisible();
  await expect(page.getByText(`${className} - A`).first()).toBeVisible();
});

test("a student is withdrawn and gets a leaving certificate", async ({ page }) => {
  await signInSchool(page);
  await page.getByRole("link", { name: "Students", exact: true }).click();
  await page.getByRole("textbox", { name: "Search" }).fill(childName);
  await page.getByRole("link", { name: childName }).click();

  await page.getByRole("button", { name: "Withdraw" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Reason").fill("Family moved to Lahore");
  await dialog.getByRole("button", { name: "Withdraw" }).click();
  await expect(page.getByText(/^Left \d{2} \w{3} \d{4}$/)).toBeVisible();

  await page.getByRole("tab", { name: "Certificates" }).click();
  await page.getByLabel("Certificate", { exact: true }).selectOption("LEAVING");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Issue and print" }).click();
  expect((await download).suggestedFilename()).toMatch(/^leaving-certificate-.+\.pdf$/);
  await expect(page.getByRole("cell", { name: /^LC-\d+$/ }).first()).toBeVisible();
});

test("staff are added with an employee number", async ({ page }) => {
  await signInSchool(page);
  await page.getByRole("link", { name: "Staff", exact: true }).click();
  await page.getByRole("button", { name: "Add staff" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Full name").fill(staffName);
  await dialog.getByLabel("Designation").fill("Science Teacher");
  await dialog.getByRole("button", { name: "Add staff" }).click();
  await expect(page.getByRole("heading", { name: staffName })).toBeVisible();
  await expect(page.getByText(/^EMP-\d+ · Science Teacher/)).toBeVisible();
});

test("another school cannot see these students or staff", async ({ page }) => {
  await signInSchool(page, OTHER_SCHOOL);
  await page.getByRole("link", { name: "Students", exact: true }).click();
  await page.getByRole("combobox", { name: "Status" }).selectOption("ALL");
  await page.getByRole("textbox", { name: "Search" }).fill(childName);
  await expect(page.getByText("No students found")).toBeVisible();
  await page.getByRole("link", { name: "Staff", exact: true }).click();
  await page.getByRole("textbox", { name: "Search" }).fill(staffName);
  await expect(page.getByText("No staff found")).toBeVisible();
});
