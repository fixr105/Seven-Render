const STRIP_SUBSTRINGS = [
  'score',
  'result_json',
  'bureau_ref',
  'cibil_score',
  'is_ntc',
  'kill_code',
] as const;

function shouldStripKey(key: string): boolean {
  const lower = key.toLowerCase();
  return STRIP_SUBSTRINGS.some((s) => lower.includes(s.toLowerCase()));
}

/**
 * Drop bureau/score keys at any nesting depth before sending form_data as
 * sevenfin-dla-event payload. PAN and phone are kept.
 */
export function stripSensitiveFormData(
  obj: Record<string, unknown>
): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (shouldStripKey(k)) continue;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      clean[k] = stripSensitiveFormData(v as Record<string, unknown>);
    } else if (Array.isArray(v)) {
      clean[k] = v.map((item) =>
        item && typeof item === 'object' && !Array.isArray(item)
          ? stripSensitiveFormData(item as Record<string, unknown>)
          : item
      );
    } else {
      clean[k] = v;
    }
  }
  return clean;
}
