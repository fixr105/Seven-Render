# Seven Fincorp Loan Management & Credit Dashboard – Product Requirements Document (PRD)  
**Revised – As Implemented**

---

## 1. Introduction & Objectives

Seven Fincorp is a fintech platform that helps customers obtain financing (home loans, loans against property, business loans, etc.) through a network of partner banks and NBFCs. To streamline operations with our Direct Selling Agent (DSA) partners and internal teams, we have built a multi-tenant Loan Management & Credit Workflow Dashboard. This web application orchestrates the end-to-end processing of loan applications – from initial file creation by a DSA (client) through KAM review, credit approval, and finally to lender (NBFC) decision and payout.

**Objective:** A unified system for four user roles – Client (External DSA), Key Account Manager (KAM), Credit Team (Central Underwriting/Admin), and NBFC Partner – each with a role-specific dashboard. The system improves transparency, reduces manual communication (via an in-app query dialog and status tracking), and supports dynamic configuration per client and per loan product. It increases the throughput of loan files while maintaining accuracy and compliance as the business scales.

Key goals include: centralising document collection, enabling configurable loan application forms per product/client, providing real-time status updates to all parties, and tracking financial payouts between Seven Fincorp and DSAs. Non-functional goals (security, auditability, scalability) ensure the platform can be trusted with sensitive data and grow with our user base. The implemented system uses a React frontend, an Express/TypeScript backend, Airtable as the data store accessed via n8n webhooks, JWT-based authentication, OneDrive for document storage, and SendGrid for query-related emails.

---

## 2. Scope

This PRD describes the internal workflow and data management for loan processing as implemented. The application manages multiple loan products (e.g. home loans, LAP, SME loans, vehicle finance) and supports multiple concurrent files from various clients. It covers:

- **Client onboarding and dashboard configuration:** KAM sets up each new DSA with appropriate modules and forms; modules (e.g. Pay In/Out Ledger) can be enabled or disabled per client so that the client’s sidebar and features reflect only what is relevant to them.
- **Loan application submission:** DSA clients fill dynamic forms (configured per client and optionally per loan product) and upload documents for each loan file; clients see only loan products assigned to them when starting a new application.
- **Review and approval workflow:** KAM initial review and query resolution, Credit Team final review and NBFC allocation, NBFC decision logging (Approve / Reject / Needs Clarification) with predefined rejection reasons and mandatory remarks where applicable.
- **Status tracking and notifications:** Visible status updates for each file with role-adapted labels (e.g. clients see “Action required” when a query is pending), a status timeline per file, and automated in-app notifications; query creation triggers email via SendGrid.
- **Financial ledger for commissions:** Tracking payables/receivables between Seven Fincorp and the DSA, with query and payout request functionality; commission is calculated as a percentage of disbursed amount (stored per client); ratio notation (e.g. 1:99) is not used in the system.
- **Audit trail and reporting:** Full log of actions and communications on each file (File Auditing Log and Admin Activity Log), daily summary reports (generatable for a given date, with optional email delivery via n8n), and AI-generated file summaries for internal review.

**In-scope integrations (as implemented):** Email notifications for queries are sent via SendGrid from the backend; assignment of files to NBFCs triggers an email to the NBFC(s) via an n8n email webhook (with application link); daily reports can be emailed to configurable recipients via n8n. Document storage is via OneDrive; links are stored on the loan application. There are no direct API integrations with external lender systems or payment gateways – interaction with NBFCs is via the partner portal or manual entry by Credit. The system does not disburse loans or perform fund transfers; it records transactions for reference.

(Detailed UI design and technology choices are not fully specified in this document; the PRD outlines usability and security at a high level. Future capabilities such as borrower self-service or direct bank integrations are out of scope for the current release.)

---

## 3. User Roles & Dashboards

The system supports four types of users, each with a dedicated dashboard and permissions:

