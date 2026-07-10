/**
 * Resolve the business client id from a loan application API record.
 * Handles Airtable linked-record arrays and enriched client display objects.
 */
export function resolveApplicationClientId(app: Record<string, unknown>): string {
  const direct =
    app.clientId ?? app.client_id ?? app['Client ID'] ?? app.Client ?? app['Client'];
  if (Array.isArray(direct)) {
    const first = direct.find((value) => value != null && String(value).trim() !== '');
    if (first != null) return String(first).trim();
  } else if (direct != null && typeof direct !== 'object') {
    const asString = String(direct).trim();
    if (asString && asString !== '[object Object]') return asString;
  }

  const client = app.client;
  if (client != null && typeof client === 'object' && !Array.isArray(client)) {
    const obj = client as Record<string, unknown>;
    for (const key of ['id', 'clientId', 'Client ID', 'Client']) {
      const value = obj[key];
      if (value != null && String(value).trim() !== '') {
        return String(value).trim();
      }
    }
  }

  return '';
}
