-- Seven Fincorp - Complete Dummy Users Setup Script
-- This script creates all test users for localhost testing
-- Run this in Supabase Dashboard → SQL Editor

-- ============================================================
-- STEP 1: Create the helper function (run this first)
-- ============================================================

CREATE OR REPLACE FUNCTION setup_test_client(user_email text, user_auth_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  role_id uuid;
  client_id uuid;
BEGIN
  -- Create user role
  INSERT INTO user_roles (user_id, role, account_status)
  VALUES (user_auth_id, 'client', 'Active')
  ON CONFLICT (user_id) DO UPDATE SET role = 'client'
  RETURNING id INTO role_id;

  -- Create DSA client profile
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
    role_id,
    'Test Corporation',
    'John Doe',
    user_email,
    '+91 9876543210',
    0.015,
    '{"ledger": true, "queries": true, "applications": true, "form_builder": true}'::jsonb,
    true
  )
  ON CONFLICT (user_id) DO UPDATE
    SET company_name = EXCLUDED.company_name,
        email = EXCLUDED.email
  RETURNING id INTO client_id;

  RETURN jsonb_build_object(
    'success', true,
    'role_id', role_id,
    'client_id', client_id,
    'message', 'Client setup complete! You can now login.',
    'email', user_email
  );
END;
$$;

-- ============================================================
-- STEP 2: Get Auth User IDs (create users in Dashboard first!)
-- ============================================================

-- First, create these users in Supabase Dashboard → Authentication → Users:
-- 1. client@test.com / Test@123456 (Auto-confirm: ✓)
-- 2. kam@test.com / Test@123456 (Auto-confirm: ✓)
-- 3. credit@test.com / Test@123456 (Auto-confirm: ✓)
-- 4. nbfc@test.com / Test@123456 (Auto-confirm: ✓)

-- Then run this query to get their IDs:
-- SELECT id, email FROM auth.users WHERE email LIKE '%@test.com';

-- ============================================================
-- STEP 3: Replace UUIDs below with actual IDs from Step 2
-- ============================================================

DO $$
DECLARE
  -- ⚠️ REPLACE THESE WITH ACTUAL UUIDs FROM auth.users TABLE ⚠️
  client_auth_uuid uuid := '00000000-0000-0000-0000-000000000001'; -- Replace with actual UUID
  kam_auth_uuid uuid := '00000000-0000-0000-0000-000000000002';    -- Replace with actual UUID
  credit_auth_uuid uuid := '00000000-0000-0000-0000-000000000003'; -- Replace with actual UUID
  nbfc_auth_uuid uuid := '00000000-0000-0000-0000-000000000004';   -- Replace with actual UUID

  -- These will be auto-generated
  client_role_id uuid;
  kam_role_id uuid;
  credit_role_id uuid;
  nbfc_role_id uuid;
