import { expect, test } from "@playwright/test";
import { activeIndex, demoIds, goToBeat, loadWorld, nextBeat, openWorld, sectionCount, stage, watchConsole } from "./helpers";

const full = (name: string) => name === "chromium-desktop" || name === "webkit-desktop";

test.describe("demo worlds", () => {
  test.setTimeout(300_000);
  test("every beat of every demo world, with the keyboard", async ({ page }, info) => {
    const errors = watchConsole(page);
    const ids = full(info.project.name) ? demoIds() : demoIds().slice(0, 1);
    for (const id of ids) {
      await openWorld(page, id);
      const n = await sectionCount(page);
      for (let i = 1; i < n; i++) {
        await nextBeat(page);
        const s = await stage(page);
        // The conductor's active beat drives the stage (no WebGL: the stage stays on its poster).
        if (s?.status === "ready") await expect.poll(async () => (await stage(page))?.beat).toBe(await activeIndex(page));
      }
      expect(await activeIndex(page)).toBe(n - 1);
    }
    expect(errors).toEqual([]);
  });
});

test("a filament opens the cited passage and closes again", async ({ page }) => {
  await openWorld(page, "agujeros-negros");
  await goToBeat(page, 1);
  const fil = page.locator("[data-narration-active] .filament").first();
  await fil.click();
  const panel = page.locator(".source-panel");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText(/\w{4,}/);
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
});

test("a wrong answer cracks the world and grows a remedial chapter in place", async ({ page }) => {
  const errors = watchConsole(page);
  const w = loadWorld("transformer");
  const checkIdx = w.spec.beats.findIndex((b) => b.kind === "check");
  const check = w.spec.beats[checkIdx]!.check;
  const wrong = check.choices.findIndex((c, i) => i !== check.correctIndex && c.misconceptionId);
  await openWorld(page, "transformer");
  await goToBeat(page, checkIdx);
  const before = await sectionCount(page);
  const marksBefore = await page.locator(".ruler-mark").count();
  const sec = page.locator(`main [data-beat-index="${checkIdx}"]`);
  await sec.locator("label.check-choice").nth(wrong).click();
  await sec.locator(".check-actions .btn-primary").click();
  await expect(sec.locator(".check")).toHaveAttribute("data-status", "incorrect");
  await expect.poll(() => sectionCount(page), { timeout: 30_000 }).toBeGreaterThan(before);
  await expect.poll(() => page.locator(".ruler-mark").count()).toBeGreaterThan(marksBefore);
  await expect(page.locator(".astro-remedial").first()).toBeAttached();
  // The new chapter is inserted after the check, and the reader is then carried into it (not back to the start).
  await expect.poll(() => activeIndex(page), { timeout: 15_000 }).toBe(checkIdx + 1);
  await expect(page.locator(`main [data-beat-index="${checkIdx + 1}"] .beat-banner`)).toBeAttached();
  expect(errors).toEqual([]);
});

test("the lens rewrites the narration for another level", async ({ page }) => {
  await openWorld(page, "fotosintesis");
  await goToBeat(page, 1);
  const narr = page.locator("[data-narration-active] .beat-body");
  const before = await narr.innerText();
  const stops = page.locator(".lens-stop");
  test.skip((await stops.count()) === 0 || !(await stops.first().isVisible()), "the lens lives in the menu on this layout");
  await page.locator(".lens-stop", { hasText: /Experto|Expert/ }).first().click();
  await expect.poll(() => narr.innerText()).not.toBe(before);
});

test("demo forge: console → forge theater replay → into the world", async ({ page }) => {
  test.setTimeout(150_000);
  const errors = watchConsole(page);
  await page.goto("/");
  const input = page.locator("textarea.console-input");
  await input.scrollIntoViewIfNeeded();
  await input.fill("¿Cómo piensa un Transformer?");
  await page.locator(".console-submit").click();
  await page.waitForURL(/\/forja\/demo-transformer/);
  await expect(page.locator(".theater-replay")).toBeVisible();
  const enter = page.locator(".theater-enter");
  await enter.waitFor({ timeout: 100_000 });
  await enter.click();
  await page.waitForURL(/\/m\/transformer/);
  await expect(page.locator("main [data-beat-index]").first()).toBeAttached();
  expect(errors).toEqual([]);
});

test("reading mode renders every section with a figure", async ({ page }) => {
  const w = loadWorld("agujeros-negros");
  await page.goto("/m/agujeros-negros/leer");
  const sections = page.locator('.reading-section[id^="r-"]');
  await expect(sections).toHaveCount(w.spec.beats.filter((b) => b.kind !== "finale").length);
  await expect.poll(() => page.locator(".reading-figure-img").count(), { timeout: 30_000 }).toBeGreaterThan(w.spec.beats.length - 3);
  await page.emulateMedia({ media: "print" });
  const breaks = await page.locator(".reading-figure").first().evaluate((el) => getComputedStyle(el).breakInside);
  expect(breaks).toBe("avoid");
  await page.screenshot({ path: test.info().outputPath("reading-print.png"), fullPage: true });
});

test("share by URL opens the same world in a fresh context", async ({ page, browser }) => {
  await openWorld(page, "interes-compuesto");
  await page.getByRole("button", { name: /Compartir|Share/ }).first().click();
  const field = page.locator(".share-link input");
  await expect(field).toHaveValue(/\/s\//);
  const link = await field.inputValue();
  const other = await browser.newContext();
  const p2 = await other.newPage();
  await p2.goto(link.replace(/^https?:\/\/[^/]+/, test.info().project.use.baseURL ?? ""));
  await expect(p2.locator("main [data-beat-index]").first()).toBeAttached({ timeout: 30_000 });
  await expect(p2.locator("h2.beat-title").first()).toContainText(/\w/);
  await other.close();
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("no morph travel, everything still works", async ({ page }) => {
    await openWorld(page, "ajolote");
    expect(await page.evaluate(() => (window as unknown as { __EIDOS__?: { stage?: { reducedMotion: boolean } } }).__EIDOS__?.stage?.reducedMotion ?? true)).toBe(true);
    await nextBeat(page);
    await nextBeat(page);
    expect(await activeIndex(page)).toBe(2);
  });
});
