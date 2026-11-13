import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { existsSync, appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Session tokens (spec 10.6): { v, fileIds, mode, docTitles, exp } encrypted with AES-256-GCM under
 * SESSION_SECRET. The client never sees a file_id; it only carries this opaque token.
 */
export interface SessionPayload {
  v: 1;
  fileIds: string[];
  mode: "pdf" | "image" | "url" | "text" | "topic";
  docTitles: string[];
  exp: number; // epoch ms
}

let devSecret: Buffer | null = null;

export function sessionSecret(): Buffer | null {
  const env = process.env.SESSION_SECRET?.trim();
  if (env) {
    const b = Buffer.from(env, "base64");
    if (b.length === 32) return b;
  }
  if (process.env.NODE_ENV !== "development") return null;
  if (devSecret) return devSecret;
  // Development only: generate once and persist to .env.local with a comment.
  devSecret = randomBytes(32);
  const file = join(process.cwd(), ".env.local");
  try {
    const existing = existsSync(file) ? readFileSync(file, "utf8") : "";
    if (!/^SESSION_SECRET=/m.test(existing))
      appendFileSync(file, `\n# Generated automatically in development (spec 10.6). Do not commit.\nSESSION_SECRET=${devSecret.toString("base64")}\n`);
  } catch {
    /* read-only filesystem: keep it in memory */
  }
  return devSecret;
}

export function sealSession(p: Omit<SessionPayload, "v" | "exp">, ttlMs = 24 * 3600 * 1000, key = sessionSecret()): string | null {
  if (!key) return null;
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([c.update(JSON.stringify({ v: 1, ...p, exp: Date.now() + ttlMs }), "utf8"), c.final()]);
  return Buffer.concat([iv, body, c.getAuthTag()]).toString("base64url");
}

export function openSession(token: string | undefined | null, key = sessionSecret()): SessionPayload | null {
  if (!token || !key) return null;
  try {
    const raw = Buffer.from(token, "base64url");
    if (raw.length < 12 + 16 + 2) return null;
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(raw.length - 16);
    const body = raw.subarray(12, raw.length - 16);
    const d = createDecipheriv("aes-256-gcm", key, iv);
    d.setAuthTag(tag);
    const p = JSON.parse(Buffer.concat([d.update(body), d.final()]).toString("utf8")) as SessionPayload;
    if (p.v !== 1 || typeof p.exp !== "number" || p.exp < Date.now() || !Array.isArray(p.fileIds)) return null;
    return p;
  } catch {
    return null;
  }
}
