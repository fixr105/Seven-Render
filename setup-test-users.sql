-- Seven Fincorp Test Users Setup Script
-- This script creates test user profiles after auth users are created

-- STEP 1: First create auth users in Supabase Dashboard:
-- Email: client@test.com, Password: Test@123456
-- Email: kam@test.com, Password: Test@123456
-- Email: credit@test.com, Password: Test@123456
-- Email: nbfc@test.com, Password: Test@123456

-- STEP 2: Then run this script, replacing the UUIDs with actual auth user IDs

-- Replace these with actual UUIDs from auth.users table
-- You can get them by running: SELECT id, email FROM auth.users WHERE email LIKE '%@test.com';

DO $$
DECLARE
  -- Replace these UUIDs with actual ones from auth.users
  client_auth_uuid uuid := '00000000-0000-0000-0000-000000000001'; -- Replace this
  kam_auth_uuid uuid := '00000000-0000-0000-0000-000000000002';    -- Replace this
  credit_auth_uuid uuid := '00000000-0000-0000-0000-000000000003'; -- Replace this
  nbfc_auth_uuid uuid := '00000000-0000-0000-0000-000000000004';   -- Replace this

  -- These will be auto-generated
  client_role_id uuid;
  kam_role_id uuid;
  credit_role_id uuid;
  nbfc_role_id uuid;
BEGIN
  -- Check if we're using placeholder UUIDs
  IF client_auth_uuid = '00000000-0000-0000-0000-000000000001' THEN
    RAISE EXCEPTION 'Please replace the placeholder UUIDs with actual auth user IDs!';
  END IF;

  -- Create user roles
  INSERT INTO user_roles (user_id, role, account_status)
  VALUES
    (client_auth_uuid, 'client', 'Active'),
    (kam_auth_uuid, 'kam', 'Active'),
    (credit_auth_uuid, 'credit_team', 'Active'),
    (nbfc_auth_uuid, 'nbfc', 'Active')
  ON CONFLICT (user_id) DO UPDATE
    SET role = EXCLUDED.role,
        account_status = EXCLUDED.account_status
  RETURNING id INTO client_role_id;

  -- Get all role IDs
  SELECT id INTO client_role_id FROM user_roles WHERE user_id = client_auth_uuid;
  SELECT id INTO kam_role_id FROM user_roles WHERE user_id = kam_auth_uuid;
  SELECT id INTO credit_role_id FROM user_roles WHERE user_id = credit_auth_uuid;
  SELECT id INTO nbfc_role_id FROM user_roles WHERE user_id = nbfc_auth_uuid;

  -- Create DSA Client profile
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
        kam_id = EXCLUDED.kam_id;

  -- Create NBFC Partner profile
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
    SET name = EXCLUDED.name;

  -- Create sample loan application
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
    SELECT 1 FROM loan_applications WHERE file_number LIKE 'SF' || to_char(now(), 'YYYYMMDD') || '%'
  );

  -- Create sample commission entry
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
  );

  RAISE NOTICE '✅ Test users setup complete!';
  RAISE NOTICE 'Client: client@test.com (Test Corporation)';
  RAISE NOTICE 'KAM: kam@test.com';
  RAISE NOTICE 'Credit: credit@test.com';
  RAISE NOTICE 'NBFC: nbfc@test.com';
  RAISE NOTICE 'Password for all: Test@123456';

END $$;

-- Verify setup
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

-- Show created client profile
SELECT
  dc.company_name,
  dc.email,
  dc.commission_rate,
  dc.is_active,
  ur_kam.role as kam_assigned
FROM dsa_clients dc
LEFT JOIN user_roles ur_kam ON dc.kam_id = ur_kam.id
WHERE dc.email = 'client@test.com';
