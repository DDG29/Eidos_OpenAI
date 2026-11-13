/**
 * Voice narration with the browser's speech synthesis (spec 12.7). Reads the active beat's title and sentences,
 * one utterance per sentence so the sentence being read can be marked in the DOM. Any new beat (or stop())
 * cancels what is being read: a run token makes late callbacks from a cancelled run harmless.
 */

export const hasSpeech = () => typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";

/** Prefer the voice chosen in Settings, then es-MX, then any voice of the world's language. */
export function pickVoice(voices: readonly SpeechSynthesisVoice[], lang: string, preferred: string): SpeechSynthesisVoice | null {
  const byName = preferred ? voices.find((v) => v.name === preferred) : undefined;
  if (byName) return byName;
  const base = lang.slice(0, 2).toLowerCase();
  const local = base === "es" ? voices.find((v) => v.lang.toLowerCase() === "es-mx") : undefined;
  return local ?? voices.find((v) => v.lang.toLowerCase().startsWith(base) && v.localService) ?? voices.find((v) => v.lang.toLowerCase().startsWith(base)) ?? null;
}

export class Narrator {
  private run = 0;
  private marked: HTMLElement | null = null;

  stop() {
    this.run++;
    this.unmark();
    if (hasSpeech()) window.speechSynthesis.cancel();
  }

  private unmark() {
    if (this.marked) {
      delete this.marked.dataset.speaking;
      this.marked.style.removeProperty("--speak-ms");
    }
    this.marked = null;
  }

  /** Reads `root` (a beat narration block): its title, then each `.sentence` (or the check question). */
  speak(root: HTMLElement, opts: { lang: string; voiceName: string; rate: number }) {
    this.stop();
    if (!hasSpeech()) return;
    const run = this.run;
    const synth = window.speechSynthesis;
    const voice = pickVoice(synth.getVoices(), opts.lang, opts.voiceName);
    const parts: { text: string; el: HTMLElement | null }[] = [];
    const title = root.querySelector<HTMLElement>(".beat-title");
    if (title?.textContent?.trim()) parts.push({ text: title.textContent.trim(), el: null });
    const question = root.querySelector<HTMLElement>(".beat-question");
    if (question?.textContent?.trim()) parts.push({ text: question.textContent.trim(), el: question });
    for (const s of root.querySelectorAll<HTMLElement>(".sentence")) {
      const text = s.textContent?.trim();
      if (text) parts.push({ text, el: s });
    }
    for (const p of parts) {
      const u = new SpeechSynthesisUtterance(p.text);
      u.lang = voice?.lang ?? opts.lang;
      if (voice) u.voice = voice;
      u.rate = Math.min(1.6, Math.max(0.6, opts.rate));
      u.onstart = () => {
        if (run !== this.run) return;
        this.unmark();
        if (p.el) {
          // The underline advances over an estimate of the utterance length (~14 characters per second at rate 1);
          // boundary events are too unevenly supported to drive it.
          p.el.style.setProperty("--speak-ms", `${Math.round((p.text.length / 14 / u.rate) * 1000)}ms`);
          p.el.dataset.speaking = "1";
          this.marked = p.el;
        }
      };
      u.onend = () => {
        if (run === this.run && this.marked === p.el) this.unmark();
      };
      synth.speak(u);
    }
  }
}
