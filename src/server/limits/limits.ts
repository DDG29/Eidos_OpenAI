import { EidosError } from "@/lib/errors";

/**
 * Per-IP token buckets and a global daily budget (spec 10.8). In memory by default; a deployment with
 * Upstash configured could swap the store, but the in-memory version is what this prototype ships.
 */
export type Bucket = "forge" | "ask" | "grade" | "grow";

const PER_HOUR: Record<Bucket, () => number> = {
  forge: () => Number(process.env.LIMIT_FORGE_PER_HOUR || 6),
  ask: () => Number(process.env.LIMIT_ASK_PER_HOUR || 60),
  grade: () => Number(process.env.LIMIT_GRADE_PER_HOUR || 120),
  grow: () => Number(process.env.LIMIT_GROW_PER_HOUR || 20),
};

interface State {
  tokens: number;
  at: number;
}
const buckets = new Map<string, State>();

export function takeToken(bucket: Bucket, ip: string, now = Date.now()): boolean {
  const cap = Math.max(1, PER_HOUR[bucket]());
  const key = `${bucket}:${ip}`;
  const s = buckets.get(key) ?? { tokens: cap, at: now };
  const refill = ((now - s.at) / 3_600_000) * cap;
  s.tokens = Math.min(cap, s.tokens + refill);
  s.at = now;
  if (s.tokens < 1) {
    buckets.set(key, s);
    return false;
  }
  s.tokens -= 1;
  buckets.set(key, s);
  if (buckets.size > 50_000) buckets.delete(buckets.keys().next().value as string);
  return true;
}

let budgetDay = "";
let spentToday = 0;

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function dailyBudgetUsd(): number {
  return Number(process.env.DAILY_BUDGET_USD || 25);
}

export function addSpend(usd: number | null, byok: boolean) {
  if (byok || usd === null) return;
  if (budgetDay !== today()) {
    budgetDay = today();
    spentToday = 0;
  }
  spentToday += usd;
}

export function budgetExhausted(): boolean {
  if (budgetDay !== today()) return false;
  return spentToday >= dailyBudgetUsd();
}

export function spent(): number {
  return budgetDay === today() ? spentToday : 0;
}

export function guard(bucket: Bucket, ip: string, byok: boolean) {
  if (!takeToken(bucket, ip)) throw new EidosError("EIDOS_E_RATE_LIMIT", `rate limit for ${bucket}`);
  if (!byok && budgetExhausted()) throw new EidosError("EIDOS_E_BUDGET", "daily budget exhausted");
}

export function _resetLimits() {
  buckets.clear();
  spentToday = 0;
  budgetDay = "";
}
