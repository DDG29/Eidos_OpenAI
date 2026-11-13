/** Typed errors with codes (spec 1.10, 10.9). Messages shown to users come from i18n by code. */
export type ErrorCode =
  | "EIDOS_E_NO_KEY"
  | "EIDOS_E_PDF_TOO_BIG"
  | "EIDOS_E_PDF_TOO_LONG"
  | "EIDOS_E_PDF_UNREADABLE"
  | "EIDOS_E_URL_UNREACHABLE"
  | "EIDOS_E_REFUSAL"
  | "EIDOS_E_OVERLOADED"
  | "EIDOS_E_RATE_LIMIT"
  | "EIDOS_E_BUDGET"
  | "EIDOS_E_TRUNCATED"
  | "EIDOS_E_SCHEMA"
  | "EIDOS_E_WEB_DISABLED"
  | "EIDOS_E_TIMEOUT"
  | "EIDOS_E_INPUT"
  | "EIDOS_E_IMAGE"
  | "EIDOS_E_UNKNOWN";

const STATUS: Record<ErrorCode, number> = {
  EIDOS_E_NO_KEY: 503,
  EIDOS_E_PDF_TOO_BIG: 413,
  EIDOS_E_PDF_TOO_LONG: 413,
  EIDOS_E_PDF_UNREADABLE: 422,
  EIDOS_E_URL_UNREACHABLE: 422,
  EIDOS_E_REFUSAL: 422,
  EIDOS_E_OVERLOADED: 503,
  EIDOS_E_RATE_LIMIT: 429,
  EIDOS_E_BUDGET: 429,
  EIDOS_E_TRUNCATED: 502,
  EIDOS_E_SCHEMA: 502,
  EIDOS_E_WEB_DISABLED: 200,
  EIDOS_E_TIMEOUT: 504,
  EIDOS_E_INPUT: 400,
  EIDOS_E_IMAGE: 400,
  EIDOS_E_UNKNOWN: 500,
};

export class EidosError extends Error {
  readonly status: number;
  constructor(
    readonly code: ErrorCode,
    message?: string,
    readonly recoverable = true,
    readonly vars: Record<string, string | number> = {},
  ) {
    super(message ?? code);
    this.status = STATUS[code];
  }
  toJSON() {
    return { code: this.code, message: this.message, recoverable: this.recoverable, vars: this.vars };
  }
}

export function asEidosError(e: unknown): EidosError {
  if (e instanceof EidosError) return e;
  return new EidosError("EIDOS_E_UNKNOWN", e instanceof Error ? e.message : "unknown error");
}
