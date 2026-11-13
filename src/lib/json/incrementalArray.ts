/**
 * Incremental scanner for streamed structured output (spec 9.6.5). Feeds on arbitrary text chunks, tracks
 * brace/bracket depth and string/escape state, and emits each element of a top-level array (e.g. "beats")
 * the moment it closes, plus the object prefix before that array (title, palette, concepts…).
 */
export class IncrementalArrayScanner {
  private buf = "";
  private pos = 0;
  private depth = 0;
  private inString = false;
  private escape = false;
  private strStart = -1;
  private lastString = "";
  private pendingKey: string | null = null;
  private currentKey: string | null = null;
  private arrayDepth = -1;
  private elemStart = -1;
  private keyPos = -1;
  done = false;
  prefix: Record<string, unknown> | null = null;

  constructor(
    private key: string,
    private onElement: (value: unknown, raw: string) => void,
    private onPrefix?: (prefix: Record<string, unknown>) => void,
  ) {}

  get text() {
    return this.buf;
  }

  push(chunk: string) {
    this.buf += chunk;
    const s = this.buf;
    for (; this.pos < s.length; this.pos++) {
      const c = s[this.pos]!;
      if (this.inString) {
        if (this.escape) this.escape = false;
        else if (c === "\\") this.escape = true;
        else if (c === '"') {
          this.inString = false;
          this.lastString = s.slice(this.strStart + 1, this.pos);
          // a string at object depth 1 followed by ':' is a key (checked lazily at ':')
          this.pendingKey = this.depth === 1 ? this.lastString : null;
          if (this.pendingKey !== null) this.keyPos = this.strStart;
        }
        continue;
      }
      switch (c) {
        case '"':
          this.inString = true;
          this.strStart = this.pos;
          break;
        case ":":
          if (this.depth === 1 && this.pendingKey !== null) {
            this.currentKey = this.pendingKey;
            if (this.currentKey === this.key && !this.prefix) this.emitPrefix(this.keyPos);
          }
          this.pendingKey = null;
          break;
        case "{":
        case "[":
          if (c === "[" && this.depth === 1 && this.currentKey === this.key && this.arrayDepth < 0) this.arrayDepth = this.depth + 1;
          else if (c === "{" && this.arrayDepth > 0 && this.depth === this.arrayDepth) this.elemStart = this.pos;
          this.depth++;
          break;
        case "}":
        case "]":
          this.depth--;
          if (c === "}" && this.arrayDepth > 0 && this.depth === this.arrayDepth && this.elemStart >= 0) {
            const raw = s.slice(this.elemStart, this.pos + 1);
            this.elemStart = -1;
            try {
              this.onElement(JSON.parse(raw), raw);
            } catch {
              /* a malformed element is recovered by the final full parse */
            }
          } else if (c === "]" && this.arrayDepth > 0 && this.depth === this.arrayDepth - 1) {
            this.arrayDepth = -2; // closed; never reopen
            this.done = true;
          }
          break;
        case ",":
          if (this.depth === 1) this.currentKey = null;
          break;
      }
    }
  }

  private emitPrefix(keyPos: number) {
    const head = this.buf.slice(0, keyPos).replace(/,\s*$/, "");
    try {
      const obj = JSON.parse(head + "}") as Record<string, unknown>;
      this.prefix = obj;
      this.onPrefix?.(obj);
    } catch {
      this.prefix = {};
    }
  }
}
