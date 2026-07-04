# Frontend POST Handler Map

Maps backend POST routes to `apiService` methods and UI usage. Updated as part of the POST handler alignment work.

| Backend POST | apiService method | Used in UI | Status |
|---|---|---|---|
| **Auth** | | | |
| `POST /auth/login` | `login` | LoginPage | OK |
| `POST /auth/logout` | `logout` | AuthContext | OK |
| `POST /auth/forgot-password` | `forgotPassword` | ForgotPassword | OK |
| `POST /auth/reset-password` | `resetPassword` | ResetPassword | OK |
| `POST /auth/validate` | — | — | Out of scope |
| `POST /auth/refresh` | — | — | Out of scope |
| **Client** | | | |
| `POST /client/link-pool/consume` | `consumeClientLink` | NewApplication | OK |
| **Loan applications (client)** | | | |
| `POST /loan-applications` | `createApplication`, `validateApplicationSubmission` | NewApplication | Fixed (no n8n bypass) |
| `POST /loan-applications/:id/form` | `updateApplicationForm` | NewApplication (draft resume) | Fixed |
| `POST /loan-applications/:id/submit` | `submitApplication` | NewApplication (draft resume) | Fixed |
| `POST /loan-applications/:id/withdraw` | `withdrawApplication` | ApplicationDetail | Fixed |
| `POST /loan-applications/:id/queries` | `createClientQuery` | ApplicationDetail | Fixed |
| `POST /loan-applications/:id/queries/:queryId/reply` | `replyToQuery` | ApplicationDetail | OK |
| `POST /loan-applications/:id/queries/:queryId/resolve` | `resolveQuery` | ApplicationDetail | OK |
| **KAM** | | | |
| `POST /kam/clients` | `createClient` | Clients | OK |
| `POST /kam/clients/:id/form-mappings` | `createFormMapping` | — | Deprecated |
| `POST /kam/loan-applications/:id/edit` | `editApplication` | — (form edits only) | OK |
| `POST /kam/loan-applications/:id/status` | `updateKAMApplicationStatus` | ApplicationDetail | Fixed |
| `POST /kam/loan-applications/:id/queries` | `raiseQueryToClient` | ApplicationDetail, Applications | OK |
| `POST /kam/loan-applications/:id/forward-to-credit` | `forwardToCredit` | ApplicationDetail | Fixed |
| **Credit** | | | |
| `POST /credit/loan-applications/:id/queries` | `raiseQueryToKAM` | ApplicationDetail, Applications | OK |
| `POST /credit/loan-applications/:id/status` | `updateCreditApplicationStatus` | ApplicationDetail (generic status) | Fixed |
| `POST /credit/loan-applications/:id/mark-in-negotiation` | `markInNegotiation` | ApplicationDetail (via status router) | Fixed |
| `POST /credit/loan-applications/:id/assign-nbfcs` | `assignNBFCs` | ApplicationDetail | OK |
| `POST /credit/loan-applications/:id/nbfc-decision` | `captureNBFCDecision` | ApplicationDetail | Fixed |
| `POST /credit/loan-applications/:id/mark-disbursed` | `markDisbursed` | ApplicationDetail (via status router) | Fixed |
| `POST /credit/loan-applications/:id/close` | `closeApplication` | ApplicationDetail (via status router) | Fixed |
| `POST /credit/payout-requests/:id/approve` | `approvePayout` | Ledger | OK |
| `POST /credit/payout-requests/:id/reject` | `rejectPayout` | Ledger | OK |
| `POST /credit/ledger/entries` | `createCreditLedgerEntry` | Ledger | Fixed |
| `POST /credit/ledger/:id/flag-dispute` | `flagCreditLedgerDispute` | Ledger | Fixed |
| `POST /credit/ledger/:id/resolve-dispute` | `resolveCreditLedgerDispute` | Ledger | Fixed |
| `POST /credit/clients/:id/assign-kam` | `assignKAMToClient` | Clients | OK |
| `POST /credit/clients/:id/form-links` | `createFormLink` | — | Deprecated |
| `POST /credit/record-titles` | `createRecordTitle` | — | Deprecated |
| `POST /credit/product-documents` | `createProductDocument` | FormConfiguration | OK |
| **NBFC** | | | |
| `POST /nbfc/loan-applications/:id/decision` | `recordNBFCDecision` | ApplicationDetail | OK |
| `POST /nbfc/loan-applications/:id/mark-disbursed` | `markDisbursedNBFC` | ApplicationDetail (via status router) | Fixed |
| `POST /nbfc/loan-applications/:id/queries` | `raiseNBFCQuery` | NBFCTools | OK |
| `POST /nbfc/tools/raad` | `submitRAADJob` | NBFCTools | OK |
| `POST /nbfc/tools/pager` | `submitPAGERJob` | NBFCTools | OK |
| `POST /nbfc/tools/query-drafter` | `submitQueryDrafter` | NBFCTools | OK |
| `POST /nbfc/tools/raad/request-data` | `listRAADIds`, `requestRAADData` | NBFCTools | OK |
| **Ledger (client)** | | | |
| `POST /clients/me/ledger/:id/query` | `createLedgerQuery` | Ledger | OK |
| `POST /clients/me/ledger/:id/flag-payout` | `flagLedgerPayout` | Ledger | OK |
| `POST /clients/me/payout-requests` | `createPayoutRequest` | Ledger | OK |
| **Reports / AI / Notifications** | | | |
| `POST /reports/daily/generate` | `generateDailySummary` | Reports | OK |
| `POST /loan-applications/:id/generate-summary` | `generateAISummary` | ApplicationDetail | OK |
| `POST /notifications/:id/read` | `markNotificationAsRead` | useNotifications | OK |
| `POST /notifications/mark-all-read` | `markAllNotificationsAsRead` | useNotifications | OK |
| **Admin / users** | | | |
| `POST /user-accounts` | `createUserAccount` | AdminUserAccounts | OK |
| `POST /nbfc-partners` | `createNBFCPartner` | AdminNBFCPartners | OK |
| `POST /credit-team-users` | `createCreditTeamUser` | AdminUserAccounts | Fixed |
| **Deprecated** | | | |
| `POST /form-categories` | `createFormCategory` | — | Deprecated |
| **Alternate query routes (unused)** | | | |
| `POST /queries/:parentId/replies` | — | — | Use loan-applications reply |
| `POST /queries/:id/resolve` | — | — | Use loan-applications resolve |
| `POST /queries/:id/reopen` | — | — | Out of scope |

## Status mutation routing

Credit/admin status changes use [`src/lib/applicationStatusMutations.ts`](../src/lib/applicationStatusMutations.ts):

- `in_negotiation` → `markInNegotiation`
- `disbursed` → `markDisbursed` (requires amount + date)
- `closed` → `closeApplication`
- Other → `updateCreditApplicationStatus`

KAM uses `updateKAMApplicationStatus`. NBFC disbursement uses `markDisbursedNBFC`.
