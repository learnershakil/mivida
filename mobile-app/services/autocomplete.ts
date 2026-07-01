/** Pure helpers for the live-filter (autocomplete) pickers. Unit-tested in autocomplete.test.ts. */

export interface Suggestion {
  id?: string;
  label: string;
}

/** Case-insensitive substring filter. Empty query returns the full list. */
export function filterSuggestions(all: Suggestion[], query: string): Suggestion[] {
  const q = query.trim().toLowerCase();
  if (!q) return all;
  return all.filter((s) => s.label.toLowerCase().includes(q));
}

/** True when some suggestion label equals the query exactly (case-insensitive). */
export function hasExactMatch(all: Suggestion[], query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  return all.some((s) => s.label.toLowerCase() === q);
}
