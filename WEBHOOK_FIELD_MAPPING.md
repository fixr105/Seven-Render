# Webhook Field Mapping Reference

This document shows the exact fields that each POST handler sends to n8n, matching the n8n schema definitions.

**All webhook calls go through the backend** at `backend/src/services/airtable/n8nClient.ts` and `backend/src/services/airtable/n8nEndpoints.ts`. The frontend never calls n8n directly.

## ✅ All Webhooks - Field Mappings

### 1. POSTLOG (Admin Activity Log)
**Webhook:** `{N8N_BASE_URL}/webhook/POSTLOG`  
**Handler:** `backend/src/services/airtable/n8nClient.ts`  
**Fields Sent:**
- `id` (for matching)
- `Activity ID`
- `Timestamp`
- `Performed By`
- `Action Type`
- `Description/Details`
- `Target Entity`

### 2. POSTCLIENTFORMMAPPING (Client Form Mapping)
**Webhook:** `{N8N_BASE_URL}/webhook/POSTCLIENTFORMMAPPING`  
**Handler:** `backend/src/services/airtable/n8nClient.ts`  
**Fields Sent:**
- `id` (for matching)
- `Mapping ID`
- `Client`
- `Category`
- `Is Required`
- `Display Order`

### 3. COMISSIONLEDGER (Commission Ledger)
**Webhook:** `{N8N_BASE_URL}/webhook/COMISSIONLEDGER`  
**Handler:** `backend/src/services/airtable/n8nClient.ts`  
**Fields Sent:**
- `id` (for matching)
- `Ledger Entry ID`
- `Client`
- `Loan File`
- `Date`
- `Disbursed Amount`
- `Commission Rate`
- `Payout Amount`
- `Description`
- `Dispute Status`
- `Payout Request`

### 4. CREDITTEAMUSERS (Credit Team Users)
**Webhook:** `{N8N_BASE_URL}/webhook/CREDITTEAMUSERS`  
**Handler:** `backend/src/services/airtable/n8nClient.ts`  
**Fields Sent:**
- `id` (for matching)
- `Credit User ID`
- `Name`
- `Email`
- `Phone`
- `Role`
- `Status`

### 5. DAILYSUMMARY (Daily Summary Reports)
**Webhook:** `{N8N_BASE_URL}/webhook/DAILYSUMMARY`  
**Handler:** `backend/src/services/airtable/n8nClient.ts`  
**Fields Sent:**
- `id` (for matching)
- `Report Date`
- `Summary Content`
- `Generated Timestamp`
- `Delivered To` (array or string)

### 6. FILEAUDITLOGGING (File Audit Log)
**Webhook:** `{N8N_BASE_URL}/webhook/Fileauditinglog`  
**Handler:** `backend/src/services/airtable/n8nClient.ts`  
**Fields Sent:**
- `id` (for matching)
- `Log Entry ID`
- `File`
- `Timestamp`
- `Actor`
- `Action/Event Type`
- `Details/Message`
- `Target User/Role`
- `Resolved`

### 7. FormFields (Form Fields)
**Webhook:** `{N8N_BASE_URL}/webhook/FormFields`  
**Handler:** `backend/src/services/airtable/n8nClient.ts`  
**Fields Sent:**
- `id` (for matching)
- `Field ID`
- `Category`
- `Field Label`
- `Field Type`
- `Field Placeholder`
- `Field Options`
- `Is Mandatory`
- `Display Order`
- `Active`

### 8. FormCategory (Form Categories)
**Webhook:** `{N8N_BASE_URL}/webhook/FormCategory`  
**Handler:** `backend/src/services/airtable/n8nClient.ts`  
**Fields Sent:**
- `id` (for matching)
- `Category ID`
- `Category Name`
- `Description`
- `Display Order`
- `Active`

### 9. KAMusers (KAM Users)
**Webhook:** `{N8N_BASE_URL}/webhook/KAMusers`  
**Handler:** `backend/src/services/airtable/n8nClient.ts`  
**Fields Sent:**
- `id` (for matching)
- `KAM ID`
- `Name`
- `Email`
- `Phone`
- `Managed Clients`
- `Role`
- `Status`

### 10. loanapplications (Loan Applications)
**Webhook:** `{N8N_BASE_URL}/webhook/loanapplications`  
**Handler:** `backend/src/services/airtable/n8nClient.ts`  
**Fields Sent:**
- `id` (for matching)
- `File ID`
- `Client`
- `Applicant Name`
- `Loan Product`
- `Requested Loan Amount`
- `Documents`
- `Status`
- `Assigned Credit Analyst`
- `Assigned NBFC`
- `Lender Decision Status`
- `Lender Decision Date`
- `Lender Decision Remarks`
- `Approved Loan Amount`
- `AI File Summary`
- `Form Data`
- `Creation Date`
- `Submitted Date`
- `Last Updated`

### 11. adduser (User Accounts)
**Webhook:** `{N8N_BASE_URL}/webhook/adduser`  
**Handler:** `backend/src/services/airtable/n8nClient.ts`  
**Fields Sent:**
- `id` (for matching)
- `Username`
- `Password`
- `Role`
- `Associated Profile`
- `Last Login`
- `Account Status`

### 12. NBFCPartners (NBFC Partners)
**Webhook:** `{N8N_BASE_URL}/webhook/NBFCPartners`  
**Handler:** `backend/src/services/airtable/n8nClient.ts`  
**Fields Sent:**
- `id` (for matching)
- `Lender ID`
- `Lender Name`
- `Contact Person`
- `Contact Email/Phone`
- `Address/Region`
- `Active`

---

## 📝 Notes

- All handlers send **ONLY** the exact fields defined in the n8n schema
- The `id` field is always included for matching/upsert operations
- All webhook calls go through the backend API; the frontend never calls n8n directly
- See `backend/API_ENDPOINTS_WEBHOOK_MAPPING.md` for full API-to-webhook flow documentation
