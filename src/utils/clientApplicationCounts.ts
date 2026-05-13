type ClientCountSource = {
  applicationsCount?: unknown;
  _count?: {
    applications?: unknown;
  };
};

function toNonNegativeNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return numeric;
}

export function resolveClientApplicationCount({
  client,
  fallbackCount,
}: {
  client: ClientCountSource;
  fallbackCount: number;
}): number {
  const directCount = toNonNegativeNumber(client.applicationsCount);
  if (directCount !== null) return directCount;

  const nestedCount = toNonNegativeNumber(client._count?.applications);
  if (nestedCount !== null) return nestedCount;

  return fallbackCount;
}
