# Webhook Field Mapping Reference

This document shows the exact fields that each POST handler sends to n8n, matching the n8n schema definitions.

## ✅ All Webhooks - Field Mappings

### 1. POSTLOG (Admin Activity Log)
**Webhook:** `https://fixrrahul.app.n8n.cloud/webhook/POSTLOG`  
**Handler:** `src/lib/adminActivityLogPost.ts`  
**Fields Sent:**
- `id` (for matching)
- `Activity ID`
- `Timestamp`
- `Performed By`
- `Action Type`
- `Description/Details`
- `Target Entity`

### 2. POSTCLIENTFORMMAPPING (Client Form Mapping)
**Webhook:** `https://fixrrahul.app.n8n.cloud/webhook/POSTCLIENTFORMMAPPING`  
**Handler:** `src/lib/clientFormMappingPost.ts`  
**Fields Sent:**
- `id` (for matching)
- `Mapping ID`
- `Client`
- `Category`
- `Is Required`
- `Display Order`

### 3. COMISSIONLEDGER (Commission Ledger)
**Webhook:** `https://fixrrahul.app.n8n.cloud/webhook/COMISSIONLEDGER`  
**Handler:** `src/lib/commissionLedgerPost.ts`  
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
**Webhook:** `https://fixrrahul.app.n8n.cloud/webhook/CREDITTEAMUSERS`  
**Handler:** `src/lib/creditTeamUsersPost.ts`  
**Fields Sent:**
- `id` (for matching)
- `Credit User ID`
- `Name`
- `Email`
- `Phone`
- `Role`
- `Status`

### 5. DAILYSUMMARY (Daily Summary Reports)
**Webhook:** `https://fixrrahul.app.n8n.cloud/webhook/DAILYSUMMARY`  
**Handler:** `src/lib/dailySummaryPost.ts`  
**Fields Sent:**
- `id` (for matching)
- `Report Date`
- `Summary Content`
- `Generated Timestamp`
- `Delivered To` (array or string)

### 6. FILEAUDITLOGGING (File Audit Log)
**Webhook:** `https://fixrrahul.app.n8n.cloud/webhook/FILEAUDITLOGGING`  
**Handler:** `src/lib/fileAuditLogPost.ts`  
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

### 7. FormCategory (Form Fields)
**Webhook:** `https://fixrrahul.app.n8n.cloud/webhook/FormCategory`  
**Handler:** `src/lib/formFieldsPost.ts`  
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
**Webhook:** `https://fixrrahul.app.n8n.cloud/webhook/FormCategory`  
**Handler:** `src/lib/formCategoriesPost.ts`  
**Fields Sent:**
- `id` (for matching)
- `Category ID`
- `Category Name`
- `Description`
- `Display Order`
- `Active`

### 9. KAMusers (KAM Users)
**Webhook:** `https://fixrrahul.app.n8n.cloud/webhook/KAMusers`  
**Handler:** `src/lib/kamUsersPost.ts`  
**Fields Sent:**
- `id` (for matching)
- `KAM ID`
- `Name`
- `Email`
- `Phone`
- `Managed Clients`
- `Role`
- `Status`

### 10. applications (Loan Applications)
**Webhook:** `https://fixrrahul.app.n8n.cloud/webhook/applications`  
**Handler:** `src/lib/loanApplicationsPost.ts`  
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
**Webhook:** `https://fixrrahul.app.n8n.cloud/webhook/adduser`  
**Handler:** `src/lib/userAccountsPost.ts`  
**Fields Sent:**
- `id` (for matching)
- `Username`
- `Password`
- `Role`
- `Associated Profile`
- `Last Login`
- `Account Status`

### 12. applications (NBFC Partners)
**Webhook:** `https://fixrrahul.app.n8n.cloud/webhook/applications`  
**Handler:** `src/lib/nbfcPartnersPost.ts`  
**Fields Sent:**
- `id` (for matching)
- `Lender ID`
- `Lender Name`
- `Contact Person`
- `Contact Email/Phone`
- `Address/Region`
- `Active`

---

## ✅ Test Results

All 12 webhooks tested successfully:
- ✅ POSTLOG
- ✅ POSTCLIENTFORMMAPPING
- ✅ COMISSIONLEDGER
- ✅ CREDITTEAMUSERS
- ✅ DAILYSUMMARY
- ✅ FILEAUDITLOGGING
- ✅ FormCategory (Form Fields)
- ✅ FormCategory (Form Categories)
- ✅ KAMusers
- ✅ applications (Loan Applications)
- ✅ adduser
- ✅ applications (NBFC Partners)

## 📝 Notes

- All handlers send **ONLY** the exact fields defined in the n8n schema
- The `id` field is always included for matching/upsert operations
- All handlers are configured to send data in the exact format expected by n8n
- Test script: `test-all-webhooks.js` - can be used to test all webhooks sequentially

