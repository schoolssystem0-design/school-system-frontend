import { expect, test, type Page } from "@playwright/test";
import { apiCall, signInSchool } from "./helpers";

test.describe.configure({ mode: "serial" });

const suffix = Date.now().toString().slice(-6);
const className = `Class O${suffix}`;
const child = `Sara Office ${suffix}`;
const phone = `0300${suffix}1`;

type Year = { id: number; status: string; startDate: string; endDate: string };

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

/** A current year and a class with one new student whose family has a phone. */
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
    newFamily: { fatherName: `Father ${suffix}`, fatherPhone: phone },
    sectionId: section.id,
    admissionDate: day(-1),
  });
}

test("the dashboard shows the panels and the new student can be welcomed", async ({ page }) => {
  await signInSchool(page);
  await prepare(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: /Welcome,/ })).toBeVisible();
  await expect(page.getByText("Attendance today")).toBeVisible();
  await expect(page.getByText("Recent admissions and withdrawals")).toBeVisible();
  await page.getByRole("button", { name: `Welcome ${child}` }).click();
  await expect(page.getByText("Welcome message queued")).toBeVisible();
});

test("an overdue urgent task appears on the dashboard", async ({ page }) => {
  await signInSchool(page);
  await page.getByRole("link", { name: "Tasks", exact: true }).click();
  await page.getByRole("button", { name: "New task" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Task", { exact: true }).fill(`Board forms ${suffix}`);
  await dialog.getByLabel("Deadline").fill(day(-1));
  await dialog.getByRole("checkbox", { name: "Urgent" }).click();
  await dialog.getByRole("button", { name: "Save task" }).click();
  await expect(page.getByRole("row", { name: new RegExp(`Board forms ${suffix}`) })).toContainText("overdue");
  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByRole("link", { name: /tasks? overdue/ })).toBeVisible();
});

test("a complaint is recorded, assigned and closed with a note", async ({ page }) => {
  await signInSchool(page);
  await page.getByRole("link", { name: "Parent complaints" }).click();
  await page.getByRole("button", { name: "New complaint" }).click();
  const form = page.getByRole("dialog");
  await form.getByLabel("From").fill("Mr Khan");
  await form.getByLabel("Subject").fill(`Van late ${suffix}`);
  await form.getByRole("button", { name: "Save complaint" }).click();
  await page.getByRole("button", { name: `Van late ${suffix}` }).click();
  const detail = page.getByRole("dialog");
  await detail.getByLabel("Add a remark").fill("Spoke to the driver");
  await detail.getByRole("button", { name: "Save remark" }).click();
  await expect(detail.getByText("Spoke to the driver")).toBeVisible();
  await detail.getByRole("button", { name: "Close complaint" }).click();
  await page.getByRole("dialog", { name: "Close this complaint?" }).getByRole("textbox").fill("Route changed");
  await page.getByRole("dialog", { name: "Close this complaint?" }).getByRole("button", { name: "Close complaint" }).click();
  await expect(page.getByText("Closed: Route changed")).toBeVisible();
});

test("a circular and a calendar event reach the dashboard", async ({ page }) => {
  await signInSchool(page);
  await page.getByRole("link", { name: "Circulars" }).click();
  await page.getByRole("button", { name: "New circular" }).click();
  await page.getByRole("dialog").getByLabel("Title").fill(`Winter timing ${suffix}`);
  await page.getByRole("dialog").getByLabel("Notice").fill("School starts at 8:30.");
  await page.getByRole("dialog").getByRole("button", { name: "Post circular" }).click();
  await expect(page.getByText("Circular posted")).toBeVisible();

  await page.getByRole("link", { name: "Calendar" }).click();
  await page.getByRole("button", { name: "New event" }).click();
  await page.getByRole("dialog").getByLabel("Title").fill(`Sports Day ${suffix}`);
  await page.getByRole("dialog").getByRole("button", { name: "Save event" }).click();
  await expect(page.getByRole("button", { name: `Sports Day ${suffix}` })).toBeVisible();

  await page.getByRole("link", { name: "Dashboard" }).click();
  // Roles skip the earlier pages Next.js keeps hidden in the background
  await expect(page.getByRole("listitem").filter({ hasText: `Winter timing ${suffix}` })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: `Sports Day ${suffix}` })).toBeVisible();
});

test("a message shows its cost first and appears in the delivery log", async ({ page }) => {
  await signInSchool(page);
  await page.getByRole("link", { name: "Messages" }).click();
  await page.getByLabel("Send to").selectOption("SECTION");
  await page.getByLabel("Section").selectOption({ label: `${className} - A` });
  await page.getByLabel("Message", { exact: true }).fill(`Dear {name}, school is closed on Monday ${suffix}.`);
  await page.getByRole("button", { name: "Check before sending" }).click();
  await expect(page.getByText("1 people will get this")).toBeVisible();
  await expect(page.getByText(new RegExp(`Dear Father ${suffix}`))).toBeVisible();
  await page.getByRole("button", { name: "Send to 1" }).click();
  await expect(page.getByText("1 messages queued")).toBeVisible();
  await page.getByRole("tab", { name: "Delivery log" }).click();
  await expect(page.getByRole("row", { name: new RegExp(`closed on Monday ${suffix}`) })).toBeVisible();
});

test("pages pinned to the quick bar stay on the dashboard", async ({ page }) => {
  await signInSchool(page);
  await page.getByRole("button", { name: /quick bar/i }).click();
  await page.getByRole("dialog").getByRole("checkbox", { name: "Visitors" }).check();
  await page.getByRole("dialog").getByRole("button", { name: "Save quick bar" }).click();
  await page.reload();
  await expect(page.getByLabel("Quick bar").getByRole("link", { name: "Visitors" })).toBeVisible();
});
