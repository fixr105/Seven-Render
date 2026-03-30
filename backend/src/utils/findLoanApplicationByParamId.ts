/**
 * Resolve a loan application from a fetched list using the URL/param id.
 * Matches Airtable record id, File ID, or case-insensitive variants (same rules as GET single application).
 */
export function findLoanApplicationByParamId(applications: any[], id: string): any | undefined {
  if (id == null || String(id).trim() === '') return undefined;

  let application = applications.find((app) => app.id === id);
  if (!application) {
    application = applications.find(
      (app) => app['File ID'] === id || String(app['File ID']) === String(id)
    );
  }
  if (!application) {
    const idLower = String(id).toLowerCase();
    application = applications.find(
      (app) =>
        String(app.id).toLowerCase() === idLower ||
        String(app['File ID'] || '').toLowerCase() === idLower
    );
  }
  return application;
}
