import { cookies, headers } from "next/headers";
import { isLocale, LOCALE_COOKIE, pickLocale, type Locale } from "./index";

export async function getRequestLocale(): Promise<Locale> {
  const fallback = isLocale(process.env.NEXT_PUBLIC_DEFAULT_LOCALE) ? process.env.NEXT_PUBLIC_DEFAULT_LOCALE : "es";
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(c)) return c;
  return pickLocale((await headers()).get("accept-language"), fallback);
}
