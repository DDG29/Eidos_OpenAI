/// <reference lib="webworker" />
import * as Comlink from "comlink";
import type { Layer, Transition } from "@/lib/world/types";
import { ensureFonts } from "../shapes/raster/fonts";
import type { ImageLike } from "../shapes/types";
import { ProgramCompiler, type BuiltBeat, type ProgramInput } from "./program";

const compilers = new Map<string, ProgramCompiler>();
let fontsReady: Promise<void> | null = null;

function transferList(b: Omit<BuiltBeat, "index">): Transferable[] {
  // Copies are transferred; the compiler keeps its own cached originals.
  return [b.buffer.positions.buffer, b.buffer.aux.buffer, b.buffer.colors.buffer, b.buffer.regionIds.buffer, b.delays.buffer] as Transferable[];
}

function cloneBuilt<T extends Omit<BuiltBeat, "index">>(b: T): T {
  return {
    ...b,
    buffer: {
      ...b.buffer,
      positions: b.buffer.positions.slice(),
      aux: b.buffer.aux.slice(),
      colors: b.buffer.colors.slice(),
      regionIds: b.buffer.regionIds.slice(),
    },
    delays: b.delays.slice(),
  };
}

const api = {
  async init(origin: string) {
    fontsReady ??= ensureFonts((url) => fetch(origin + url).then((r) => r.arrayBuffer()));
    await fontsReady;
    return true;
  },
  setProgram(input: ProgramInput) {
    let c = compilers.get(input.id);
    if (!c) {
      c = new ProgramCompiler();
      compilers.set(input.id, c);
    }
    c.setProgram(input);
    return c.length;
  },
  setImage(programId: string, img: ImageLike | null) {
    compilers.get(programId)?.setImage(img);
  },
  async build(programId: string, index: number) {
    await fontsReady;
    const c = compilers.get(programId);
    if (!c) throw new Error(`unknown program ${programId}`);
    const t0 = performance.now();
    const b = cloneBuilt(c.build(index));
    const ms = performance.now() - t0;
    return Comlink.transfer({ ...b, ms }, transferList(b));
  },
  async buildEvent(programId: string, layers: Layer[], againstIndex: number | null, transition: Transition, dustFraction: number, seed: string) {
    await fontsReady;
    const c = compilers.get(programId);
    if (!c) throw new Error(`unknown program ${programId}`);
    const b = cloneBuilt(c.buildEvent(layers, againstIndex, transition, dustFraction, seed));
    return Comlink.transfer(b, transferList(b));
  },
  randoms(programId: string) {
    const r = compilers.get(programId)?.getRandoms().slice();
    if (!r) throw new Error(`unknown program ${programId}`);
    return Comlink.transfer(r, [r.buffer]);
  },
  drop(programId: string) {
    compilers.delete(programId);
  },
};

export type ShapeWorkerApi = typeof api;
Comlink.expose(api);
