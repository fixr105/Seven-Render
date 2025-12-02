-- Create Missing Data for Webhook POST Test
-- Run this in Supabase Dashboard → SQL Editor

-- Step 1: Create or update client that matches "CL001"
-- First, check if we have any existing clients we can use
-- If not, we'll create one with a name that includes "CL001"

-- Option 1: Update existing client to include "CL001" in name (if you have one)
-- UPDATE dsa_clients 
-- SET company_name = company_name || ' (CL001)'
-- WHERE id = (SELECT id FROM dsa_clients LIMIT 1);

-- Option 2: Create a new client (requires user_role first)
-- This assumes you have at least one user_role with role='client'
-- If not, create a user_role first

DO $$
DECLARE
  existing_client_id uuid;
  existing_role_id uuid;
  new_client_id uuid;
  product_id uuid;
BEGIN
  -- Check if client with CL001 in name exists
  SELECT id INTO existing_client_id
  FROM dsa_clients
  WHERE company_name ILIKE '%CL001%'
  LIMIT 1;

  IF existing_client_id IS NULL THEN
    -- Get first available client user_role (or create a dummy one)
    SELECT id INTO existing_role_id
    FROM user_roles
    WHERE role = 'client'
    LIMIT 1;

    IF existing_role_id IS NULL THEN
      RAISE NOTICE 'No client user_role found. Creating one...';
      -- Create a minimal user_role (this might fail if no auth user exists)
      -- For testing, we'll try to use an existing role or skip user_id requirement
      -- Actually, let's just update an existing client name instead
      UPDATE dsa_clients
      SET company_name = company_name || ' (CL001)'
      WHERE id = (SELECT id FROM dsa_clients LIMIT 1)
      RETURNING id INTO existing_client_id;
    ELSE
      -- Create new client
      INSERT INTO dsa_clients (
        user_id,
        company_name,
        contact_person,
        email,
        phone,
        commission_rate,
        modules_enabled,
        is_active
      )
      VALUES (
        existing_role_id,
        'CL001 Client',
        'Test Contact',
        'cl001@test.com',
        '+91 9876543210',
        0.015,
        '{"ledger": true, "queries": true, "applications": true, "form_builder": true}'::jsonb,
        true
      )
      ON CONFLICT (user_id) DO UPDATE
        SET company_name = 'CL001 Client'
      RETURNING id INTO existing_client_id;
    END IF;
  END IF;

  RAISE NOTICE 'Client ID: %', existing_client_id;

  -- Step 2: Create or update loan product C002
  SELECT id INTO product_id
  FROM loan_products
  WHERE code = 'C002' OR name ILIKE '%C002%'
  LIMIT 1;

  IF product_id IS NULL THEN
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
      SET name = 'C002 Product'
    RETURNING id INTO product_id;
  END IF;

  RAISE NOTICE 'Loan Product ID: %', product_id;
  RAISE NOTICE '';
  RAISE NOTICE '✅ Setup complete!';
  RAISE NOTICE '   Client ID: %', existing_client_id;
  RAISE NOTICE '   Product ID: %', product_id;
  RAISE NOTICE '';
  RAISE NOTICE '💡 The webhook handler will match "CL001" and "C002" to these records';

END $$;

-- Verify the setup
SELECT 
  'Client' as type,
  id,
  company_name,
  email
FROM dsa_clients
WHERE company_name ILIKE '%CL001%'
UNION ALL
SELECT 
  'Loan Product' as type,
  id::text,
  name,
  code
FROM loan_products
WHERE code = 'C002' OR name ILIKE '%C002%';

