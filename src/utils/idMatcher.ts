/**
 * ID Matcher Utility (frontend mirror of backend/src/utils/idMatcher.ts)
 */

export function matchIds(id1: unknown, id2: unknown): boolean {
  if (!id1 || !id2) {
    return false;
  }

  if (Array.isArray(id1)) {
    return id1.some((value) => matchIds(value, id2));
  }
  if (Array.isArray(id2)) {
    return id2.some((value) => matchIds(id1, value));
  }

  const str1 = String(id1).trim();
  const str2 = String(id2).trim();

  if (str1 === str2) {
    return true;
  }

  if (str1.toLowerCase() === str2.toLowerCase()) {
    return true;
  }

  return false;
}
