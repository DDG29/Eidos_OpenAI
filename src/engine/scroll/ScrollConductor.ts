import Lenis from "lenis";
import { gsap } from "gsap";

/**
 * DOM scroll → global progress (spec 5.11). Sections carry `data-beat-index`; the active one contains the
 * point at 45% of the viewport height. One loop only: the GSAP ticker drives Lenis.
 */

export interface ConductorState {
  index: number;
  local: number; // s ∈ [0,1]
  morph: number; // smoothstep(0, 0.35, s)
  global: number; // P = i + s
  count: number;
  jumping: boolean;
}

export interface ConductorOptions {
  root?: HTMLElement;
  reducedMotion: boolean;
  /** viewport fraction used as the reading point */
  readingPoint?: number;
  onUpdate?: (s: ConductorState) => void;
  onGate?: (index: number) => void;
}

export const GATE_AT = 0.5;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class ScrollConductor {
  private lenis: Lenis | null = null;
  private sections: HTMLElement[] = [];
  private tops: number[] = [];
  private heights: number[] = [];
  private ro: ResizeObserver | null = null;
  private mo: MutationObserver | null = null;
  private tickerFn: ((t: number) => void) | null = null;
  private gate: number | null = null;
  private gateCooldown = 0;
  state: ConductorState = { index: 0, local: 0, morph: 0, global: 0, count: 0, jumping: false };
  private listeners = new Set<(s: ConductorState) => void>();
  private readonly reading: number;
  private destroyed = false;
  private jumpTarget: number | null = null;

  constructor(private opts: ConductorOptions) {
    this.reading = opts.readingPoint ?? 0.45;
    if (opts.onUpdate) this.listeners.add(opts.onUpdate);
    const root = opts.root ?? document.body;
    if (!opts.reducedMotion) {
      this.lenis = new Lenis({ duration: 1.15, smoothWheel: true, syncTouch: false, anchors: false });
      this.lenis.on("scroll", (e: { scroll: number }) => this.onScroll(e.scroll));
      this.tickerFn = (t: number) => this.lenis?.raf(t * 1000);
      gsap.ticker.add(this.tickerFn);
      gsap.ticker.lagSmoothing(0);
    } else {
      window.addEventListener("scroll", this.onNativeScroll, { passive: true });
    }
    this.ro = new ResizeObserver(() => this.measure());
    this.ro.observe(root);
    this.mo = new MutationObserver(() => this.collect());
    this.mo.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-beat-index"] });
    this.collect();
  }

  private onNativeScroll = () => this.onScroll(window.scrollY);

  subscribe(fn: (s: ConductorState) => void): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  /** Re-read sections (after insertions) and positions. */
  collect() {
    if (this.destroyed) return;
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-beat-index]"));
    els.sort((a, b) => Number(a.dataset.beatIndex) - Number(b.dataset.beatIndex));
    for (const el of this.sections) if (!els.includes(el)) this.ro?.unobserve(el);
    for (const el of els) if (!this.sections.includes(el)) this.ro?.observe(el);
    this.sections = els;
    this.measure();
  }

  measure() {
    const y = window.scrollY;
    this.tops = this.sections.map((el) => el.getBoundingClientRect().top + y);
    this.heights = this.sections.map((el) => el.offsetHeight);
    this.lenis?.resize();
    this.onScroll(this.lenis ? this.lenis.scroll : window.scrollY);
  }

  private onScroll(y: number) {
    const n = this.sections.length;
    if (!n) return;
    const vh = window.innerHeight;
    let probe = y + vh * this.reading;
    // Soft gate: an unanswered check stops the reading point inside its section (spec 5.11.3 says 85%).
    // We stop at 50%: with 120vh check sections and a 100vh sticky narration, anything later has already
    // scrolled the question off the top of the screen.
    if (this.gate !== null && this.tops[this.gate] !== undefined) {
      const limit = this.tops[this.gate]! + this.heights[this.gate]! * GATE_AT;
      if (probe > limit) {
        const target = limit - vh * this.reading - 2;
        const now = performance.now();
        if (now - this.gateCooldown > 250) {
          this.gateCooldown = now;
          this.opts.onGate?.(this.gate);
          if (this.lenis) this.lenis.scrollTo(target, { duration: 0.5, easing: (t: number) => 1 - Math.pow(1 - t, 3), force: true });
          else window.scrollTo({ top: target });
        }
        probe = limit;
      }
    }
    let i = 0;
    for (let k = 0; k < n; k++) if (probe >= this.tops[k]!) i = k;
    const h = Math.max(1, this.heights[i]!);
    const s = Math.min(1, Math.max(0, (probe - this.tops[i]!) / h));
    this.state = { index: i, local: s, morph: smooth(0, 0.35, s), global: i + s, count: n, jumping: this.jumpTarget !== null };
    for (const l of this.listeners) l(this.state);
  }

  setGate(index: number | null) {
    this.gate = index;
  }

  /** Scroll so that beat i sits in its hold phase (s ≈ 0.5). */
  targetFor(i: number, s = 0.5): number {
    const vh = window.innerHeight;
    const top = this.tops[i] ?? 0;
    const h = this.heights[i] ?? vh;
    return Math.max(0, top + h * s - vh * this.reading);
  }

  scrollToBeat(i: number, opts: { immediate?: boolean; s?: number; onDone?: () => void } = {}) {
    const n = this.sections.length;
    if (!n) return;
    const idx = Math.max(0, Math.min(n - 1, i));
    if (this.gate !== null && idx > this.gate) {
      this.opts.onGate?.(this.gate);
      return;
    }
    const target = this.targetFor(idx, opts.s ?? 0.5);
    const far = Math.abs(idx - this.state.index) > 1;
    if (far) this.jumpTarget = idx;
    const done = () => {
      this.jumpTarget = null;
      this.onScroll(this.lenis ? this.lenis.scroll : window.scrollY);
      opts.onDone?.();
    };
    if (this.lenis && !opts.immediate) this.lenis.scrollTo(target, { duration: far ? 1.2 : 0.9, easing: (t: number) => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2), onComplete: done, force: true });
    else {
      window.scrollTo({ top: target });
      this.lenis?.scrollTo(target, { immediate: true, force: true });
      done();
    }
  }

  next() {
    this.scrollToBeat(this.state.local < 0.4 ? this.state.index : this.state.index + 1);
  }

  prev() {
    this.scrollToBeat(this.state.local > 0.6 ? this.state.index : this.state.index - 1);
  }

  get isJumping() {
    return this.jumpTarget !== null;
  }

  stop() {
    this.lenis?.stop();
  }

  start() {
    this.lenis?.start();
  }

  destroy() {
    this.destroyed = true;
    if (this.tickerFn) gsap.ticker.remove(this.tickerFn);
    this.lenis?.destroy();
    window.removeEventListener("scroll", this.onNativeScroll);
    this.ro?.disconnect();
    this.mo?.disconnect();
    this.listeners.clear();
  }
}