BEGIN
  -- Check if using placeholder UUIDs
  IF client_auth_uuid = '00000000-0000-0000-0000-000000000001' THEN
    RAISE EXCEPTION 'Please replace the placeholder UUIDs with actual auth user IDs from auth.users table!';
  END IF;

  RAISE NOTICE '🚀 Starting test users setup...';

  -- Create user roles
  RAISE NOTICE 'Creating user roles...';
  INSERT INTO user_roles (user_id, role, account_status)
  VALUES
    (client_auth_uuid, 'client', 'Active'),
    (kam_auth_uuid, 'kam', 'Active'),
    (credit_auth_uuid, 'credit_team', 'Active'),
    (nbfc_auth_uuid, 'nbfc', 'Active')
  ON CONFLICT (user_id) DO UPDATE
    SET role = EXCLUDED.role,
        account_status = EXCLUDED.account_status;

  -- Get role IDs
  SELECT id INTO client_role_id FROM user_roles WHERE user_id = client_auth_uuid;
  SELECT id INTO kam_role_id FROM user_roles WHERE user_id = kam_auth_uuid;
  SELECT id INTO credit_role_id FROM user_roles WHERE user_id = credit_auth_uuid;
  SELECT id INTO nbfc_role_id FROM user_roles WHERE user_id = nbfc_auth_uuid;

  RAISE NOTICE '✅ User roles created';

  -- Create DSA Client profile
  RAISE NOTICE 'Creating client profile...';
  INSERT INTO dsa_clients (
    user_id,
    company_name,
    contact_person,
    email,
    phone,
    kam_id,
    commission_rate,
    modules_enabled,
    is_active
  )
  VALUES (
    client_role_id,
    'Test Corporation',
    'John Doe',
    'client@test.com',
    '+91 9876543210',
    kam_role_id,
    0.015,
    '{"ledger": true, "queries": true, "applications": true, "form_builder": true}'::jsonb,
    true
  )
  ON CONFLICT (user_id) DO UPDATE
    SET company_name = EXCLUDED.company_name,
        kam_id = EXCLUDED.kam_id,
        email = EXCLUDED.email;

  RAISE NOTICE '✅ Client profile created';

  -- Create NBFC Partner profile
  RAISE NOTICE 'Creating NBFC profile...';
  INSERT INTO nbfc_partners (
    user_id,
    name,
    contact_person,
    email,
    phone,
    address_region,
    is_active
  )
  VALUES (
    nbfc_role_id,
    'Test NBFC Bank',
    'Jane Smith',
    'nbfc@test.com',
    '+91 9876543211',
    'Mumbai, Maharashtra',
    true
  )
  ON CONFLICT (user_id) DO UPDATE
    SET name = EXCLUDED.name,
        email = EXCLUDED.email;

  RAISE NOTICE '✅ NBFC profile created';

  -- Create sample loan application (optional)
  RAISE NOTICE 'Creating sample data...';
  INSERT INTO loan_applications (
    file_number,
    client_id,
    applicant_name,
    loan_product_id,
    requested_loan_amount,
    form_data,
    status,
    assigned_credit_analyst
  )
  SELECT
    'SF' || to_char(now(), 'YYYYMMDD') || '001',
    (SELECT id FROM dsa_clients WHERE email = 'client@test.com'),
    'Test Applicant',
    (SELECT id FROM loan_products WHERE code = 'HOME' LIMIT 1),
    5000000,
    '{"property_type": "Residential", "property_value": 7000000, "employment_type": "Salaried", "monthly_income": 150000}'::jsonb,
    'pending_kam_review',
    credit_role_id
  WHERE NOT EXISTS (
    SELECT 1 FROM loan_applications 
    WHERE file_number = 'SF' || to_char(now(), 'YYYYMMDD') || '001'
  );

  -- Create sample commission entry (optional)
  INSERT INTO commission_ledger (
    client_id,
    application_id,
    transaction_type,
    amount,
    balance_after,
    description,
    status,
    date,
    disbursed_amount,
    commission_rate,
    dispute_status
  )
  SELECT
    (SELECT id FROM dsa_clients WHERE email = 'client@test.com'),
    (SELECT id FROM loan_applications WHERE file_number LIKE 'SF%' ORDER BY created_at DESC LIMIT 1),
    'pay_out',
    75000,
    75000,
    'Test commission entry for demonstration',
    'completed',
    CURRENT_DATE,
    5000000,
    0.015,
    'None'
  WHERE NOT EXISTS (
    SELECT 1 FROM commission_ledger
    WHERE client_id = (SELECT id FROM dsa_clients WHERE email = 'client@test.com')
    AND description = 'Test commission entry for demonstration'
  );

  RAISE NOTICE '✅ Sample data created';

  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '✅ Test users setup complete!';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Test User Credentials:';
  RAISE NOTICE '';
  RAISE NOTICE 'CLIENT:';
  RAISE NOTICE '  Email: client@test.com';
  RAISE NOTICE '  Password: Test@123456';
  RAISE NOTICE '';
  RAISE NOTICE 'KAM:';
  RAISE NOTICE '  Email: kam@test.com';
  RAISE NOTICE '  Password: Test@123456';
  RAISE NOTICE '';
  RAISE NOTICE 'CREDIT TEAM:';
  RAISE NOTICE '  Email: credit@test.com';
  RAISE NOTICE '  Password: Test@123456';
  RAISE NOTICE '';
  RAISE NOTICE 'NBFC:';
  RAISE NOTICE '  Email: nbfc@test.com';
  RAISE NOTICE '  Password: Test@123456';
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

END $$;

-- ============================================================
-- VERIFICATION: Check if users were created successfully
-- ============================================================

SELECT
  'Test Users Summary' as info,
  COUNT(*) FILTER (WHERE role = 'client') as clients,
  COUNT(*) FILTER (WHERE role = 'kam') as kams,
  COUNT(*) FILTER (WHERE role = 'credit_team') as credit_team,
  COUNT(*) FILTER (WHERE role = 'nbfc') as nbfcs
FROM user_roles
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email LIKE '%@test.com'
);

-- Show created profiles
SELECT
  'Client Profile' as type,
  dc.company_name as name,
  dc.email,
  dc.commission_rate,
  dc.is_active
FROM dsa_clients dc
WHERE dc.email = 'client@test.com'

UNION ALL

SELECT
  'NBFC Profile' as type,
  np.name,
  np.email,
  NULL as commission_rate,
  np.is_active
FROM nbfc_partners np
WHERE np.email = 'nbfc@test.com';
