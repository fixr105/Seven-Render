-- Simple Webhook Setup - Update Existing Records
-- Run this in Supabase Dashboard → SQL Editor
-- This updates existing clients/products to match webhook identifiers

-- Step 1: Update first client to include "CL001" in name
UPDATE dsa_clients
SET company_name = company_name || ' (CL001)'
WHERE id = (SELECT id FROM dsa_clients WHERE is_active = true LIMIT 1)
RETURNING id, company_name;

-- Step 2: Create or update loan product with code "C002"
INSERT INTO loan_products (
  name,
  code,
  description,
  interest_rate_min,
  interest_rate_max,
  min_loan_amount,
  max_loan_amount,
  tenure_min_months,
  tenure_max_months,
  is_active
)
VALUES (
  'C002 Product',
  'C002',
  'Loan product for webhook testing',
  8.5,
  12.5,
  100000,
  10000000,
  12,
  60,
  true
)
ON CONFLICT (code) DO UPDATE
  SET name = 'C002 Product',
      is_active = true
RETURNING id, name, code;

-- Verify
SELECT '✅ Client updated' as status, id, company_name FROM dsa_clients WHERE company_name ILIKE '%CL001%'
UNION ALL
SELECT '✅ Product created' as status, id::text, name FROM loan_products WHERE code = 'C002';

