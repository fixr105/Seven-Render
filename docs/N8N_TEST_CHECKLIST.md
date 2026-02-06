# n8n Verification Checklist

Use this checklist after changing n8n workflows or backend webhook config. See [N8N_STACK_AUDIT.md](N8N_STACK_AUDIT.md) for full audit details.

---

## 1. Notification POST

**Purpose:** Ensure in-app notifications are stored in Airtable and visible in the app.

| Step | Action | Expected result |
|------|--------|------------------|
| 1 | Trigger an action that creates a notification (e.g. query raised, status change, or test endpoint). | Backend calls `POST /webhook/notification` with 15 fields. |
| 2 | In Airtable, open the **Notifications** table. | A new row appears with Notification ID, Recipient, Title, Message, etc. |
| 3 | In the app, open the notifications list (bell/dropdown or Notifications page). | The new notification appears in the list. |

- [x] Notification POST verified  
**Verified on:** 2026-02-03  
**Verified by:** Team

---

## 2. Email webhook

**Purpose:** Ensure NBFC-assign and daily-summary emails are sent via n8n.

| Step | Action | Expected result |
|------|--------|------------------|
| 1 | **Assign to NBFC:** As Credit, assign an application to an NBFC user (with email). | Backend calls `POST /webhook/email`. Email received at NBFC address. |
| 2 | **Daily summary:** As Credit, go to Reports, enter email(s) in "Email to", click "Generate Today's Report". | Backend calls `POST /webhook/email`. Email received with report content. |

- [x] Assign-to-NBFC email verified  
**Verified on:** 2026-02-03  
**Verified by:** Team  

- [x] Daily summary email verified  
**Verified on:** 2026-02-03  
**Verified by:** Team

---

## 3. Commission Ledger path

**Purpose:** Backend uses path `commisionledger` (one "m"). n8n must use the same path.

| Step | Action | Expected result |
|------|--------|------------------|
| 1 | In the app, open Ledger (Client) or any view that loads commission ledger data. | `GET /webhook/commisionledger` returns data; ledger loads. |
| 2 | Trigger an action that creates a commission ledger entry (e.g. payout, commission event). | `POST /webhook/COMISSIONLEDGER` succeeds; new row in Airtable Commission Ledger table. |

- [x] Commission Ledger GET verified  
**Verified on:** 2026-02-03  
**Verified by:** Team  

- [x] Commission Ledger POST verified  
**Verified on:** 2026-02-03  
**Verified by:** Team

---

## Notes

- Do not rename n8n webhook paths to "commission" (two m's) without updating the backend (`n8nEndpoints.ts`, `webhookConfig.ts`).
- If notification POST was fixed in n8n, run section 1 first to confirm in-app notifications work end-to-end.
