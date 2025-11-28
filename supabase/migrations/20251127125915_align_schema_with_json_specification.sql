/*
  # Align Database Schema with JSON Specification
  
  1. Table Updates
    - Add missing fields to dsa_clients (commission_rate)
    - Add missing fields to loan_applications (assigned_credit_analyst, lender decision fields, ai_file_summary)
    - Add missing fields to commission_ledger (dispute_status, payout_request)
    - Create admin_activity_log table
    - Create daily_summary_reports table
    
  2. Field Enhancements
    - Update status options to match JSON specification
    - Add lender decision tracking fields
    - Add AI summary field
    
  3. Security
    - Enable RLS on new tables
    - Add appropriate policies
*/

-- Add commission_rate to dsa_clients
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dsa_clients' AND column_name = 'commission_rate'
  ) THEN
    ALTER TABLE dsa_clients ADD COLUMN commission_rate numeric DEFAULT 0.01;
  END IF;
END $$;

-- Add missing fields to loan_applications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loan_applications' AND column_name = 'assigned_credit_analyst'
  ) THEN
    ALTER TABLE loan_applications ADD COLUMN assigned_credit_analyst uuid REFERENCES user_roles(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loan_applications' AND column_name = 'applicant_name'
  ) THEN
    ALTER TABLE loan_applications ADD COLUMN applicant_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loan_applications' AND column_name = 'requested_loan_amount'
  ) THEN
    ALTER TABLE loan_applications ADD COLUMN requested_loan_amount numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loan_applications' AND column_name = 'lender_decision_status'
  ) THEN
    ALTER TABLE loan_applications ADD COLUMN lender_decision_status text DEFAULT 'Pending' 
      CHECK (lender_decision_status IN ('Pending', 'Approved', 'Rejected', 'Needs Clarification'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loan_applications' AND column_name = 'lender_decision_date'
  ) THEN
    ALTER TABLE loan_applications ADD COLUMN lender_decision_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loan_applications' AND column_name = 'lender_decision_remarks'
  ) THEN
    ALTER TABLE loan_applications ADD COLUMN lender_decision_remarks text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loan_applications' AND column_name = 'approved_loan_amount'
  ) THEN
    ALTER TABLE loan_applications ADD COLUMN approved_loan_amount numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loan_applications' AND column_name = 'ai_file_summary'
  ) THEN
    ALTER TABLE loan_applications ADD COLUMN ai_file_summary text;
  END IF;
END $$;

-- Add missing fields to commission_ledger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commission_ledger' AND column_name = 'date'
  ) THEN
    ALTER TABLE commission_ledger ADD COLUMN date date DEFAULT CURRENT_DATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commission_ledger' AND column_name = 'disbursed_amount'
  ) THEN
    ALTER TABLE commission_ledger ADD COLUMN disbursed_amount numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commission_ledger' AND column_name = 'commission_rate'
  ) THEN
    ALTER TABLE commission_ledger ADD COLUMN commission_rate numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commission_ledger' AND column_name = 'dispute_status'
  ) THEN
    ALTER TABLE commission_ledger ADD COLUMN dispute_status text DEFAULT 'None'
      CHECK (dispute_status IN ('None', 'Under Query', 'Resolved'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commission_ledger' AND column_name = 'payout_request_flag'
  ) THEN
    ALTER TABLE commission_ledger ADD COLUMN payout_request_flag boolean DEFAULT false;
  END IF;
END $$;

-- Create Admin Activity Log table
CREATE TABLE IF NOT EXISTS admin_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp timestamptz DEFAULT now(),
  performed_by uuid REFERENCES user_roles(id),
  action_type text NOT NULL CHECK (action_type IN (
    'User Created',
    'User Role Changed',
    'User Deactivated',
    'Client Added',
    'Modules Configuration Changed',
    'Login Attempt',
    'Login Success',
    'Login Failure',
    'Password Reset',
    'System Config Changed'
  )),
  description text,
  target_entity text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only credit team and admins can view activity log"
  ON admin_activity_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role IN ('credit_team', 'kam')
    )
  );

CREATE POLICY "System can insert activity log entries"
  ON admin_activity_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create Daily Summary Reports table
CREATE TABLE IF NOT EXISTS daily_summary_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date date NOT NULL UNIQUE,
  summary_content text,
  generated_timestamp timestamptz DEFAULT now(),
  delivered_to text[] DEFAULT ARRAY['Dashboard']::text[],
  metrics jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE daily_summary_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "KAM and Credit can view daily reports"
  ON daily_summary_reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role IN ('credit_team', 'kam')
    )
  );

CREATE POLICY "System can create daily reports"
  ON daily_summary_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'credit_team'
    )
  );

-- Add helpful indexes
CREATE INDEX IF NOT EXISTS idx_loan_applications_applicant_name ON loan_applications(applicant_name);
CREATE INDEX IF NOT EXISTS idx_loan_applications_assigned_credit_analyst ON loan_applications(assigned_credit_analyst);
CREATE INDEX IF NOT EXISTS idx_loan_applications_lender_decision_status ON loan_applications(lender_decision_status);
CREATE INDEX IF NOT EXISTS idx_commission_ledger_date ON commission_ledger(date);
CREATE INDEX IF NOT EXISTS idx_commission_ledger_dispute_status ON commission_ledger(dispute_status);
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_timestamp ON admin_activity_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_performed_by ON admin_activity_log(performed_by);
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_action_type ON admin_activity_log(action_type);
CREATE INDEX IF NOT EXISTS idx_daily_summary_reports_date ON daily_summary_reports(report_date);

-- Update audit_logs to include target_user_role if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'target_user_role'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN target_user_role text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'resolved'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN resolved boolean DEFAULT false;
  END IF;
END $$;

-- Add last_login to user_roles for tracking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_roles' AND column_name = 'last_login'
  ) THEN
    ALTER TABLE user_roles ADD COLUMN last_login timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_roles' AND column_name = 'account_status'
  ) THEN
    ALTER TABLE user_roles ADD COLUMN account_status text DEFAULT 'Active'
      CHECK (account_status IN ('Active', 'Locked', 'Disabled'));
  END IF;
END $$;

-- Add status tracking to various user tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nbfc_partners' AND column_name = 'address_region'
  ) THEN
    ALTER TABLE nbfc_partners ADD COLUMN address_region text;
  END IF;
END $$;
