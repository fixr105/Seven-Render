/**
 * Shallow-merge form_data patches while preserving keys not present in the patch.
 */
export function mergeFormDataPatch(
  existing: Record<string, unknown>,
  patch: Record<string, unknown>
): Record<string, unknown> {
  return { ...existing, ...patch };
}

export function parseFormDataField(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}
