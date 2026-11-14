import type { World } from "@/lib/world/types";

/**
 * Autopilot (spec 12.3): a scripted presenter that drives the real interface. Every step waits on a real
 * condition (an element exists, the reading point reached a beat, the stage settled) with a timeout, never on
 * a blind sleep alone, so it keeps working on slow machines. It clicks real buttons, types into the real
 * console and sends the same keys a person would; nothing here reaches into React state.
 */

export class AutopilotAborted extends Error {
  constructor() {
    super("autopilot aborted");
  }
}

export interface PilotEnv {
  navigate: (url: string) => void;
  signal: AbortSignal;
  cursor: VirtualCursor;
  /** Short caption under the cursor, already translated. */
  say: (key: PilotLine) => void;
  /** Replay speed for the forge theater. */
  speed: number;
}

export type PilotLine = "landing" | "console" | "theater" | "walk" | "filament" | "ask" | "check" | "remedial" | "lens" | "finale" | "engine" | "end" | "pitch";

const POLL = 120;

function check(signal: AbortSignal) {
  if (signal.aborted) throw new AutopilotAborted();
}

export function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new AutopilotAborted());
    const id = window.setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (window.clearTimeout(id), reject(new AutopilotAborted())), { once: true });
  });
}

/** Resolves with the first truthy value of `fn`, or with null after `timeout` ms. */
export async function waitFor<T>(fn: () => T | null | undefined | false, signal: AbortSignal, timeout = 15000): Promise<T | null> {
  const t0 = performance.now();
  for (;;) {
    check(signal);
    const v = fn();
    if (v) return v;
    if (performance.now() - t0 > timeout) return null;
    await sleep(POLL, signal);
  }
}

const $ = <E extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<E>(sel);
const $$ = <E extends Element = HTMLElement>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<E>(sel));

function visible(el: Element | null): boolean {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
}

/** The 18 px presenter cursor with a soft trail. Pure DOM, owned by the host component. */
export class VirtualCursor {
  x = window.innerWidth * 0.5;
  y = window.innerHeight * 0.6;
  constructor(
    private el: HTMLElement,
    private trail: HTMLElement | null = null,
  ) {
    this.place(this.x, this.y, 0);
  }
  private place(x: number, y: number, ms: number) {
    const t = `translate3d(${x - 9}px, ${y - 9}px, 0)`;
    this.el.style.transitionDuration = `${ms}ms`;
    this.el.style.transform = t;
    // The trail follows the same path more slowly, which reads as a soft wake behind the cursor.
    if (this.trail) {
      this.trail.style.transitionDuration = `${Math.round(ms * 1.7)}ms`;
      this.trail.style.transform = t;
    }
    this.x = x;
    this.y = y;
  }
  async moveTo(x: number, y: number, signal: AbortSignal) {
    const d = Math.hypot(x - this.x, y - this.y);
    const ms = Math.round(Math.min(900, 260 + d * 0.6));
    this.place(x, y, ms);
    await sleep(ms + 60, signal);
  }
  async pulse(signal: AbortSignal) {
    this.el.dataset.press = "1";
    await sleep(180, signal);
    delete this.el.dataset.press;
  }
}

async function clickEl(env: PilotEnv, el: HTMLElement) {
  if (!visible(el)) el.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior });
  const r = el.getBoundingClientRect();
  await env.cursor.moveTo(r.left + r.width / 2, r.top + r.height / 2, env.signal);
  await env.cursor.pulse(env.signal);
  el.click();
}

/** A press on the particle form itself (the player picks on pointerup over a non-UI target). */
async function clickPoint(env: PilotEnv, x: number, y: number) {
  await env.cursor.moveTo(x, y, env.signal);
  await env.cursor.pulse(env.signal);
  const target = document.elementFromPoint(x, y) ?? document.body;
  const init: PointerEventInit = { clientX: x, clientY: y, pointerType: "mouse", bubbles: true, isPrimary: true };
  target.dispatchEvent(new PointerEvent("pointerdown", init));
  target.dispatchEvent(new PointerEvent("pointerup", init));
}

