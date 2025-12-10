# Quick Reference Guide - Seven Fincorp Backend API

**Last Updated:** 2025-01-27

---

## 🚀 Quick Start

### Base URL
```
http://localhost:3001/api
```

### Authentication
```bash
# Login
POST /api/auth/login
Body: { "email": "user@example.com", "password": "password" }

# Get current user
GET /api/auth/me
Headers: { "Authorization": "Bearer <token>" }
```

---

## 📋 Endpoint Quick Reference

### Client (DSA) Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/client/dashboard` | GET | Dashboard overview |
| `/client/form-config` | GET | Get form configuration |
| `/loan-applications` | POST | Create draft application |
| `/loan-applications/:id/form` | POST | Update form data |
| `/loan-applications/:id/submit` | POST | Submit application |
| `/loan-applications/:id/withdraw` | POST | Withdraw application |
| `/loan-applications/:id/queries/:queryId/reply` | POST | Reply to query |
| `/clients/me/ledger` | GET | View commission ledger |
| `/clients/me/ledger/:id` | GET | Get ledger entry detail |
| `/clients/me/ledger/:id/query` | POST | Raise ledger query |
| `/clients/me/payout-requests` | POST | Create payout request |
| `/clients/me/payout-requests` | GET | Get payout requests |

---

### KAM Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/kam/dashboard` | GET | KAM dashboard |
| `/kam/clients` | GET | List clients |
| `/kam/clients` | POST | Create client |
| `/kam/clients/:id` | GET | Get client details |
| `/kam/clients/:id/modules` | PATCH | Update client modules |
| `/kam/clients/:id/form-mappings` | GET | Get form mappings |
| `/kam/clients/:id/form-mappings` | POST | Create form mapping |
| `/kam/loan-applications` | GET | List applications |
| `/kam/loan-applications/:id/edit` | POST | Edit application |
| `/kam/loan-applications/:id/queries` | POST | Raise query to client |
| `/kam/loan-applications/:id/forward-to-credit` | POST | Forward to credit |
| `/kam/ledger?clientId=<id>` | GET | View client ledger |

---

### Credit Team Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/credit/dashboard` | GET | Credit dashboard |
| `/credit/loan-applications` | GET | List all applications |
| `/credit/loan-applications/:id` | GET | Get application details |
| `/credit/loan-applications/:id/queries` | POST | Raise query to KAM |
| `/credit/loan-applications/:id/mark-in-negotiation` | POST | Mark in negotiation |
| `/credit/loan-applications/:id/assign-nbfcs` | POST | Assign NBFCs |
| `/credit/loan-applications/:id/nbfc-decision` | POST | Capture NBFC decision |
| `/credit/loan-applications/:id/mark-disbursed` | POST | Mark disbursed |
| `/credit/loan-applications/:id/close` | POST | Close application |
| `/credit/payout-requests` | GET | Get payout requests |
| `/credit/payout-requests/:id/approve` | POST | Approve payout |
| `/credit/payout-requests/:id/reject` | POST | Reject payout |
| `/credit/ledger` | GET | View all ledger entries |

---

### NBFC Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/nbfc/dashboard` | GET | NBFC dashboard |
| `/nbfc/loan-applications` | GET | List assigned applications |
| `/nbfc/loan-applications/:id` | GET | Get application details |
| `/nbfc/loan-applications/:id/decision` | POST | Record decision |

---

### Audit & Reports

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/loan-applications/:id/audit-log` | GET | Get file audit log |
| `/admin/activity-log` | GET | Get admin activity log |
| `/reports/daily/generate` | POST | Generate daily summary |
| `/reports/daily/:date` | GET | Get daily summary |
| `/reports/daily/latest` | GET | Get latest summary |

---

### AI Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/loan-applications/:id/generate-summary` | POST | Generate AI summary |
| `/loan-applications/:id/summary` | GET | Get AI summary |

---

## 🔐 Role Permissions

