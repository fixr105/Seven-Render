/**
 * Map Engine/Airtable write failures to dealer-safe copy.
 * Never surface raw "perhaps check your credentials" text.
 */
export function formatEngineSetupError(err: unknown, tableName: string): string {
  const raw =
    err instanceof Error && err.message
      ? err.message
      : typeof err === 'string'
        ? err
        : '';
  if (/forbidden/i.test(raw)) {
    return `Setup problem: the ${tableName} table is missing or not writable. Contact support.`;
  }
  return raw || 'Something went wrong. Try again.';
}
