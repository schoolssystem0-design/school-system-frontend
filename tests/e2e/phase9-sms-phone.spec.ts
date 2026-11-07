import { expect, test, type Page } from "@playwright/test";
import { API, apiCall, latestCode, signInSchool } from "./helpers";

/**
 * The school's own SMS phone (SMS Gate), end to end against the API's built-in pretend phone (local profile):
 * connect, test SMS reaching "Delivered", a failure being sent again, STOP replies, the dashboard card and
 * Roman Urdu templates. The phone is disconnected at the end so other tests keep using the dev outbox.
 */

const USER = `e2e-phone-${Date.now() % 100000}`;

async function confirmStepUpIfAsked(page: Page, done: RegExp) {
  const dialog = page.getByRole("heading", { name: /Confirm it/ });
  await expect(dialog.or(page.getByText(done).first())).toBeVisible();
  if (await dialog.isVisible()) {
    await page.getByLabel("Verification code").fill(await latestCode(page));
    await page.getByRole("button", { name: "Confirm" }).click();
  }
  await expect(page.getByText(done).first()).toBeVisible();
}

type Logged = { messages: { recipient: string; status: string; viaPhone: boolean }[] };

async function statusOf(page: Page, phone: string) {
  const log = await apiCall<Logged>(page, "GET", "/communication/log");
  return log.messages.find((m) => m.recipient === phone)?.status;
}

test.describe.configure({ mode: "serial" });

test("connect the school phone, send a test SMS and follow it to delivered", async ({ page }) => {
  await signInSchool(page);
  // Quiet hours off for the test, so it passes at any time of day (the test SMS ignores them anyway)
  await page.goto("/app/messages?tab=phone");
  await expect(page.getByText("Connect the phone", { exact: true }).or(page.getByText("Connection", { exact: true }))).toBeVisible();

  // A wrong password is refused and nothing is stored
  await page.getByLabel("Username").fill(USER);
  await page.getByLabel("Password").fill("wrong");
  await page.getByLabel("Webhook signing key").fill("e2e-signing-key-123");
  await page.getByRole("button", { name: /^(Connect|Save)$/ }).click();
  await confirmStepUpIfAsked(page, /rejected the username or password/);

  await page.getByLabel("Password").fill("e2e-password");
  await page.getByLabel("Offline alerts to").fill("office@demo.local.test");
  await page.getByRole("button", { name: /^(Connect|Save)$/ }).click();
  await confirmStepUpIfAsked(page, /SMS phone (connected|settings saved)/);
  await expect(page.getByText("Not heard from yet", { exact: false }).first()).toBeVisible();
  await expect(page.getByText(/Delivery reports arrive at/)).toBeVisible();

  // Test SMS: handed to the phone, then the phone reports sent and delivered
  await page.getByLabel("Mobile number").fill("0300-1234567");
  await page.getByRole("button", { name: "Send test" }).click();
  await expect(page.getByText(/Test SMS handed to the phone/)).toBeVisible();
  await expect.poll(() => statusOf(page, "03001234567"), { timeout: 45_000 }).toBe("DELIVERED");

  // The phone has been heard from: online on this page and on the dashboard
  await page.reload();
  await expect(page.getByText("Online").first()).toBeVisible();
  await page.goto("/app");
  const card = page.getByRole("region", { name: /SMS phone/ });
  await expect(card).toBeVisible();
  await expect(card.getByText("Online")).toBeVisible();

  // The delivery log shows it went through the school phone
  await page.goto("/app/messages?tab=log");
  await expect(page.getByRole("cell", { name: /Delivered/ }).first()).toBeVisible();
  await expect(page.getByText("School phone").first()).toBeVisible();
});

test("a failed SMS can be sent again, and a parent can reply STOP", async ({ page }) => {
  await signInSchool(page);
  // The pretend phone fails numbers ending in 0000
  await apiCall(page, "POST", "/communication/sms-phone/test", { phone: "0300-1110000" });
  await expect.poll(() => statusOf(page, "03001110000"), { timeout: 45_000 }).toBe("FAILED");
  await page.goto("/app/messages?tab=phone");
  const failed = page.getByRole("listitem").filter({ hasText: "03001110000" });
  await expect(failed).toContainText("RESULT_ERROR_GENERIC_FAILURE");
  await failed.getByRole("button", { name: "Send again" }).click();
  await expect(page.getByText("It will be sent again")).toBeVisible();

  // A family with this number replies STOP: SMS are switched off for it
  const family = await apiCall<{ id: number; details: { preferredChannel: string } }>(page, "POST", "/families", {
    fatherName: "E2E Stop Parent",
    fatherPhone: "0321-7654321",
  });
  await page.request.post(`${API}/dev/sms-gate/simulate/reply`, { data: { user: USER, from: "+923217654321", text: "STOP" } });
  await expect
    .poll(async () => (await apiCall<{ details: { preferredChannel: string } }>(page, "GET", `/families/${family.id}`)).details.preferredChannel, {
      timeout: 20_000,
    })
    .toBe("NONE");

  // A battery report shows on the phone panel
  await page.request.post(`${API}/dev/sms-gate/simulate/ping`, { data: { user: USER, battery: 37, charging: false } });
  await expect.poll(async () => (await apiCall<{ batteryLevel: number }>(page, "GET", "/communication/sms-phone")).batteryLevel, { timeout: 20_000 }).toBe(37);
  await page.reload();
  await expect(page.getByTitle("Phone battery")).toContainText("37%");
});

test("automatic messages can be worded in Roman Urdu", async ({ page }) => {
  await signInSchool(page);
  await page.goto("/app/messages?tab=templates");
  await page.getByRole("radio", { name: "Roman Urdu" }).click();
  await expect(page.getByLabel("Wording").first()).toBeVisible();
  await expect(page.getByText("Absence").first()).toBeVisible();
  await expect(page.locator("textarea").filter({ hasText: "ghair hazir" })).toBeVisible();
  await page.getByRole("radio", { name: "English" }).click();
  await expect(page.locator("textarea").filter({ hasText: "was absent from school today" })).toBeVisible();
});

test.afterAll(async ({ browser }) => {
  // Leave the demo school without a phone, as the other tests expect
  const page = await browser.newPage();
  await signInSchool(page);
  await page.goto("/app/messages?tab=phone");
  if (await page.getByRole("button", { name: "Disconnect" }).isVisible()) {
    await page.getByRole("button", { name: "Disconnect" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Disconnect" }).click();
    await confirmStepUpIfAsked(page, /SMS phone disconnected/);
  }
  await page.close();
});