function key(k: string, shift = false) {
  window.dispatchEvent(new KeyboardEvent("keydown", { key: k, shiftKey: shift, bubbles: true }));
}

/** Types into a React-controlled field one character at a time, with a human cadence. */
async function typeInto(env: PilotEnv, el: HTMLTextAreaElement | HTMLInputElement, text: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  el.focus();
  for (let i = 1; i <= text.length; i++) {
    setter?.call(el, text.slice(0, i));
    el.dispatchEvent(new Event("input", { bubbles: true }));
    const ch = text[i - 1]!;
    await sleep(ch === " " ? 120 : /[,.?¿]/.test(ch) ? 200 : 55 + Math.random() * 70, env.signal);
  }
  el.blur();
}

// ---------- the stage and the player ----------

interface StageView {
  stable: boolean;
  programId: string | null;
}
const stageState = (): StageView | null => {
  const g = (window as unknown as { __EIDOS__?: { state: () => StageView } }).__EIDOS__;
  return g ? g.state() : null;
};

const activeSection = () => $("[data-narration-active]")?.closest<HTMLElement>("[data-beat-index]") ?? null;
const activeIndex = () => Number(activeSection()?.dataset.beatIndex ?? -1);
const sectionCount = () => $$("main [data-beat-index]").length;

async function settle(env: PilotEnv, extra = 0) {
  await sleep(500, env.signal);
  await waitFor(() => stageState()?.stable, env.signal, 6000);
  if (extra) await sleep(extra, env.signal);
}

const PANELS = ".ask-panel, .engine-room, .source-panel, .radial, .player-menu";

/**
 * Closes whatever panel is open: Esc first, then the panel's own close button if Esc did not land (a busy main
 * thread can drop the synthetic key while a panel is still mounting). Open panels swallow the reading keys.
 */
async function closePanels(env: PilotEnv) {
  if (!$(PANELS)) return;
  key("Escape");
  if (await waitFor(() => !$(PANELS), env.signal, 1500)) return;
  for (const btn of $$<HTMLButtonElement>(".ask-panel .btn-icon[aria-label], .engine-room .btn-icon[aria-label]")) await clickEl(env, btn);
  await waitFor(() => !$(PANELS), env.signal, 1500);
}

/** j until the reading point is at beat `i` (or the gate stops us). */
async function walkTo(env: PilotEnv, i: number, hold = 2600) {
  for (let guard = 0; guard < 40 && activeIndex() < i; guard++) {
    await closePanels(env);
    const before = activeIndex();
    key("j");
    await waitFor(() => activeIndex() > before, env.signal, 2600);
    const sec = activeSection();
    if (sec?.dataset.kind === "check" && $('.check[data-status="pending"]', sec) && activeIndex() < i) {
      // An unanswered check holds the gate: the presenter skips it.
      const skip = $(".check-skip", sec);
      await sleep(1200, env.signal);
      if (skip) await clickEl(env, skip);
      await sleep(700, env.signal);
    }
  }
  await settle(env, hold);
}

async function loadWorld(id: string): Promise<World | null> {
  try {
    const r = await fetch(`/worlds/${id}.json`);
    return r.ok ? ((await r.json()) as World) : null;
  } catch {
    return null;
  }
}

async function answer(env: PilotEnv, sec: HTMLElement, choice: number) {
  const box = await waitFor(() => $('.check[data-status="pending"]', sec), env.signal, 5000);
  if (!box) return false;
  const labels = $$("label.check-choice", box);
  const target = labels[choice];
  if (!target) return false;
  await clickEl(env, target);
  await sleep(900, env.signal);
  const submit = $(".check-actions .btn-primary", box);
  if (submit) await clickEl(env, submit);
  return true;
}

// ---------- scripts ----------

const DEMO_TOPIC: Record<string, string> = { es: "¿Cómo piensa un Transformer?", en: "How does a Transformer think?" };

