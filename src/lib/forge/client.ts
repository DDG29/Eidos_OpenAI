"use client";

import { nanoid } from "nanoid";
import type { ForgeRequest } from "./request";

/** Pending forge requests, handed from the console to the Forge Theater route without serializing files. */
const pending = new Map<string, ForgeRequest>();

export function startForge(req: ForgeRequest): string {
  const id = nanoid(10);
  pending.set(id, req);
  return id;
}

export function takeForgeRequest(id: string): ForgeRequest | null {
  const r = pending.get(id) ?? null;
  return r;
}

export function dropForgeRequest(id: string) {
  pending.delete(id);
}
