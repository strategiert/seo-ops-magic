/**
 * Seeded Random Selection
 * Ensures consistent fallback theme selection per article
 */

/**
 * Pick an item from array using a seeded hash
 * Same seed always returns same item
 */
export function seededPick<T>(seedStr: string, arr: T[]): T {
  if (arr.length === 0) {
    throw new Error("Cannot pick from empty array");
  }

  // FNV-1a hash algorithm
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }

  const idx = Math.abs(h) % arr.length;
  return arr[idx];
}

/**
 * Generate a stable ID from content
 */
export function stableId(content: string, prefix: string, index: number): string {
  // Simple hash for content-based ID
  let hash = 0;
  const str = content.slice(0, 100); // Use first 100 chars
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `${prefix}-${index}-${Math.abs(hash).toString(16).slice(0, 6)}`;
}
