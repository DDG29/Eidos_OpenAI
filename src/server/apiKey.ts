import { serverHasKey } from "./health";

/** Server key, or a BYOK key from the request header when the deployment allows it (spec 10.8). Never logged. */
export function resolveKey(req: Request): { key: string | null; byok: boolean } {
  const user = req.headers.get("x-eidos-user-key")?.trim();
  if (user && process.env.ALLOW_BYOK === "true" && /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(user)) return { key: user, byok: true };
  if (serverHasKey()) return { key: process.env.ANTHROPIC_API_KEY!.trim(), byok: false };
  return { key: null, byok: false };
}