- **Client (DSA Partner):** An external agent or company that submits loan applications on behalf of end customers. Each client’s dashboard is customised by their KAM: only enabled modules (e.g. Ledger, Applications, Reports) are shown. Clients can create and manage loan files (drafts and submissions), view application statuses (with simplified labels such as “Action required” when they must respond), respond to queries, and – when the Ledger module is enabled – monitor their commission ledger and request payouts.
- **Key Account Manager (KAM):** An internal relationship manager responsible for onboarding DSAs and ensuring loan files are complete. KAMs have a dashboard showing the clients they manage and their files. They configure each client’s form requirements (and optionally different forms per loan product), review incoming submissions, edit or correct data as needed (with changes recorded in the audit log), and communicate with clients via the query dialog. Once satisfied, KAMs forward applications to the Credit Team; after forward, the client cannot edit the form.
- **Credit Team (Admin/Underwriter):** Internal credit analysts who receive KAM-forwarded files. They have a global view of all loan files. The credit team performs final due diligence, raises queries to KAMs (and optionally to clients where supported), allocates files to one or more NBFCs, updates statuses (e.g. “In Negotiation”, “Sent to NBFC”), and records outcomes (approved/rejected/disbursed/closed). They also manage the payout ledger (approve or reject client payout requests, including partial approval with a note) and can create manual ledger entries. Credit can administratively close any non-closed file. They have access to daily summary reports and an SLA follow-up view for files sent to NBFC that are past due.
- **NBFC (Lender Partner):** External users from banks/NBFCs who receive assigned loan applications. They see only files assigned to their institution. They can review applications and documents, and record a decision: **Approved** (with approved amount and conditions), **Rejected** (with a mandatory reason, chosen from a predefined list or “Other” with custom remarks), or **Needs Clarification** (query back to Credit). NBFC users do not see the commission ledger or other internal modules.

**Role-based data separation:** A strict RBAC model ensures each user sees only relevant data: clients see only their own files and ledger; KAMs see only their clients’ data; Credit sees all files and ledgers; NBFCs see only applications assigned to them. Each role’s dashboard exposes only the modules and actions allowed for that role.

---

### 3.1 Client (DSA) Dashboard – Features & Actions

- **New application submission:** Choose from assigned loan products and fill the dynamic form (fields defined by KAM for that client/product), and upload required documents.
- **Draft save and edit:** Save progress as a draft and edit or upload documents until final submission.
- **View file status:** See the current status of each file; where the client must act (e.g. query from KAM or Credit), the status is shown as “Action required” for clarity.
- **Respond to queries:** Receive and reply to queries from KAM or Credit in the file’s audit/query section; optional in-app and email (SendGrid) notification on new queries.
- **Financial ledger and payouts (if module enabled):** View the Pay In/Out Ledger with commission entries (date, file, disbursed amount, commission rate, payout or pay-in amount), running balance, raise a query on any entry, and request payout (full or partial); receive notifications when a payout request is approved or rejected.
- **Notifications:** In-app alerts for important events (e.g. query raised, file approved, payout processed).

---

### 3.2 KAM Dashboard – Features & Actions

- **Client onboarding and configuration:** Create new client accounts and set their enabled modules (e.g. Ledger on/off) and, via the Master Form Builder (M2), configure which fields and documents are required per client and optionally per loan product.
- **Manage loan applications:** View all loan files from managed clients with filters (client, status, date, etc.); open any file for details and documents.
- **Review and edit files:** Edit application form data when needed (e.g. corrections after client call); edits are recorded in the File Auditing Log.
- **Raise queries to client:** Raise queries in the file’s audit log; the client sees them in-dashboard and by email (SendGrid); file status reflects awaiting client response; when the client responds, KAM can resolve and continue or forward to Credit.
- **Approve and forward to Credit:** When the application is complete, forward to Credit; the file is then locked for client edits and status moves to the credit review stage; KAM can also mark files as rejected or closed where appropriate.
- **Dashboard customisation:** Update client module settings or form fields over time (e.g. when the client starts a new product).

---

### 3.3 Credit Team Dashboard – Features & Actions

