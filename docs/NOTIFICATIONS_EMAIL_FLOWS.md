# Notification and Email Flows

This document describes how query, NBFC-assign, and daily-summary notifications and emails are sent.

---

## Query created (KAM→Client, Credit→KAM, Credit→Client, etc.)

When a query is raised (e.g. from KAM to Client, Credit to KAM, or Credit to Client):

1. **Backend** creates a File Auditing Log entry (query) and calls `notificationService.notifyQueryCreated()`.
2. **In-app notification:** The notification is posted to Airtable (Notifications table) via n8n.
3. **Email:** The backend sends the email via **SendGrid** (not n8n `/webhook/email`). `createNotification` with `channel: 'both'` calls `sendGridService.sendEmail()` to the resolved recipient.

**Recipient resolution:**

- **Target Client:** Email from Clients table (`Contact Email / Phone`).
- **Target KAM:** Email from KAM Users table (client’s Assigned KAM).
- **Target Credit team:** Email from first active Credit Team Users record.

Flow: **Raise query → File Auditing Log + notificationService.notifyQueryCreated → in-app (Airtable) + SendGrid email to target.**

---

## NBFC assigned (POST /api/credit/loan-applications/:id/assign-nbfcs)

When Credit assigns NBFC(s) to an application:

1. Backend updates the Loan Application (Assigned NBFC, Status SENT_TO_NBFC) and records status change.
2. Backend resolves NBFC contact email(s) from the **NBFC Partners** table (field `Contact Email/Phone`), then calls **n8nClient.postEmail()** (POST `/webhook/email`) to send one email to all assigned NBFC addresses with:
   - Subject: "New application assigned – Seven Fincorp LMS"
   - Body: link to the application (`FRONTEND_URL/applications/:id`) and application ID.

Implementation: `backend/src/controllers/credit.controller.ts` (`assignNBFCs`). The n8n workflow for `/webhook/email` must be configured to deliver the email (e.g. Outlook/SMTP).

---

## Daily summary report (POST /api/reports/daily/generate)

When the daily summary report is generated:

1. Backend generates the report (DailySummaryService) and saves it (e.g. Daily Summary Reports table).
2. If `emailRecipients` is provided in the request body, the backend calls **n8nClient.postEmail()** (POST `/webhook/email`) with the formatted HTML report.
3. The n8n workflow for `/webhook/email` must be configured to send the email (e.g. Outlook/SMTP node) to the provided recipients.

**Frontend:** The Reports page (`src/pages/Reports.tsx`) includes an optional "Email to" field (comma-separated). When Credit generates the report, if one or more emails are entered, they are passed as `emailRecipients` so the report is emailed via n8n `/webhook/email`. The n8n workflow for `/webhook/email` must be configured to send the email (e.g. Outlook/SMTP node).
