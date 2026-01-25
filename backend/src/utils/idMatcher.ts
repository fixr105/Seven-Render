/**
 * ID Matcher Utility
 * 
 * Provides consistent ID matching logic across the application.
 * Handles string/number conversion, case-insensitive matching, and array comparisons.
 */

/**
 * Match two IDs (handles string/number conversion and variations)
 * 
 * @param id1 - First ID (can be string, number, or array)
 * @param id2 - Second ID (can be string, number, or array)
 * @returns true if IDs match
 */
export function matchIds(id1: any, id2: any): boolean {
  if (!id1 || !id2) {
    return false;
  }

  // If either ID is an array (Airtable linked records), match against any element
  if (Array.isArray(id1)) {
    return id1.some((value) => matchIds(value, id2));
  }
  if (Array.isArray(id2)) {
    return id2.some((value) => matchIds(id1, value));
  }
  
  // Convert both to strings for comparison
  const str1 = String(id1).trim();
  const str2 = String(id2).trim();
  
  // Exact match
  if (str1 === str2) {
    return true;
  }
  
  // Case-insensitive match
  if (str1.toLowerCase() === str2.toLowerCase()) {
    return true;
  }

  return false;
}
