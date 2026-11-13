/** 1-based number of the paragraph containing `offset`, ignoring Markdown headings. */
export function paragraphAt(text: string, offset: number): number {
  let n = 0;
  const re = /\n\s*\n/g;
  let last = 0;
  let m: RegExpExecArray | null;
  const count = (chunk: string) => {
    const t = chunk.trim();
    if (t && !t.startsWith("#")) n++;
  };
  while ((m = re.exec(text))) {
    if (m.index >= offset) break;
    count(text.slice(last, m.index));
    last = m.index + m[0].length;
  }
  return n + 1;
}
