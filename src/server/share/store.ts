/** KV for short share links (spec 10.7). Only active when Upstash env vars exist. */
export function kvConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function redis() {
  const { Redis } = await import("@upstash/redis");
  return new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! });
}

export async function putShared(id: string, json: string) {
  await (await redis()).set(`eidos:share:${id}`, json, { ex: 30 * 24 * 3600 });
}

export async function getShared(id: string): Promise<string | null> {
  const v = await (await redis()).get<string | object>(`eidos:share:${id}`);
  if (v === null || v === undefined) return null;
  return typeof v === "string" ? v : JSON.stringify(v);
}
