import { NextResponse, type NextRequest } from "next/server";

/**
 * Content Security Policy with a per-request nonce (spec 10.10). Next reads the nonce from the request's CSP
 * header and stamps it on its own scripts; every page is already dynamic (the root layout reads the locale), so
 * the nonce is fresh on each view.
 *
 * - script-src: nonce + 'strict-dynamic' (chunks loaded by trusted scripts are trusted). 'wasm-unsafe-eval' is
 *   for pdf.js decoders; 'unsafe-eval' only in development, where React uses eval for error overlays.
 * - style-src keeps 'unsafe-inline' without a nonce: the reveal animations and the stage overlays set inline
 *   `style` attributes, and a nonce in style-src would make browsers ignore 'unsafe-inline' for them.
 * - worker-src 'self' blob: for the shape compiler and the pdf.js worker.
 */
export function buildCsp(nonce: string, dev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "worker-src 'self' blob:",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "connect-src 'self'",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce, process.env.NODE_ENV === "development");
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.svg|fonts|worlds|replays|og|posters).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
