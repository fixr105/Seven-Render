-- Clean Placeholder/Test Data from Database
-- Run this script to remove all test/placeholder data before importing real data

-- ============================================================
-- STEP 1: Remove Test Loan Applications
-- ============================================================
DELETE FROM loan_applications 
WHERE file_number LIKE 'SF%' 
  AND (
    applicant_name = 'Test Applicant' 
    OR applicant_name LIKE 'Test%'
    OR form_data::text LIKE '%Test%'
  );

-- ============================================================
-- STEP 2: Remove Test Commission Ledger Entries
-- ============================================================
DELETE FROM commission_ledger 
WHERE description LIKE '%Test%' 
   OR description LIKE '%demonstration%'
   OR description LIKE '%sample%';

-- ============================================================
-- STEP 3: Remove Test Clients (but keep real users)
-- ============================================================
-- Only delete if they have test email patterns
DELETE FROM dsa_clients 
WHERE email LIKE '%@test.com'
   OR email LIKE '%test%'
   OR company_name LIKE '%Test%'
   OR company_name LIKE '%Dummy%';

-- ============================================================
-- STEP 4: Remove Test NBFC Partners
-- ============================================================
DELETE FROM nbfc_partners 
WHERE email LIKE '%@test.com'
   OR email LIKE '%test%'
   OR name LIKE '%Test%'
   OR name LIKE '%Dummy%';

-- ============================================================
-- STEP 5: Remove Test Audit Logs
-- ============================================================
DELETE FROM audit_logs 
WHERE message LIKE '%Test%'
   OR message LIKE '%sample%'
   OR message LIKE '%demonstration%';

-- ============================================================
-- STEP 6: Remove Test Queries
-- ============================================================
DELETE FROM queries 
WHERE query_text LIKE '%Test%'
   OR query_text LIKE '%sample%';

-- ============================================================
-- STEP 7: Remove Test Admin Activity Logs
-- ============================================================
DELETE FROM admin_activity_log 
WHERE description LIKE '%Test%'
   OR description LIKE '%sample%'
   OR target_entity LIKE '%test%';

-- ============================================================
-- STEP 8: Remove Test Notifications
-- ============================================================
DELETE FROM notifications 
WHERE message LIKE '%Test%'
   OR message LIKE '%sample%';

-- ============================================================
-- STEP 9: Remove Test Payout Requests
-- ============================================================
DELETE FROM payout_requests 
WHERE description LIKE '%Test%'
   OR description LIKE '%sample%';

-- ============================================================
-- VERIFICATION: Check remaining data counts
-- ============================================================
SELECT 
  'loan_applications' as table_name,
  COUNT(*) as remaining_count
FROM loan_applications
UNION ALL
SELECT 
  'dsa_clients',
  COUNT(*)
FROM dsa_clients
UNION ALL
SELECT 
  'commission_ledger',
  COUNT(*)
FROM commission_ledger
UNION ALL
SELECT 
  'nbfc_partners',
  COUNT(*)
FROM nbfc_partners
UNION ALL
SELECT 
  'audit_logs',
  COUNT(*)
FROM audit_logs
UNION ALL
SELECT 
  'queries',
  COUNT(*)
FROM queries
UNION ALL
SELECT 
  'admin_activity_log',
  COUNT(*)
FROM admin_activity_log;

