# POST Webhook Field Mapping - Backend vs n8n Comparison

**Date:** 2026-01-27  
**Purpose:** Detailed field-by-field comparison of what backend sends vs what n8n expects

## Quick Reference: Field Mapping Status

| Webhook | Backend Sends | n8n Maps | Status | Missing Fields |
|---------|--------------|----------|--------|----------------|
| POSTLOG | 11 fields | 7 fields | ⚠️ Partial | `Related File ID`, `Related Client ID`, `Related User ID`, `Metadata` |
| POSTCLIENTFORMMAPPING | 6 fields | 6 fields | ✅ Complete | None |
| COMISSIONLEDGER | All fields | 11 fields | ✅ Complete | None |
| CREDITTEAMUSERS | 7 fields | 7 fields | ✅ Complete | None |
| DAILYSUMMARY | 5 fields | 5 fields | ✅ Complete | None |
| Fileauditinglog | 9 fields | 9 fields | ✅ Complete | None |
| Client | 10 fields | 9 fields | ⚠️ Partial | `Form Categories` |
| FormCategory | 6 fields | 6 fields | ✅ Complete | None |
| FormFields | 10 fields | 10 fields | ✅ Complete | None |
| KAMusers | All fields | 8 fields | ✅ Complete | None |
| loanapplications | 19 fields | 19 fields | ✅ Complete | None |
| loanproducts | 6 fields | 6 fields | ✅ Complete | None |
| NBFCPartners | 7 fields | 7 fields | ✅ Complete | None |
| adduser | 7 fields | 7 fields | ✅ Complete | None |
| notification | 15 fields | 0 fields | ❌ BROKEN | ALL 15 fields missing |

## Detailed Field Comparison

### 1. POSTLOG (Admin Activity Log)

**Backend Sends:**
```typescript
{
  id: string,
  'Activity ID': string,
  Timestamp: string,
  'Performed By': string,
  'Action Type': string,
  'Description/Details': string,
  'Target Entity': string,
  'Related File ID'?: string,      // ⚠️ NOT mapped
  'Related Client ID'?: string,    // ⚠️ NOT mapped
  'Related User ID'?: string,      // ⚠️ NOT mapped
  Metadata?: string                 // ⚠️ NOT mapped
}
```

**n8n Maps:**
- ✅ `id`, `Activity ID`, `Timestamp`, `Performed By`, `Action Type`, `Description/Details`, `Target Entity`
- ❌ `Related File ID` - NOT mapped
- ❌ `Related Client ID` - NOT mapped
- ❌ `Related User ID` - NOT mapped
- ❌ `Metadata` - NOT mapped

**Impact:** Cannot link admin activities to files/clients/users for filtering.

---

### 2. notification (Notifications) - ❌ BROKEN

**Backend Sends:**
```typescript
{
  id: string,
  'Notification ID': string,
  'Recipient User': string,
  'Recipient Role': string,
  'Related File': string,
  'Related Client': string,
  'Related Ledger Entry': string,
  'Notification Type': string,
  'Title': string,
  'Message': string,
  'Channel': string,
  'Is Read': string,
  'Created At': string,
  'Read At': string,
  'Action Link': string
}
```

**n8n Maps:**
- ❌ **NOTHING** - `"value": {}` - Empty mapping!

**Impact:** 
- ❌ Notifications are NOT saved to Airtable
- ❌ All notification POSTs fail silently
- ❌ Users will not receive notifications
- ❌ Notification system is completely broken

**Fix Required:** Configure all 15 field mappings in n8n.

---

### 3. Client (Clients)

**Backend Sends:**
```typescript
{
  id: string,
  'Client ID': string,
  'Client Name': string,
  'Primary Contact Name': string,
  'Contact Email / Phone': string,
  'Assigned KAM': string,
  'Enabled Modules': string,
  'Commission Rate': string,
  'Status': string,
  'Form Categories': string  // ⚠️ NOT mapped
}
```

**n8n Maps:**
- ✅ All fields except `Form Categories`
- ❌ `Form Categories` - NOT mapped

**Impact:** `Form Categories` field is lost when updating clients.

---

### 4. KAMusers (KAM Users)

**Backend Sends:**
- ⚠️ **Sends data as-is** - No field normalization
- Caller must format fields correctly

**n8n Maps:**
- ✅ All 8 fields mapped correctly

**Risk:** If caller sends `Email: "Sagar"` (not an email), it will overwrite the email field and break login.

---

### 5. CREDITTEAMUSERS (Credit Team Users)

**Backend Sends:**
```typescript
{
  id: string,
  'Credit User ID': string,
  'Name': string,
  'Email': string,  // ⚠️ Must be valid email
  'Phone': string,
  'Role': string,
  'Status': string
}
```

**n8n Maps:**
- ✅ All 7 fields mapped correctly

**Risk:** If backend sends `Email: "Rahul"` (not an email), it will overwrite the email field and break login.

---

## Field Name Format Consistency

