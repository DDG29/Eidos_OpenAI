import { expect, test } from "@playwright/test";
import { stage, waitForStage, watchConsole } from "./helpers";

test("landing loads clean, the canvas exists and the six movements scroll", async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto("/");
  await expect(page.locator("canvas.stage-canvas")).toHaveCount(1);
  await expect(page.locator("h1").first()).toBeVisible();
  await waitForStage(page, "_landing");
  const movements = page.locator(".mv[data-beat-index]");
  await expect(movements).toHaveCount(7);
  for (let i = 1; i <= 6; i++) {
    await page.keyboard.press("PageDown");
    await expect.poll(async () => (await stage(page))?.beat ?? -1, { timeout: 10_000 }).toBeGreaterThanOrEqual(Math.min(i, 5));
  }
  await expect(page.locator("textarea.console-input")).toBeVisible();
  expect(errors).toEqual([]);
});

test("the Content Security Policy is active and nothing violates it", async ({ page }) => {
  const errors = watchConsole(page);
  const res = await page.goto("/");
  const csp = res?.headers()["content-security-policy"] ?? "";
  expect(csp).toContain("script-src 'self' 'nonce-");
  expect(csp).toContain("frame-ancestors 'none'");
  if (!process.env.E2E_DEV) expect(csp).not.toContain("'unsafe-eval'");
  // The worker compiles shapes, the fonts load and the canvas draws under the policy.
  await waitForStage(page, "_landing");
  expect(await page.evaluate(() => document.fonts.check('32px "Bodoni Moda"') || document.fonts.size > 0)).toBe(true);
  await page.goto("/m/transformer");
  await waitForStage(page, "world:transformer");
  expect(errors.filter((e) => /Content Security Policy|Refused to/.test(e))).toEqual([]);
});
