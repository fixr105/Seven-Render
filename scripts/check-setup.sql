-- Quick Setup Check Script
-- Run this in Supabase SQL Editor to diagnose login issues

-- ============================================================
-- CHECK 1: Auth Users Exist and Are Confirmed
-- ============================================================

SELECT 
  'Auth Users Status' as check_type,
  email,
  CASE 
    WHEN email_confirmed_at IS NULL THEN '❌ NOT CONFIRMED - This will cause login failure!'
    ELSE '✅ CONFIRMED - OK'
  END as confirmation_status,
  created_at
FROM auth.users 
WHERE email LIKE '%@test.com' OR email LIKE '%@demo.com'
ORDER BY email;

-- ============================================================
-- CHECK 2: User Roles Created
-- ============================================================

SELECT 
  'User Roles Status' as check_type,
  au.email,
  ur.role,
  ur.account_status,
  CASE 
    WHEN ur.id IS NULL THEN '❌ NO ROLE - Run setup script!'
    ELSE '✅ ROLE EXISTS - OK'
  END as role_status
FROM auth.users au
LEFT JOIN user_roles ur ON ur.user_id = au.id
WHERE au.email LIKE '%@test.com' OR au.email LIKE '%@demo.com'
ORDER BY au.email;

-- ============================================================
-- CHECK 3: Client Profiles Created
-- ============================================================

SELECT 
  'Client Profiles Status' as check_type,
  au.email,
  dc.company_name,
  dc.is_active,
  CASE 
    WHEN dc.id IS NULL THEN '❌ NO PROFILE - Run setup script!'
    ELSE '✅ PROFILE EXISTS - OK'
  END as profile_status
FROM auth.users au
LEFT JOIN user_roles ur ON ur.user_id = au.id
LEFT JOIN dsa_clients dc ON dc.user_id = ur.id
WHERE au.email LIKE '%@test.com' OR au.email LIKE '%@demo.com'
  AND ur.role = 'client'
ORDER BY au.email;

-- ============================================================
-- CHECK 4: Complete Setup Status Summary
-- ============================================================

SELECT 
  au.email,
  CASE WHEN au.email_confirmed_at IS NOT NULL THEN '✅' ELSE '❌' END as email_confirmed,
  CASE WHEN ur.id IS NOT NULL THEN '✅' ELSE '❌' END as role_exists,
  CASE WHEN dc.id IS NOT NULL THEN '✅' ELSE '❌' END as profile_exists,
  CASE 
    WHEN au.email_confirmed_at IS NULL THEN 'Email not confirmed - Delete and recreate with Auto Confirm checked'
    WHEN ur.id IS NULL THEN 'Role missing - Run setup script'
    WHEN dc.id IS NULL AND ur.role = 'client' THEN 'Client profile missing - Run setup script'
    ELSE '✅ Ready to login!'
  END as status_message
FROM auth.users au
LEFT JOIN user_roles ur ON ur.user_id = au.id
LEFT JOIN dsa_clients dc ON dc.user_id = ur.id
WHERE au.email LIKE '%@test.com' OR au.email LIKE '%@demo.com'
ORDER BY au.email;

-- ============================================================
-- QUICK FIX: Create Missing Role for Existing User
-- ============================================================

-- If you see "❌ NO ROLE" above, replace USER_EMAIL and USER_UUID below:

/*
DO $$
DECLARE
  user_email text := 'client@test.com';  -- Change this
  user_uuid uuid := 'PASTE_UUID_HERE';   -- Get from: SELECT id FROM auth.users WHERE email = 'client@test.com';
  role_id uuid;
BEGIN
  -- Create role
  INSERT INTO user_roles (user_id, role, account_status)
  VALUES (user_uuid, 'client', 'Active')
  ON CONFLICT (user_id) DO NOTHING
  RETURNING id INTO role_id;

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
    user_email,
    '+91 9876543210',
    0.015,
    '{"ledger": true, "queries": true, "applications": true, "form_builder": true}'::jsonb,
    true
  )
  ON CONFLICT (user_id) DO NOTHING;

  RAISE NOTICE '✅ Role and profile created for %', user_email;
END $$;
*/
