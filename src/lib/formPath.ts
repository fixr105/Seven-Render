export type FormPathHit = {
  present: boolean;
  value: unknown;
};

function walk(cursor: unknown, parts: string[]): FormPathHit {
  let current = cursor;
  for (const part of parts) {
    if (current == null || typeof current !== 'object' || Array.isArray(current)) {
      return { present: false, value: undefined };
    }
    const record = current as Record<string, unknown>;
    if (!Object.prototype.hasOwnProperty.call(record, part)) {
      return { present: false, value: undefined };
    }
    current = record[part];
  }
  return { present: true, value: current };
}

/** Key existence, including an empty string. Flat dotted keys and nested objects both count. */
export function readFormPath(formData: Record<string, unknown>, path: string): FormPathHit {
  if (Object.prototype.hasOwnProperty.call(formData, path)) {
    return { present: true, value: formData[path] };
  }

  const parts = path.split('.');
  for (let i = parts.length - 1; i > 0; i -= 1) {
    const parentKey = parts.slice(0, i).join('.');
    if (!Object.prototype.hasOwnProperty.call(formData, parentKey)) continue;
    const nested = walk(formData[parentKey], parts.slice(i));
    if (nested.present) return nested;
  }

  return walk(formData, parts);
}