- **Global file view:** See all files forwarded by KAMs (e.g. “Pending Credit Review”) with filters; open any file to work on it.
- **Review application and documents:** View full form, documents, and the AI-generated File Summary (M7) for quick context; verify against policy.
- **Credit queries:** Raise queries to KAM (and, where applicable, to client) via the audit log; file status can move to “Credit Query with KAM” until resolved; KAM responds in the thread and can re-forward when ready.
- **Update status (In Negotiation):** Mark the file as “In Negotiation” when it is being prepared for lender engagement; this and “Sent to NBFC” may be shown to client/KAM in a simplified way (e.g. “In Process with Lender”).
- **Allocate to NBFC(s):** Assign one or more NBFC partners; status becomes “Sent to NBFC”; the system sends an email to each assigned NBFC (via n8n) with a link to the application.
- **Capture lender decisions:** Record NBFC decisions (from the portal or offline); if the NBFC approves, enter approved amount and conditions; if rejected, record reason (predefined or “Other”); if “Needs Clarification”, the query appears in the audit log for Credit to address.
- **Final approval and disbursement:** Mark file as Approved when the borrower accepts an offer; after disbursement (handled offline), mark as Disbursed – at which point a commission ledger entry is created automatically using the client’s commission rate (percentage). Then close the file. Rejected or withdrawn files are closed with an appropriate status.
- **Payout management:** Review client payout requests; approve full or partial amount (with note) or reject (with reason); approval posts a ledger entry and reduces the client’s balance; the client is notified.
- **Oversight and reporting:** Generate and view daily summary reports (by date); optionally email reports to configured recipients via n8n; use the “Past SLA” view (files sent to NBFC beyond the defined SLA) for follow-up.

---

### 3.4 NBFC Partner Portal – Features & Actions

- **Assigned application view:** See only applications forwarded to their institution, with basic details (client, loan type, amount, date sent).
- **Review and download:** Open the application and download documents for offline underwriting.
- **Post decision:** Record decision as **Approved** (with approved amount and conditions), **Rejected** (mandatory reason: predefined list or “Other” with remarks), or **Needs Clarification** (message to Credit). Rejection cannot be submitted without a reason.
- **Limited scope:** No access to commission ledger or other internal modules; no payout or financial actions. Decisions can also be communicated offline, with Credit updating the system.

---

## 4. Functional Requirements (Modules M1–M7)

The system is composed of seven modules that can be enabled or disabled per client (where applicable). Below is the behaviour as implemented.

---

### 4.1 Modular Dashboard Configuration

When onboarding a client, the KAM selects which modules to activate (e.g. M1 Pay In/Out Ledger, M2 form-based application, M3 status tracking, M4 audit/queries, M5 action center, M6 reports, M7 AI summary). The client’s sidebar and feature set reflect only enabled modules (e.g. if M1 is disabled, the Ledger is hidden). An ID generator (or equivalent) ensures unique identifiers for clients, users, files, and ledger entries.

**List of modules:**  
M1 Pay In/Out Ledger, M2 Master Form Builder, M3 File Status Tracking, M4 Audit Log & Query Dialog, M5 Action Center, M6 Daily Summary Reports, M7 File Summary Insights (AI-generated).

---

### M1: Pay In/Out Ledger

The module tracks commission between Seven Fincorp and the DSA client.

- Each ledger entry includes: date, file/loan ID, disbursed amount, **commission rate (as a percentage, configured per client)**, and the resulting payout or pay-in amount. The system uses a percentage only (e.g. 1% commission); ratio notation (e.g. 1:99 or -1:101) is not supported. Calculation: `(disbursedAmount × commissionRate) / 100`.
- Payout (positive) vs pay-in (negative): positive entries represent money owed to the DSA; negative entries represent money owed to the platform (e.g. fees).
- **Running balance** is maintained per client.
- **Raise query on ledger entry:** The client (and KAM, where visible) can raise a query on any entry; the query is recorded in the audit log and can be resolved by the responsible team with a full audit trail.
- **Payout requests:** The client may request payout (full or up to available balance). Credit sees the request, can approve (full or partial, with note) or reject (with reason), and the ledger is updated; the client is notified. Actual payment is done offline; the system only records the approval and balance change.
- **Security:** Only Credit can approve/reject payouts and create or finalise ledger entries; KAMs can view their clients’ ledgers but do not modify entries unless given specific permissions.

---

### M2: Master Form Builder (Dynamic Application Form)

The master form is a template of all possible fields and document slots across loan types. The implementation supports the following.

- **Dynamic form configuration:** The KAM configures which categories and fields from the master template apply to each client and, when supported, **per loan product** (e.g. home loan vs business loan). When the client starts a new application, they select the product (from their **assigned loan products** only); the form loaded is the one configured for that client and product.
- **Client form filling:** Mandatory field validation (form cannot be submitted until required fields and documents are provided); basic input validation (numeric, date, PAN format where applicable); **draft save**; **document uploads** (multiple files per field where applicable), stored in OneDrive and linked to the file; **duplicate application check** (e.g. same PAN) with a warning on submit.
- **KAM review and editing:** After submission, the KAM can edit form data; all changes are logged in the File Auditing Log. The client cannot edit after submission unless the file is returned via a query flow; after the file is forwarded to Credit, neither client nor KAM may arbitrarily edit – changes follow the query/response process and are logged.
- **Form versioning:** On submission, the **Form Config Version** (or equivalent) is stored with the application so that the form snapshot used is preserved for audit.
- **Form locking:** Client can edit only until submission; after forward to Credit, client editing is locked; post–KAM-forward changes are through documented queries and resolutions.

