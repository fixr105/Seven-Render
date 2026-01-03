# Auto-Create Commission from NBFC Payout

This script automatically generates Commission Ledger entries based on NBFC payout rates from an Excel file.

## Overview

When a loan application is approved or disbursed, this script:
1. Loads NBFC payout rates from an Excel file
2. Finds matching loans in Admin Activity Log
3. Looks up the payout rate for the assigned NBFC
4. Calculates commission as **50% of the payout rate**
5. Creates a Commission Ledger entry

## Excel File Format

The script expects an Excel file named `WE5 FINANCIAL CONSULTING PAYOUT-1.xlsx` with the following structure:

| Column A (NBFC Name) | Column B | Column C (Payout Rate) |
|---------------------|----------|------------------------|
| RU Loans FSPL       | ...      | 0.0200                 |
| Anupam Finserv      | ...      | 0.0150                 |
| Aphelion            | ...      | 0.0250                 |

**Important:**
- **Column A**: NBFC Name (e.g., "RU Loans FSPL")
- **Column C**: Payout Rate as decimal (e.g., 0.0200 = 2%)
- The first row can be a header row (will be auto-detected)

## Commission Calculation

```
Commission Rate = Payout Rate × 0.5 (50%)
Commission Amount = Loan Amount × Commission Rate
```

**Example:**
- Payout Rate: 2% (0.0200)
- Commission Rate: 1% (0.0200 × 0.5)
- Loan Amount: ₹500,000
- Commission Amount: ₹5,000

## Usage

### Basic Usage

```bash
cd backend
npm run auto:commission:nbfc [path/to/PAYOUT-1.xlsx]
```

### File Location

If no path is provided, the script will look for the file in:
1. `backend/data/WE5 FINANCIAL CONSULTING PAYOUT-1.xlsx`
2. `./WE5 FINANCIAL CONSULTING PAYOUT-1.xlsx`
3. `backend/WE5 FINANCIAL CONSULTING PAYOUT-1.xlsx`

### Example

```bash
# With explicit path
npm run auto:commission:nbfc "/path/to/WE5 FINANCIAL CONSULTING PAYOUT-1.xlsx"

# Without path (will search default locations)
npm run auto:commission:nbfc
```

## NBFC Name Matching

The script uses **fuzzy matching** to match NBFC names between:
- Excel file (Column A)
- System NBFC Partners (from Airtable)
- Loan Application's "Assigned NBFC" field

### Matching Logic

1. **Exact Match**: Normalized names match exactly
2. **Contains Match**: One name contains the other
3. **Word Match**: At least 2 words match between names

### Examples

| Excel Name          | System Name        | Match? |
|---------------------|-------------------|--------|
| RU Loans FSPL       | RuLoans FSPL       | ✅ Yes |
| Anupam Finserv      | Anupam Finserv     | ✅ Yes |
| Aphelion            | Aphelion Ltd       | ✅ Yes |
| BOB (Kiran)         | BOB                | ✅ Yes |

## Output

The script will:
- ✅ Create Commission Ledger entries for matching loans
- ⚠️ Skip loans that already have commission entries
- ⚠️ Use default rate (0.5%) if NBFC not found in Excel
- ❌ Report errors for loans that can't be processed

### Sample Output

```
🚀 Auto-Create Commission from NBFC Payout Script
==================================================

📊 Loading Commission Payout Table from: ./WE5 FINANCIAL CONSULTING PAYOUT-1.xlsx
   ✅ RU Loans FSPL: Payout Rate 2.00% → Commission Rate 1.00%
   ✅ Anupam Finserv: Payout Rate 1.50% → Commission Rate 0.75%
   📋 Loaded 4 NBFC payout rates

👥 Fetching NBFC Partners from system...
   ✅ Fetched 4 NBFC Partners

📋 Fetching Admin Activity Log entries...
   ✅ Fetched 15 Admin Activity Log entries

📊 Found 3 activity log entries with status: Approved or Disbursed

============================================================
Processing entry 1/3
Reference ID: APP-001
Updated Status: Approved
Updated At: 2026-01-03T16:30:00Z

📄 Fetching loan application: APP-001...
   ✅ Found loan application: SF36220522BRY3QF
   Client ID: CL001
   NBFC Partner: RuLoans FSPL
   🔍 Matched "RuLoans FSPL" to Excel entry "RU Loans FSPL"
   💰 Found payout rate for "RuLoans FSPL": 2.00% → Commission: 1.00%

💰 Creating commission ledger entry...
   Ledger Entry ID: LEDGER-1704295800000-abc123
   Loan File: SF36220522BRY3QF
   Client: CL001
   NBFC Partner: RuLoans FSPL
   Loan Amount: ₹500,000
   Commission Rate: 1.00% (from 2.00% payout rate)
   Commission Amount: ₹5,000
   Entry Type: Payout
   Payout Amount: ₹5,000
   ✅ Commission ledger entry created successfully

============================================================
📊 SUMMARY
============================================================

✅ Successful: 3
   - SF36220522BRY3QF: ₹5,000 (2.00% payout → 1.00% commission) - RuLoans FSPL
   - SF36225402KBU7DF: ₹3,750 (1.50% payout → 0.75% commission) - Anupam Finserv
   - SF36220522BRY3QF: ₹5,000 (2.00% payout → 1.00% commission) - RuLoans FSPL

✨ Script completed!
```

## Commission Ledger Entry Structure

Each entry created includes:

```json
{
  "Ledger Entry ID": "LEDGER-...",
  "Client": "CL001",
  "Loan File": "APP-001",
  "Date": "2026-01-03",
  "Disbursed Amount": "500000",
  "Commission Rate": "1.0",
  "Payout Amount": "5000",
  "Description": "Payout for loan APP-001 - Commission: 1.00% of ₹500,000 (NBFC: RuLoans FSPL)",
  "Dispute Status": "None",
  "Payout Request": "False"
}
```

## Troubleshooting

### Excel File Not Found

```
❌ Excel file not found!
```

**Solution:** Provide the full path to the Excel file:
```bash
npm run auto:commission:nbfc "/full/path/to/WE5 FINANCIAL CONSULTING PAYOUT-1.xlsx"
```

### NBFC Not Found in Excel

```
⚠️  NBFC Partner "XYZ" not found in payout table, using default rate: 1.5%
```

**Solution:** Add the NBFC to the Excel file or verify the name matches exactly (case-insensitive, fuzzy matching will try to match). The default rate of 0.5% will be used if the NBFC is not found.

### Admin Activity Log Not Found

```
❌ Failed to fetch Admin Activity Log: 404 Not Found
💡 Make sure the Admin Activity Log GET webhook is configured in n8n
```

**Solution:** Configure the Admin Activity Log GET webhook in n8n at `/webhook/adminactivity` or `/webhook/adminactivitylog`.

### No Matching Loans

```
⚠️  No matching activity log entries found. Exiting.
```

**Solution:** Ensure there are loan applications with status "Approved" or "Disbursed" in the Admin Activity Log.

## Related Scripts

- `auto-create-commission-ledger.js` - Creates commission entries using client's commission rate (default 1.5%)
- `manage-loan-application-status.js` - Updates loan application status and logs to Admin Activity Log

## Notes

- The script prevents duplicate entries by checking if a commission entry already exists for a loan
- Commission is calculated as **50% of the NBFC payout rate**
- If an NBFC is not found in the Excel file, the script uses a default rate of 0.5%
- The script includes rate limiting (1 second delay) between requests to avoid Airtable throttling

