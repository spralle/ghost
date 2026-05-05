/** Structural equality check using JSON serialization (v1 implementation) */
export function structuredEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  return JSON.stringify(a) === JSON.stringify(b);
}