---

### M3: File Status Tracking

Every loan file has a status enforced by a **state machine** with **role-based transition rules**. Implemented statuses include:

- **Draft** – Client has saved but not submitted (visible to client and KAM as needed).
- **Under KAM Review** – Submitted and awaiting KAM.
- **Query with Client** – KAM has raised a query; awaiting client response.
- **Pending Credit Review** – Forwarded to Credit.
- **Credit Query with KAM** – Credit has raised a query; awaiting KAM (and possibly client) response.
- **In Negotiation** – Credit is preparing for lender engagement.
- **Sent to NBFC** – Assigned to one or more NBFCs; awaiting lender decision.
- **Approved** – At least one NBFC has approved (sanction/offer).
- **Rejected** – Application rejected (by Credit or NBFC).
- **Disbursed** – Loan disbursed to borrower (commission entry created automatically).
- **Withdrawn** – Client withdrew the application.
- **Closed** – Terminal state (after disbursement and closure, or after rejection/withdrawal). Credit (and Admin) may **administratively close** any non-closed file.

**Status transitions and controls:** Only allowed transitions are permitted (e.g. Draft → Under KAM Review or Withdrawn; Under KAM Review → Query with Client or Pending Credit Review). Each transition is allowed only for the appropriate role (e.g. only KAM can forward to Credit; only Credit can assign to NBFC or mark Disbursed). Invalid transitions are rejected by the backend.

**Visibility of status:** All roles see the status of a file, but **terminology is adapted by role**. For the **client**, statuses that require their action (e.g. Query with Client, Credit Query Raised, KAM Query Raised) are shown as **“Action required”** so they know they need to respond. KAM and Credit see the detailed internal status labels. NBFCs see statuses relevant to their involvement (e.g. Sent to NBFC and their own decision outcome).

**Status history:** A **timeline** of status changes is maintained (from the File Auditing Log) with timestamp and actor, and is displayed in the UI for audit and clarity.

---

### M4: Audit Log & Query Dialog

The module provides an in-context communication thread per file and a log of key events.

- **Query thread:** KAM↔Client, Credit↔KAM, and NBFC↔Credit (Needs Clarification) queries are posted in the file’s audit log; responses and resolutions are in the same thread. **Role-based visibility** is enforced: clients see only their threads; NBFCs see only threads involving them; KAM and Credit see the threads relevant to their workflow.
- **Event logging:** Status changes, forwards, and data edits are automatically recorded in the File Auditing Log with clear labels and are read-only.
- **Query resolution:** The user who raised the query (or the responsible role) can mark it resolved; all messages remain in the log. **Edit own query:** Authors may **edit their own query message for a short period (e.g. 15 minutes)** after posting; **edit history** is recorded (e.g. as “query_edited” in the File Auditing Log) so the record remains tamper-evident. Entries are not deleted (except possibly by super-admin in extreme cases, with that action itself logged).
- **Notifications:** When a query or response is posted, the relevant party receives an **in-app notification** (stored in the Notifications table) and, for **query creation**, an **email sent by the backend via SendGrid** (not via n8n), so that queries are seen and addressed promptly.

---

### M5: Action Center (Role-Specific Actions)

Each dashboard includes an Action Center that surfaces the next or common tasks for that role.

- **Client:** “New Loan Application”, “View Drafts”, “Request Payout” (if Ledger enabled), and “Respond to Queries” (or similar) when there are pending queries; counts and labels (e.g. “Action required”) guide attention.
- **KAM:** “Onboard New Client”, “Configure Dashboard/Forms”, “Review New Files”, “Files Awaiting Client Response”, and within a file: “Forward to Credit”, “Raise Query” when applicable.
- **Credit:** “Files to Review”, “Payout Requests Pending”, **“Follow Up with NBFC (SLA)”** – a dedicated view/list of files sent to NBFC that have exceeded the defined SLA (e.g. past-due days), plus within a file: “Raise Query to KAM”, “Mark as In Negotiation”, “Allocate to NBFC”, “Record Outcome”, “Mark Disbursed”, “Close”.
- **NBFC:** “Review Application” and, within a file, “Approve”, “Reject”, “Request Clarification” with the appropriate forms (approved amount, mandatory rejection reason from predefined list or Other, clarification message).

