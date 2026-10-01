/**
 * Accent- and case-insensitive matching for the client search.
 *
 * MongoDB's `contains … insensitive` only folds case, so "Dania Pena" missed
 * "Dania Peña" and "Sofia" missed "Sofía" — the owner concluded the client did
 * not exist and tried to register her again. The client list is small (tens,
 * not thousands), so matching happens in memory over a lean projection instead
 * of maintaining a second, normalized copy of every name.
 */

/** "  Dania  PEÑA " → "dania pena". */
export function foldText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * True when every word of the term appears in the name (in any order), or when
 * the term carries 3+ digits found in the phone. "pena dania", "dan pe" and
 * "2708576" all find "Dania Peña · 6142708576".
 */
export function matchesClient(client: { name: string; phone: string }, term: string): boolean {
  const digits = term.replace(/\D/g, "");
  if (digits.length >= 3 && client.phone.includes(digits)) return true;

  const words = foldText(term).split(" ").filter(Boolean);
  if (words.length === 0) return false;
  const name = foldText(client.name);
  return words.every((word) => name.includes(word));
}