export async function runMainScript(env: PilotEnv, lang: "es" | "en") {
  const { signal } = env;

  // 1. Landing: the six movements.
  env.say("landing");
  if (window.location.pathname !== "/") env.navigate("/");
  await waitFor(() => $$(".mv[data-beat-index]").length >= 6, signal, 20000);
  window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  await settle(env, 2200);
  for (let i = 0; i < 6; i++) {
    key(" ");
    await sleep(i === 0 ? 3200 : 3800, signal);
  }

  // 2. The console.
  env.say("console");
  const input = await waitFor(() => $<HTMLTextAreaElement>("textarea.console-input"), signal, 8000);
  if (input) {
    input.scrollIntoView({ block: "center", behavior: "smooth" });
    await sleep(900, signal);
    const r = input.getBoundingClientRect();
    await env.cursor.moveTo(r.left + 40, r.top + r.height / 2, signal);
    await typeInto(env, input, DEMO_TOPIC[lang]!);
    await sleep(500, signal);
    const submit = $<HTMLButtonElement>(".console-submit");
    if (submit) await clickEl(env, submit);
  }

  // 3–4. The forge theater, then into the world as soon as it opens.
  env.say("theater");
  await waitFor(() => window.location.pathname.startsWith("/forja/"), signal, 10000);
  const speed = await waitFor(() => $$<HTMLButtonElement>(".theater-speed button").find((b) => b.textContent?.includes(`×${env.speed}`)), signal, 8000);
  if (speed && speed.getAttribute("aria-pressed") !== "true") await clickEl(env, speed);
  const enter = await waitFor(() => $<HTMLButtonElement>(".theater-enter"), signal, 90000);
  if (enter) {
    await sleep(1500, signal);
    if (window.location.pathname.startsWith("/forja/")) await clickEl(env, enter);
  }
  await waitFor(() => window.location.pathname.startsWith("/m/"), signal, 15000);
  const worldId = window.location.pathname.split("/")[2] ?? "transformer";
  const world = await loadWorld(worldId);
  await waitFor(() => sectionCount() > 3 && activeIndex() >= 0, signal, 15000);
  await settle(env, 2500);

  // 5. Beats 1–6, with a filament opened on beat 3.
  env.say("walk");
  await walkTo(env, 1);
  await walkTo(env, 2, 1200);
  env.say("filament");
  const fil = await waitFor(() => $<HTMLButtonElement>("[data-narration-active] .filament"), signal, 4000);
  if (fil) {
    await clickEl(env, fil);
    await sleep(4200, signal);
    await closePanels(env);
    await sleep(500, signal);
  }

  // 6. Ask the scene on beat 4.
  await walkTo(env, 3, 1500);
  env.say("ask");
  const dot = await waitFor(() => $$<SVGCircleElement>(".anno-dot").find((d) => visible(d)), signal, 5000);
  if (dot) {
    const r = dot.getBoundingClientRect();
    await clickPoint(env, r.left + r.width / 2, r.top + r.height / 2);
    const what = await waitFor(() => $<HTMLButtonElement>(".radial .radial-opt"), signal, 4000);
    if (what) {
      await sleep(700, signal);
      await clickEl(env, what);
      const send = await waitFor(() => $<HTMLButtonElement>(".ask-form button[type=submit]:not(:disabled)"), signal, 4000);
      if (send) {
        await sleep(900, signal);
        await clickEl(env, send);
      }
      // Live: the Tutor answers the region question. Demo: no recorded answer matches a free question, so the
      // panel lists the recorded ones; the presenter picks the one recorded for this beat.
      const got = await waitFor(() => $(".ask-answer") ?? $(".ask-suggest button"), signal, 20000);
      if (got?.matches(".ask-suggest button")) {
        const beatId = world?.spec.beats[activeIndex()]?.id;
        const recorded = world?.demoAssets?.askReplays?.find((r) => r.beatId === beatId)?.question;
        const pick = $$<HTMLButtonElement>(".ask-suggest button").find((b) => recorded && b.textContent?.trim() === recorded) ?? $<HTMLButtonElement>(".ask-suggest button");
        await sleep(1800, signal);
        if (pick) await clickEl(env, pick);
        await waitFor(() => $(".ask-answer"), signal, 15000);
      }
      await sleep(6000, signal);
    }
    await closePanels(env);
    await sleep(600, signal);
  }
  await walkTo(env, 5, 2200);

  // 7. The first check: the misconception's distractor, the crack, the remedial chapter, then the follow-up.
  const checkIdx = world ? world.spec.beats.findIndex((b) => b.kind === "check") : 6;
  const checkBeat = world?.spec.beats[checkIdx];
  if (checkBeat && checkIdx >= 0) {
    await walkTo(env, checkIdx, 1800);
    env.say("check");
    const wrong = checkBeat.check.choices.findIndex((c, i) => i !== checkBeat.check.correctIndex && c.misconceptionId);
    const before = sectionCount();
    const sec = activeSection();
    if (sec && (await answer(env, sec, wrong >= 0 ? wrong : (checkBeat.check.correctIndex + 1) % checkBeat.check.choices.length))) {
      env.say("remedial");
      const grown = await waitFor(() => sectionCount() > before, signal, 25000);
      await sleep(2500, signal);
      if (grown) {
        const added = sectionCount() - before;
        const followUp = world?.demoAssets?.remedials?.[checkBeat.id]?.at(-1);
        for (let k = 1; k <= added; k++) {
          await walkTo(env, checkIdx + k, 3200);
          const s = activeSection();
          if (s?.dataset.kind === "check" && followUp?.check.enabled) {
            await answer(env, s, followUp.check.correctIndex);
            await sleep(3500, signal);
          }
        }
      }
    }
  }

  // 8. The lens: to Curioso and back.
  env.say("lens");
  const stops = $$<HTMLButtonElement>(".topbar .lens-stop");
  const current = stops.findIndex((b) => b.getAttribute("aria-checked") === "true");
  if (stops[0] && current > 0) {
    await clickEl(env, stops[0]);
    await sleep(5000, signal);
    const back = stops[current];
    if (back) await clickEl(env, back);
    await sleep(3000, signal);
  }

  // 9. To the finale (the presenter skips the remaining checks).
  env.say("finale");
  await walkTo(env, sectionCount() - 1, 9000);

  // 10. The engine room for a few seconds.
  env.say("engine");
  const more = $$<HTMLButtonElement>(".topbar button[aria-expanded]").find((b) => /^(Más|More)$/.test(b.getAttribute("aria-label") ?? "")) ?? null;
  if (more) {
    await clickEl(env, more);
    const item = await waitFor(() => $$<HTMLButtonElement>(".player-menu .menu-item").find((b) => /m[aá]quinas|engine/i.test(b.textContent ?? "")), signal, 3000);
    if (item) {
      await clickEl(env, item);
      await sleep(5500, signal);
    }
    await closePanels(env);
    await sleep(800, signal);
  }

  // 11. Back to the landing: «Toda idea tiene forma.»
  env.say("end");
  env.navigate("/");
  await waitFor(() => $$(".mv[data-beat-index]").length >= 6, signal, 15000);
  window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  await settle(env, 4000);
}

/** /pitch: advance beat by beat, holding each long enough to be read aloud. */
export async function runPitchScript(env: PilotEnv) {
  env.say("pitch");
  await waitFor(() => sectionCount() > 3 && activeIndex() >= 0, env.signal, 15000);
  await settle(env, 4000);
  for (let guard = 0; guard < 30; guard++) {
    const sec = activeSection();
    const words = (sec?.textContent ?? "").split(/\s+/).length;
    await sleep(Math.min(14000, 4500 + words * 230), env.signal);
    const before = activeIndex();
    if (before >= sectionCount() - 1) break;
    key(" ");
    await waitFor(() => activeIndex() > before, env.signal, 4000);
    await settle(env);
  }
}