| Action | CLIENT | KAM | CREDIT | NBFC |
|--------|--------|-----|--------|------|
| Create application | ✅ | ❌ | ❌ | ❌ |
| Edit own application | ✅ | ❌ | ❌ | ❌ |
| View own applications | ✅ | ❌ | ❌ | ❌ |
| View managed clients' apps | ❌ | ✅ | ❌ | ❌ |
| View all applications | ❌ | ❌ | ✅ | ❌ |
| View assigned applications | ❌ | ❌ | ❌ | ✅ |
| Create client | ❌ | ✅ | ✅ | ❌ |
| Assign NBFCs | ❌ | ❌ | ✅ | ❌ |
| Mark disbursed | ❌ | ❌ | ✅ | ❌ |
| Approve payout | ❌ | ❌ | ✅ | ❌ |
| Generate reports | ❌ | ❌ | ✅ | ❌ |

---

## 📊 Status Flow

```
DRAFT → UNDER_KAM_REVIEW → PENDING_CREDIT_REVIEW → SENT_TO_NBFC → APPROVED → DISBURSED → CLOSED
         ↑                    ↑
         └─ QUERY_WITH_CLIENT └─ CREDIT_QUERY_WITH_KAM
         ↑                    ↑
         └─ IN_NEGOTIATION
```

**Withdrawal:** Can withdraw from `DRAFT`, `UNDER_KAM_REVIEW`, `QUERY_WITH_CLIENT` → `WITHDRAWN`

---

## 🗂️ Airtable Table Mappings

| Entity | Airtable Table | Key Identifier |
|--------|---------------|-----------------|
| User Account | `User Accounts` | Username (email) |
| Client | `Clients` | Client ID |
| Loan Application | `Loan Applications` | File ID |
| Commission Ledger | `Commission Ledger` | Ledger Entry ID |
| Form Category | `Form Categories` | Category ID |
| Form Field | `Form Fields` | Field ID |
| Client Form Mapping | `Client Form Mapping` | Mapping ID |
| File Audit Log | `File Auditing Log` | Log Entry ID |
| Admin Activity Log | `Admin Activity log` | Activity ID |
| Daily Summary | `Daily summary Reports` | Report Date |
| NBFC Partner | `NBFC Partners` | Lender ID |
| Loan Product | `Loan Products` | Product ID |

---

## 🔄 Webhook Execution

**GET Webhooks:**
- ✅ Use 30-minute cache
- ✅ Called on API requests
- ✅ Called on user refresh (frontend)
- ❌ Never auto-execute on page load

**POST Webhooks:**
- ✅ Always called after database operations
- ✅ Automatically invalidate related caches
- ✅ Always create audit log entries

---

## 📝 Common Request Patterns

### Create Loan Application
```typescript
POST /api/loan-applications
Body: {
  productId: "PROD001",
  borrowerIdentifiers: {
    pan: "ABCDE1234F",
    name: "John Doe"
  }
}
```

### Update Form Data
```typescript
POST /api/loan-applications/:id/form
Body: {
  formData: {
    "field_001": "value1",
    "field_002": "value2"
  },
  documentUploads: [{
    fieldId: "field_001",
    fileUrl: "https://...",
    fileName: "document.pdf",
    mimeType: "application/pdf"
  }]
}
```

### Mark Disbursed
```typescript
POST /api/credit/loan-applications/:id/mark-disbursed
Body: {
  disbursedAmount: "5000000",
  disbursedDate: "2025-01-27",
  lenderId: "NBFC001"
}
// Automatically creates Commission Ledger entry
```

---

## 🎯 Key Features

✅ **Individual Webhook Architecture** - Each table has dedicated webhook  
✅ **30-Minute Cache** - Reduces webhook executions by ~90%  
✅ **RBAC Enforcement** - All endpoints protected by role  
✅ **Comprehensive Audit** - All actions logged  
✅ **Automatic Commission** - Calculated on disbursement  
✅ **Threaded Queries** - Embedded metadata in audit log  
✅ **Status Workflow** - Complete loan lifecycle management  

---

## 📚 Full Documentation

- **API_SPECIFICATION.md** - Complete API documentation
- **IMPLEMENTATION_SUMMARY.md** - Architecture overview
- **ROUTE_VERIFICATION.md** - Route mapping
- **COMPREHENSIVE_TEST_REPORT_FINAL.md** - Test coverage

---

**Status:** ✅ Production Ready
