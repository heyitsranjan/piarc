/**
 * Simple fuzzy matcher: every character of `query` must appear in `text` in order.
 * Case-insensitive; ignores extra characters in between.
 */
export function fuzzyMatch(text: string, query: string): boolean {
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

/** Convenience matcher that checks any of the provided fields. */
export function fuzzyMatchAny(query: string, ...texts: string[]): boolean {
  return texts.some((text) => fuzzyMatch(text, query));
}
