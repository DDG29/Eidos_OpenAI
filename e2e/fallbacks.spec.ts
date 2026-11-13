import AxeBuilder from "@axe-core/playwright";
import { chromium, expect, test } from "@playwright/test";
import { watchConsole } from "./helpers";

test("without WebGL the player offers the poster and reading mode", async ({}, info) => {
  test.skip(!info.project.name.startsWith("chromium"), "flag is Chromium-only");
  const browser = await chromium.launch({ args: ["--disable-webgl", "--disable-webgl2"] });
  const page = await browser.newPage({ baseURL: info.project.use.baseURL });
  await page.goto("/m/transformer");
  await expect(page.locator(".stage-poster")).toBeVisible({ timeout: 20_000 });
  const link = page.locator(".nowebgl-note a");
  await expect(link).toBeVisible();
  await link.click();
  await page.waitForURL(/\/leer$/);
  await expect(page.locator(".reading-section").first()).toBeVisible();
  await browser.close();
});

const ROUTES = ["/", "/atlas", "/acerca", "/m/transformer", "/m/transformer/leer", "/forja/demo-agujeros-negros", "/pitch", "/lab"];

for (const route of ROUTES) {
  test(`axe: no serious or critical violations on ${route}`, async ({ page }) => {
    const errors = watchConsole(page);
    await page.goto(route);
    await page.waitForTimeout(2500);
    const result = await new AxeBuilder({ page }).exclude(".stage-layer").analyze();
    const bad = result.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(bad.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} × ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test("autopilot runs from the landing to the landing without errors", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium-desktop", "one full run is enough");
  test.setTimeout(330_000);
  const errors = watchConsole(page);
  await page.goto("/?autopilot=1");
  await expect(page.locator(".pilot-cursor")).toBeAttached({ timeout: 15_000 });
  await page.waitForURL(/\/forja\//, { timeout: 60_000 });
  await page.waitForURL(/\/m\//, { timeout: 120_000 });
  await expect(page.locator(".astro-remedial").first()).toBeAttached({ timeout: 120_000 });
  await expect(page.locator(".pilot-cursor")).toHaveCount(0, { timeout: 200_000 });
  expect(new URL(page.url()).pathname).toBe("/");
  expect(errors).toEqual([]);
});
