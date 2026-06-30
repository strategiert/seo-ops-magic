// Runtime-agnostischer (V8 + Node) konstanter Zeit-Stringvergleich fuer Secrets.
// node:crypto.timingSafeEqual ist in Convex' Default-V8-Runtime nicht verfuegbar,
// daher pure JS. Laengen-Kurzschluss leakt nur die Laenge (fuer Shared-Secrets vernachlaessigbar).
export function constantTimeEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