### Backend Field Format
- Uses Airtable column names exactly: `'Field Name'` (with spaces, capitalization)
- Some methods normalize: `data['Field Name'] || data.fieldName || ''`
- Some methods send as-is: `postKamUser()`, `postClientFormMapping()`, `postCommissionLedger()`

### n8n Field Format
- Uses expression syntax: `={{ $json.body['Field Name'] }}`
- Matches Airtable column names exactly

**Status:** ✅ **Format is consistent** - Both use Airtable column names.

---

## Upsert Matching Strategy

All webhooks use:
- **Operation:** `upsert`
- **Matching Column:** `id`
- **Strategy:** Match on `id`, update if exists, create if not

**Status:** ✅ **Correct** - Allows both create and update operations.

---

## Response Format

All webhooks return Airtable record format:
```json
{
  "id": "rec...",
  "createdTime": "...",
  "fields": { ... }
}
```

**Backend Handling:**
- Backend doesn't parse specific response format
- Uses response to invalidate cache
- Treats any response as success (unless error)

**Status:** ✅ **Acceptable** - Response format is fine.

---

## Critical Issues Summary

### 🔴 Issue #1: Notifications Webhook - COMPLETELY BROKEN

**Severity:** CRITICAL  
**Impact:** Notification system non-functional

**Problem:**
- n8n field mapping is empty: `"value": {}`
- Backend sends 15 fields correctly
- None of the fields are mapped to Airtable
- Result: Notifications are never saved

**Fix:**
1. Open n8n workflow
2. Select "Post Notifications" Airtable node
3. Configure field mappings for all 15 fields
4. Test with sample notification

---

### ⚠️ Issue #2: POSTLOG Missing Optional Fields

**Severity:** LOW (optional fields)  
**Impact:** Cannot link activities to related entities

**Problem:**
- Backend sends 4 optional relationship fields
- n8n doesn't map them
- Result: Activities cannot be filtered by file/client/user

**Fix (Optional):**
- Add field mappings if relationship tracking is needed
- Or remove from backend payload if not needed

---

### ⚠️ Issue #3: Client Webhook Missing Form Categories

**Severity:** LOW  
**Impact:** `Form Categories` field lost on client updates

**Problem:**
- Backend sends `Form Categories` field
- n8n doesn't map it
- Result: Field is lost when updating clients

**Fix:**
- Add `Form Categories` mapping in n8n
- Or remove from backend payload

---

### ⚠️ Issue #4: Email Field Risk (KAM/Credit Users)

**Severity:** MEDIUM  
**Impact:** Can break login if invalid email posted

**Problem:**
- `postKamUser()` sends data as-is (no validation)
- `postCreditTeamUser()` normalizes but doesn't validate email format
- If invalid email posted, login will fail

**Fix:**
- Add email validation in backend before posting
- Validate format: must contain `@` and `.`

---

## Recommendations

### Immediate Actions (Critical)

1. **Fix Notifications Webhook** (URGENT)
   - Configure all 15 field mappings
   - Test with sample data
   - Verify notifications appear in Airtable

### Short-term Actions

2. **Add Email Validation**
   - Validate email format in `postKamUser()` and `postCreditTeamUser()`
   - Prevent posting invalid emails

3. **Standardize Field Normalization**
   - Make all POST methods normalize field names consistently
   - Currently some normalize, some don't

### Optional Actions

4. **Add Optional Fields to POSTLOG**
   - If relationship tracking is needed
   - Map `Related File ID`, `Related Client ID`, `Related User ID`, `Metadata`

5. **Add Form Categories to Client Webhook**
   - If this field is needed
   - Map `Form Categories` field in n8n

---

## Testing Checklist

After fixes, test each webhook:

- [ ] POSTLOG - Verify activity saved with all required fields
- [ ] POSTCLIENTFORMMAPPING - Verify mapping saved
- [ ] COMISSIONLEDGER - Verify ledger entry saved
- [ ] CREDITTEAMUSERS - Verify user saved with valid email
- [ ] DAILYSUMMARY - Verify report saved
- [ ] Fileauditinglog - Verify audit log saved
- [ ] Client - Verify client saved
- [ ] FormCategory - Verify category saved
- [ ] FormFields - Verify field saved
- [ ] KAMusers - Verify user saved with valid email
- [ ] loanapplications - Verify application saved
- [ ] loanproducts - Verify product saved
- [ ] NBFCPartners - Verify partner saved
- [ ] adduser - Verify user account saved
- [ ] **notification - Verify notification saved (CRITICAL - currently broken)**

---

## Conclusion

**Overall Status:** ⚠️ **14/15 webhooks working (93.3%)**

**Critical Blocker:**
- ❌ Notifications webhook is completely broken - no field mappings

**Minor Issues:**
- ⚠️ POSTLOG missing optional relationship fields
- ⚠️ Client webhook missing Form Categories field
- ⚠️ Email validation needed for KAM/Credit Users

**After Fixes:**
- ✅ All webhooks will work correctly
- ✅ All data will be saved to Airtable
- ✅ Field mappings will be complete