The Action Center is **context-aware**: actions are shown or enabled only when valid (e.g. “Forward to Credit” only when the file is under KAM review and not yet forwarded), reducing errors and enforcing workflow rules.

---

### M6: Daily Summary Reports

The system generates **daily summary reports** based on actual system data (e.g. previous day or a specified date).

- **Content:** KAM activity summary (e.g. files reviewed, forwarded, queries raised) and Credit pipeline summary (e.g. new applications, sent to lenders, approved, disbursed, commission payouts, exceptions such as files past SLA or high rejection rates). Format is concise (bullets/short paragraphs), factual.
- **Generation:** Reports are generated on demand (e.g. by date); the report is stored (e.g. in the Daily Summary Reports table) and can be **emailed to configurable recipients** via the n8n email webhook when the caller supplies recipient addresses (e.g. from the Reports page).
- **In-app:** An admin/Reports section allows viewing and retrieving past reports (e.g. last seven reports or by date).
- **Timeliness:** The report reflects data for the chosen date; generation can be run daily (e.g. early morning for the previous day) or on demand.

---

### M7: File Summary Insights (AI-Generated)

When a loan file is submitted (or on demand), the system can **generate an AI-powered summary** to assist KAM and Credit reviewers.

- **Content:** Applicant profile, loan details, strengths and risks (and, where applicable, comparison to criteria) derived from the application data (and optionally document metadata). The summary is stored on the loan application (e.g. “AI File Summary” field) and can be refreshed from the file detail screen.
- **Usage:** Shown on the KAM and Credit file view as a quick-glance overview; it is **not visible to Client or NBFC**. A **disclaimer** (e.g. “AI-generated summary – please verify with actual documents”) is displayed so that reviewers treat it as an aid, not a substitute for due diligence.
- **Accuracy and limitations:** The summary is based on structured form data (and possibly document metadata); it does not replace verification of documents. The system may support multiple AI providers (e.g. OpenAI or n8n AI nodes) for generation.

---

## 5. Out of Scope & Future Enhancements

The following remain out of scope for the current release, consistent with the original PRD:

- **Direct integration with lender systems:** No API integrations to send/receive data from banks or NBFCs; all NBFC interaction is via the partner portal or manual entry.
- **End-borrower access:** No borrower login or portal; all borrower updates are relayed via the DSA.
- **Payment processing:** No bank/UPI integration; payouts to DSAs are processed offline; the system only records ledger and payout approval.
- **Credit bureau/KYC verification APIs:** KYC data and documents are stored but not auto-verified via bureau or government APIs in this version.
- **Advanced analytics dashboard:** Beyond daily summaries and SLA views, no complex BI or trend dashboards in this release.
- **Native mobile apps:** The product is a responsive web application; native iOS/Android apps are not in scope.
- **Custom workflow variations:** All clients follow the same workflow; no per-client branching or custom approval chains in this release.
- **Post-loan management and collections:** No repayment tracking, NPA monitoring, or collections in this system.

---

## 6. Technical Context (As Implemented)

The following summarises how the described behaviour is realised in the current system, for reference and future design:

- **Data layer:** Airtable is the primary data store; all access is via **n8n webhooks** (GET for read, POST for create/update). The backend does not call Airtable directly. GET responses can be cached (e.g. 30 minutes) for performance.
- **Backend:** Express/TypeScript API; JWT authentication; RBAC middleware; role-based filtering of data; status transitions validated by a central state machine.
- **Frontend:** React; role-based dashboards and sidebar (modules shown/hidden per client); protected routes and role guards.
- **Integrations:** OneDrive for document storage (links on application); SendGrid for query-created emails; n8n for NBFC-assign emails and daily report emails; OpenAI or n8n AI for M7 summaries.
- **Audit:** File Auditing Log and Admin Activity Log record actions; query edit within a short window with edit history; no deletion of audit entries in normal operation.

---

**End of Revised PRD**