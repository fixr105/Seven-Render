/**
 * Applications → Clients → KAMs Mapping
 *
 * Uses the same GET data sources as the API to build:
 *   Application (File ID) → Client (name/id) → KAM (name/id)
 *
 * Data flow (matches API):
 * - GET /webhook/loanapplication  → Loan Applications (each has Client = client id)
 * - GET /webhook/client          → Clients (each has Assigned KAM = KAM id)
 * - GET /webhook/kamusers        → KAM Users (id/name)
 *
 * Equivalent API endpoints (when called as credit_team):
 * - GET /credit/loan-applications  → applications with client id
 * - GET /credit/clients             → clients with assignedKAM, assignedKAMName
 * - GET /kam-users                  → KAM list
 *
 * Usage:
 *   cd backend && npx tsx scripts/applications-clients-kam-mapping.ts
 *
 * Optional: APPLICATIONS_KAM_OUTPUT=json for JSON output
 */

import { n8nClient } from '../src/services/airtable/n8nClient.js';
import { buildKAMNameMap, resolveKAMName } from '../src/utils/kamNameResolver.js';
import { matchIds } from '../src/utils/idMatcher.js';

interface ClientInfo {
  clientId: string;
  clientName: string;
  assignedKAM: string;
  assignedKAMName: string;
}

interface Row {
  fileId: string;
  applicationId: string;
  applicantName: string;
  status: string;
  clientId: string;
  clientName: string;
  kamId: string;
  kamName: string;
}

function getClientId(c: any): string {
  return String(c?.id ?? c?.['Client ID'] ?? '').trim();
}

function getAppClientId(app: any): string {
  const raw = app?.Client ?? app?.client;
  if (Array.isArray(raw)) return raw[0] ? String(raw[0]).trim() : '';
  return raw ? String(raw).trim() : '';
}

async function main(): Promise<void> {
  console.log('Fetching Loan Applications, Clients, and KAM Users (same as GET /credit/loan-applications, GET /credit/clients, GET /kam-users)...\n');

  const [applications, clients, kamUsers] = await Promise.all([
    n8nClient.fetchTable('Loan Application', false),
    n8nClient.fetchTable('Clients', false),
    n8nClient.fetchTable('KAM Users', false),
  ]);

  const kamNameMap = buildKAMNameMap(kamUsers as any[]);

  const clientByKey = new Map<string, ClientInfo>();
  for (const c of clients as any[]) {
    const clientId = getClientId(c);
    const altId = c?.id ?? c?.['Client ID'];
    const ids = [clientId, altId, c?.id, c?.['Client ID']].filter(Boolean).map((x) => String(x).trim());
    if (!clientId && ids.length === 0) continue;
    const assignedKAM = (c['Assigned KAM'] ?? c.assignedKAM ?? '').toString().trim();
    const assignedKAMName = resolveKAMName(assignedKAM || undefined, kamNameMap)
      || (c['Assigned KAM Name'] ?? c.assignedKAMName ?? '');
    const info: ClientInfo = {
      clientId: clientId || ids[0]!,
      clientName: (c['Client Name'] ?? c.clientName ?? 'Unknown').toString().trim(),
      assignedKAM,
      assignedKAMName: assignedKAMName || assignedKAM || '—',
    };
    for (const id of new Set(ids)) {
      if (id) clientByKey.set(id, info);
    }
  }

  // Also allow lookup by matching any client id that matchIds with app.Client
  const allClientIds = Array.from(clientByKey.keys());

  const rows: Row[] = [];
  for (const app of applications as any[]) {
    const appClientRaw = getAppClientId(app);
    const fileId = (app['File ID'] ?? app.fileId ?? '').toString().trim();
    const applicationId = (app.id ?? app['Record ID'] ?? '').toString().trim();
    const applicantName = (app['Applicant Name'] ?? app.applicantName ?? '—').toString().trim();
    const status = (app.Status ?? app.status ?? '—').toString().trim();

    let clientInfo: ClientInfo | undefined = clientByKey.get(appClientRaw);
    if (!clientInfo) {
      const matchedId = allClientIds.find((id) => matchIds(id, appClientRaw));
      if (matchedId) clientInfo = clientByKey.get(matchedId);
    }
    if (!clientInfo) {
      clientInfo = {
        clientId: appClientRaw,
        clientName: '—',
        assignedKAM: '',
        assignedKAMName: '—',
      };
    }

    rows.push({
      fileId: fileId || '—',
      applicationId: applicationId || '—',
      applicantName,
      status,
      clientId: clientInfo.clientId || appClientRaw || '—',
      clientName: clientInfo.clientName,
      kamId: clientInfo.assignedKAM || '—',
      kamName: clientInfo.assignedKAMName,
    });
  }

  if (process.env.APPLICATIONS_KAM_OUTPUT === 'json') {
    console.log(JSON.stringify({ applications: rows, count: rows.length }, null, 2));
    return;
  }

  console.log('Applications → Clients → KAMs\n');
  console.log('Summary:');
  console.log('  Applications:', rows.length);
  console.log('  Unique clients:', new Set(rows.map((r) => r.clientId)).size);
  console.log('  Unique KAMs:', new Set(rows.filter((r) => r.kamId && r.kamId !== '—').map((r) => r.kamId)).size);
  console.log('');

  const col = (s: string, w: number) => s.padEnd(w).slice(0, w);
  const wFile = 18;
  const wApp = 12;
  const wApplicant = 22;
  const wStatus = 20;
  const wClientId = 28;
  const wClientName = 24;
  const wKamId = 14;
  const wKamName = 18;

  console.log(
    col('File ID', wFile) +
      col('Application ID', wApp) +
      col('Applicant', wApplicant) +
      col('Status', wStatus) +
      col('Client ID', wClientId) +
      col('Client Name', wClientName) +
      col('KAM ID', wKamId) +
      col('KAM Name', wKamName)
  );
  console.log('-'.repeat(wFile + wApp + wApplicant + wStatus + wClientId + wClientName + wKamId + wKamName));

  for (const r of rows) {
    console.log(
      col(r.fileId, wFile) +
        col(r.applicationId, wApp) +
        col(r.applicantName, wApplicant) +
        col(r.status, wStatus) +
        col(r.clientId, wClientId) +
        col(r.clientName, wClientName) +
        col(r.kamId, wKamId) +
        col(r.kamName, wKamName)
    );
  }

  console.log('\nEnd of mapping.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
