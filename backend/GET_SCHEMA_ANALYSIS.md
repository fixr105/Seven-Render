# GET Schema Analysis

## GET Webhook Endpoint

**Current GET Webhook URL:**
```
https://fixrrahul.app.n8n.cloud/webhook/46a2b46b-3288-4970-bd13-99c2ba08d52d
```

**Schema Endpoint (Not Active):**
```
https://fixrrahul.app.n8n.cloud/webhook/getschemadb
```

**Status:** ⚠️ The `getschemadb` webhook is not currently active. The workflow needs to be activated in n8n.

## Expected Tables from N8nGetResponse

Based on the `N8nGetResponse` interface in `backend/src/types/entities.ts`, the GET webhook should return the following 13 tables:

### Tables Expected from GET Webhook

1. **Admin Activity log** (`Admin Activity log`)
   - Fields: `id`, `Activity ID`, `Timestamp`, `Performed By`, `Action Type`, `Description/Details`, `Target Entity`
   - Airtable Table ID: `tblz0e59ULgBcUvrY`

2. **Client Form Mapping** (`Client Form Mapping`)
   - Fields: `id`, `Mapping ID`, `Client`, `Category`, `Is Required`, `Display Order`
   - Airtable Table ID: `tbl70C8uPKmoLkOQJ`

3. **Commission Ledger** (`Commission Ledger`)
   - Fields: `id`, `Ledger Entry ID`, `Client`, `Loan File`, `Date`, `Disbursed Amount`, `Commission Rate`, `Payout Amount`, `Description`, `Dispute Status`, `Payout Request`
   - Airtable Table ID: `tblrBWFuPYBI4WWtn`

4. **Credit Team Users** (`Credit Team Users`)
   - Fields: `id`, `Credit User ID`, `Name`, `Email`, `Phone`, `Role`, `Status`
   - Airtable Table ID: `tbl1a1TmMUj918Byj`

5. **Daily summary Reports** (`Daily summary Reports`)
   - Fields: `id`, `Report Date`, `Summary Content`, `Generated Timestamp`, `Delivered To`
   - Airtable Table ID: `tbla3urDb8kCsO0Et`

6. **File Auditing Log** (`File Auditing Log`)
   - Fields: `id`, `Log Entry ID`, `File`, `Timestamp`, `Actor`, `Action/Event Type`, `Details/Message`, `Target User/Role`, `Resolved`
   - Airtable Table ID: `tblL1XJnqW3Q15ueZ`

7. **Form Categories** (`Form Categories`)
   - Fields: `id`, `Category ID`, `Category Name`, `Description`, `Display Order`, `Active`
   - Airtable Table ID: `tblqCqXV0Hds0t0bH`

8. **Form Fields** (`Form Fields`)
   - Fields: `id`, `Field ID`, `Category`, `Field Label`, `Field Type`, `Field Placeholder`, `Field Options`, `Is Mandatory`, `Display Order`, `Active`
   - Airtable Table ID: `tbl5oZ6zI0dc5eutw`

9. **KAM Users** (`KAM Users`)
   - Fields: `id`, `KAM ID`, `Name`, `Email`, `Phone`, `Managed Clients`, `Role`, `Status`
   - Airtable Table ID: `tblpZFUQEJAvPsdOJ`

10. **Loan Applications** (`Loan Applications`)
    - Fields: `id`, `File ID`, `Client`, `Applicant Name`, `Loan Product`, `Requested Loan Amount`, `Documents`, `Status`, `Assigned Credit Analyst`, `Assigned NBFC`, `Lender Decision Status`, `Lender Decision Date`, `Lender Decision Remarks`, `Approved Loan Amount`, `AI File Summary`, `Form Data`, `Creation Date`, `Submitted Date`, `Last Updated`
    - Airtable Table ID: `tbl85RSGR1op38O3G`

11. **Loan Products** (`Loan Products`)
    - Fields: `id`, `Product ID`, `Product Name`, `Description`, `Active`, `Required Documents/Fields`
    - Airtable Table ID: `tblNxvQVlzCfcj4e2`

12. **NBFC Partners** (`NBFC Partners`)
    - Fields: `id`, `Lender ID`, `Lender Name`, `Contact Person`, `Contact Email/Phone`, `Address/Region`, `Active`
    - Airtable Table ID: `tblGvEp8Z1QvahwI0`

13. **User Accounts** (`User Accounts`)
    - Fields: `id`, `Username`, `Password`, `Role`, `Associated Profile`, `Last Login`, `Account Status`
    - Airtable Table ID: `tbl7RRcehD5xLiPv7`

## Comparison with POST Webhooks

All 13 tables have corresponding POST webhooks:

| Table | GET (Expected) | POST Webhook | Status |
|-------|----------------|--------------|--------|
| Admin Activity log | ✅ | POSTLOG | ✅ |
| Client Form Mapping | ✅ | POSTCLIENTFORMMAPPING | ✅ |
| Commission Ledger | ✅ | COMISSIONLEDGER | ✅ |
| Credit Team Users | ✅ | CREDITTEAMUSERS | ✅ |
| Daily summary Reports | ✅ | DAILYSUMMARY | ✅ |
| File Auditing Log | ✅ | FILEAUDITLOGGING | ✅ |
| Form Categories | ✅ | FormCategory | ✅ |
| Form Fields | ✅ | FormCategory | ✅ |
| KAM Users | ✅ | KAMusers | ✅ |
| Loan Applications | ✅ | applications | ✅ |
| Loan Products | ✅ | loadprod | ✅ |
| NBFC Partners | ✅ | NBFC | ✅ |
| User Accounts | ✅ | adduser | ✅ |

## Next Steps

1. **Activate the `getschemadb` workflow** in n8n to enable schema retrieval
2. Once active, verify the schema matches the expected tables and fields
3. Compare actual schema with expected schema to identify any discrepancies

## Notes

- The GET webhook (`46a2b46b-3288-4970-bd13-99c2ba08d52d`) is used for fetching all data
- The schema endpoint (`getschemadb`) would be used to get the table structure
- All table IDs are from the "Seven Dashboard" Airtable base (`appzbyi8q7pJRl1cd`)

