import { expect, test } from "@playwright/test";
import { signInOwner, signInSchool } from "./helpers";

const OUT = "C:/Users/nadir/AppData/Local/Temp/claude/bdba0ccb7b896358/def4d73f-3db7-4553-8277-576e344f6a6e/scratchpad/shots";

test("desktop screens", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signInSchool(page);
  await expect(page.getByRole("heading", { name: /Welcome/ })).toBeVisible();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/desk-dashboard.png`, fullPage: true });
  for (const [name, path] of [
    ["students", "/app/students"],
    ["calendar", "/app/office/calendar"],
    ["register", "/app/attendance"],
  ]) {
    await page.goto(path);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/desk-${name}.png` });
  }
  const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  console.log("FONT", font);
});

test("mobile screens", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await signInSchool(page);
  await expect(page.getByRole("heading", { name: /Welcome/ })).toBeVisible();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/mob-dashboard.png`, fullPage: true });
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/mob-menu.png` });
  await ctx.close();
});

test("platform", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signInOwner(page);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/desk-platform.png` });
});
