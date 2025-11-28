-- Quick Script: Create One Test User
-- Copy-paste this after creating auth user in Dashboard

-- ============================================================
-- STEP 1: First create auth user in Supabase Dashboard:
-- ============================================================
-- 1. Go to: Authentication → Users → "Add user"
-- 2. Email: client@test.com
-- 3. Password: Test@123456
-- 4. ✅ CHECK "Auto Confirm User"
-- 5. Click "Create user"
-- 6. Copy the UUID from the users table

-- ============================================================
-- STEP 2: Replace USER_UUID_HERE below with the UUID you copied
-- ============================================================

DO $$
DECLARE
  -- ⚠️ REPLACE THIS UUID WITH YOUR ACTUAL USER ID ⚠️
  user_uuid uuid := 'USER_UUID_HERE';  -- <-- CHANGE THIS!
  role_id uuid;
BEGIN
  -- Check if placeholder UUID
  IF user_uuid = 'USER_UUID_HERE'::uuid THEN
    RAISE EXCEPTION 'Please replace USER_UUID_HERE with the actual UUID from auth.users table!';
  END IF;

  RAISE NOTICE 'Creating user role and profile for client@test.com...';

  -- Create user role
  INSERT INTO user_roles (user_id, role, account_status)
  VALUES (user_uuid, 'client', 'Active')
  ON CONFLICT (user_id) DO UPDATE
    SET role = 'client',
        account_status = 'Active'
  RETURNING id INTO role_id;

  RAISE NOTICE '✅ User role created';

  -- Create client profile
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
    'client@test.com',
    '+91 9876543210',
    0.015,
    '{"ledger": true, "queries": true, "applications": true, "form_builder": true}'::jsonb,
    true
  )
  ON CONFLICT (user_id) DO UPDATE
    SET company_name = 'Test Corporation',
        email = 'client@test.com';

  RAISE NOTICE '✅ Client profile created';
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '✅ SUCCESS! You can now login with:';
  RAISE NOTICE '   Email: client@test.com';
  RAISE NOTICE '   Password: Test@123456';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

END $$;

-- Verify it worked
SELECT 
  '✅ Setup Complete!' as status,
  au.email,
  ur.role,
  ur.account_status,
  dc.company_name
FROM auth.users au
JOIN user_roles ur ON ur.user_id = au.id
LEFT JOIN dsa_clients dc ON dc.user_id = ur.id
WHERE au.email = 'client@test.com';
