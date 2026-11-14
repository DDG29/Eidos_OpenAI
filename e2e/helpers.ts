import { expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { World } from "../src/lib/world/types";

export interface StageView {
  status: string;
  programId: string | null;
  beat: number;
  stable: boolean;
}

export const demoIds = (): string[] => (JSON.parse(readFileSync("public/worlds/index.json", "utf8")) as { worlds: { id: string }[] }).worlds.map((w) => w.id);
export const loadWorld = (id: string): World => JSON.parse(readFileSync(`public/worlds/${id}.json`, "utf8")) as World;

/** Console errors and CSP violations; failed requests to optional endpoints are not errors of the app. */
export function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    const text = m.text();
    // Failed requests are reported below with their URL, which the console message lacks.
    if (text.startsWith("Failed to load resource")) return;
    // A software GPU (headless WebKit) can drop the WebGL context under load; the stage shows its poster and
    // recovers on `webglcontextrestored`, which the walk itself verifies by reaching the last beat.
    if (text === "WebGL: context lost.") return;
    if (m.type() === "error" || /Content Security Policy|Refused to (load|execute|apply|connect|create)/.test(text)) errors.push(text.slice(0, 400));
  });
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(`http ${r.status()} ${new URL(r.url()).pathname}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

export async function stage(page: Page): Promise<StageView | null> {
  return page.evaluate(() => (window as unknown as { __EIDOS__?: { state: () => StageView } }).__EIDOS__?.state() ?? null);
}

export async function waitForStage(page: Page, programPrefix?: string) {
  await expect
    .poll(async () => {
      const s = await stage(page);
      return !!s && (s.status === "ready" || s.status === "nowebgl") && (!programPrefix || s.status === "nowebgl" || (s.programId ?? "").startsWith(programPrefix));
    }, { timeout: 45_000 })
    .toBe(true);
}

export const activeIndex = (page: Page) => page.evaluate(() => Number(document.querySelector("[data-narration-active]")?.closest<HTMLElement>("[data-beat-index]")?.dataset.beatIndex ?? -1));
export const sectionCount = (page: Page) => page.locator("main [data-beat-index]").count();

/**
 * Next beat with the keyboard, skipping a pending check the way a reader would. J first settles the current beat
 * at its hold point when the reading point is still early in it, so it may take two presses.
 */
export async function nextBeat(page: Page) {
  const before = await activeIndex(page);
  const pending = page.locator('[data-narration-active] .check[data-status="pending"] .check-skip');
  if (await pending.count()) await pending.first().click();
  for (let k = 0; k < 3 && (await activeIndex(page)) <= before; k++) {
    await page.keyboard.press("j");
    await expect
      .poll(() => activeIndex(page), { timeout: 2_500 })
      .toBeGreaterThan(before)
      .catch(() => undefined);
  }
  expect(await activeIndex(page)).toBeGreaterThan(before);
  // The index flips as soon as the reading point enters the next beat, while the smooth scroll is still moving;
  // wait for the hold point so the next J advances instead of re-targeting this beat.
  await expect
    .poll(async () => {
      const s = await stage(page);
      return !s || s.status !== "ready" || s.stable;
    }, { timeout: 4_000 })
    .toBe(true)
    .catch(() => undefined);
}

export async function goToBeat(page: Page, i: number) {
  for (let guard = 0; guard < 40 && (await activeIndex(page)) < i; guard++) await nextBeat(page);
}

export async function openWorld(page: Page, id: string, query = "") {
  await page.goto(`/m/${id}${query}`);
  await page.waitForSelector("main [data-beat-index]");
  await waitForStage(page, `world:${id}`);
  await expect.poll(() => activeIndex(page)).toBeGreaterThanOrEqual(0);
}
