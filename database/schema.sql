-- ============================================================
--  NextGen HRMS — Complete Database Schema
--  Platform  : Supabase (PostgreSQL 15+)
--  Created   : 2026-07-04
--  Run this entire file in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ============================================================
-- STEP 0 — Enable Required Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- uuid_generate_v4()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";       -- crypt(), gen_salt()


-- ============================================================
-- STEP 1 — DROP TABLES (clean slate, safe for re-runs)
-- ============================================================
DROP TABLE IF EXISTS public.holidays         CASCADE;
DROP TABLE IF EXISTS public.leave_balances   CASCADE;
DROP TABLE IF EXISTS public.leave_requests   CASCADE;
DROP TABLE IF EXISTS public.attendance       CASCADE;
DROP TABLE IF EXISTS public.salary           CASCADE;
DROP TABLE IF EXISTS public.documents        CASCADE;
DROP TABLE IF EXISTS public.employee_skills  CASCADE;
DROP TABLE IF EXISTS public.certifications   CASCADE;
DROP TABLE IF EXISTS public.employees        CASCADE;
DROP TABLE IF EXISTS public.company          CASCADE;


-- ============================================================
-- TABLE 1 — company
--   Single-row table for organisation-level settings.
-- ============================================================
CREATE TABLE public.company (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT        NOT NULL,
  logo_url     TEXT,                          -- URL from Supabase Storage
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.company        IS 'Organisation / company master record';
COMMENT ON COLUMN public.company.logo_url IS 'Profile logo stored in Supabase Storage bucket';


-- ============================================================
-- TABLE 2 — employees
--   Mirrors the user object from store.js / seed.js exactly.
--   auth_user_id links to Supabase Auth (auth.users).
-- ============================================================
CREATE TABLE public.employees (
  -- Identity
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id    UUID        UNIQUE,                       -- links to auth.users.id (nullable for seeded data)
  company_id      UUID        NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,

  -- Login
  login_id        TEXT        UNIQUE NOT NULL,              -- e.g. "OI-EMP-001"
  email           TEXT        UNIQUE NOT NULL,
  password_hash   TEXT        NOT NULL,                     -- bcrypt hash (use pgcrypto)
  role            TEXT        NOT NULL DEFAULT 'employee'
                              CHECK (role IN ('admin', 'employee')),

  -- Personal Info
  name            TEXT        NOT NULL,
  serial_no       INT         DEFAULT 0,
  phone           TEXT,
  address         TEXT,
  dob             DATE,
  about           TEXT,
  avatar_url      TEXT,                                     -- Supabase Storage URL
  account_number  TEXT,

  -- Job Info
  department      TEXT,
  designation     TEXT,
  join_date       DATE,

  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.employees              IS 'All system users — both admins and employees';
COMMENT ON COLUMN public.employees.login_id     IS 'Auto-generated ID like OI-EMP-2024-001';
COMMENT ON COLUMN public.employees.password_hash IS 'bcrypt hashed password via pgcrypto';
COMMENT ON COLUMN public.employees.auth_user_id IS 'Links to Supabase Auth user for JWT-based login';


-- ============================================================
-- TABLE 3 — salary
--   Stores complete salary breakdown per employee.
--   Mirrors store.js computeSalaryComponents() output exactly.
-- ============================================================
CREATE TABLE public.salary (
  id                  UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id         UUID    NOT NULL UNIQUE REFERENCES public.employees(id) ON DELETE CASCADE,

  -- Inputs (percentages / fixed values)
  monthly_wage        NUMERIC(12,2) NOT NULL DEFAULT 0,
  yearly_wage         NUMERIC(14,2) NOT NULL DEFAULT 0,
  working_days_per_week INT   NOT NULL DEFAULT 5,
  basic_pct           NUMERIC(5,2)  NOT NULL DEFAULT 50,
  hra_pct             NUMERIC(5,2)  NOT NULL DEFAULT 50,
  bonus_pct           NUMERIC(5,2)  NOT NULL DEFAULT 10,
  lta_pct             NUMERIC(5,2)  NOT NULL DEFAULT 5,
  lta_fixed           NUMERIC(12,2) NOT NULL DEFAULT 0,
  pf_employee_pct     NUMERIC(5,2)  NOT NULL DEFAULT 12,
  pf_employer_pct     NUMERIC(5,2)  NOT NULL DEFAULT 12,
  professional_tax    NUMERIC(10,2) NOT NULL DEFAULT 200,

  -- Computed values (auto-recalculated by trigger)
  basic               NUMERIC(12,2) NOT NULL DEFAULT 0,
  hra                 NUMERIC(12,2) NOT NULL DEFAULT 0,
  bonus               NUMERIC(12,2) NOT NULL DEFAULT 0,
  lta                 NUMERIC(12,2) NOT NULL DEFAULT 0,
  pf_emp              NUMERIC(12,2) NOT NULL DEFAULT 0,    -- Employee PF deduction
  pf_emr              NUMERIC(12,2) NOT NULL DEFAULT 0,    -- Employer PF contribution
  fixed_allowance     NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_allowances    NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_deductions    NUMERIC(12,2) NOT NULL DEFAULT 0,
  gross_pay           NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_salary          NUMERIC(12,2) NOT NULL DEFAULT 0,

  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.salary IS 'Salary structure with both input percentages and computed amounts per employee';


-- ============================================================
-- TABLE 4 — attendance
--   Daily attendance record per employee.
--   Mirrors store.js attendance structure exactly.
-- ============================================================
CREATE TABLE public.attendance (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id  UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,

  date         DATE        NOT NULL,
  check_in     TIME,                                        -- e.g. "09:15"
  check_out    TIME,                                        -- e.g. "18:30"
  work_hours   NUMERIC(5,2),                               -- calculated total hours
  extra_hours  NUMERIC(5,2),                               -- overtime beyond 8h
  status       TEXT        NOT NULL DEFAULT 'absent'
               CHECK (status IN ('present', 'absent', 'half-day', 'leave')),

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One record per employee per day
  UNIQUE (employee_id, date)
);

CREATE INDEX idx_attendance_employee_id ON public.attendance(employee_id);
CREATE INDEX idx_attendance_date        ON public.attendance(date);
CREATE INDEX idx_attendance_status      ON public.attendance(status);

COMMENT ON TABLE  public.attendance             IS 'Daily attendance log for all employees';
COMMENT ON COLUMN public.attendance.work_hours  IS 'Total hours worked = check_out - check_in';
COMMENT ON COLUMN public.attendance.extra_hours IS 'Hours beyond standard 8h working day';


-- ============================================================
-- TABLE 5 — leave_requests
--   Mirrors store.js leave structure including approval workflow.
-- ============================================================
CREATE TABLE public.leave_requests (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id    UUID        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  approved_by    UUID        REFERENCES public.employees(id),   -- Admin who approved/rejected

  leave_type     TEXT        NOT NULL
                 CHECK (leave_type IN ('paid', 'sick', 'unpaid')),
  start_date     DATE        NOT NULL,
  end_date       DATE        NOT NULL,
  allocation     INT         NOT NULL DEFAULT 1,               -- number of days
  remarks        TEXT,
  status         TEXT        NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_comment  TEXT,

  approved_at    TIMESTAMPTZ,
  rejected_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Validation: end_date must be >= start_date
  CONSTRAINT chk_leave_dates CHECK (end_date >= start_date)
);

CREATE INDEX idx_leave_employee_id ON public.leave_requests(employee_id);
CREATE INDEX idx_leave_status      ON public.leave_requests(status);
CREATE INDEX idx_leave_dates       ON public.leave_requests(start_date, end_date);

COMMENT ON TABLE  public.leave_requests              IS 'Employee leave requests with approval workflow';
COMMENT ON COLUMN public.leave_requests.allocation   IS 'Calculated number of calendar days for the leave';
COMMENT ON COLUMN public.leave_requests.approved_by  IS 'Admin employee ID who approved or rejected the request';


-- ============================================================
-- TABLE 6 — leave_balances
--   Tracks remaining paid / sick / unpaid leave per employee.
--   Mirrors store.js _initLeaveBalance() defaults.
-- ============================================================
CREATE TABLE public.leave_balances (
  id           UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id  UUID    NOT NULL UNIQUE REFERENCES public.employees(id) ON DELETE CASCADE,

  paid         INT     NOT NULL DEFAULT 24,     -- 24 paid leaves per year
  sick         INT     NOT NULL DEFAULT 7,      -- 7 sick leaves per year
  unpaid       INT     NOT NULL DEFAULT 999,    -- unlimited unpaid

  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.leave_balances IS 'Annual leave balance counters per employee';


-- ============================================================
-- TABLE 7 — employee_skills
--   Stores skills array (was stored inside user object in localStorage).
-- ============================================================
CREATE TABLE public.employee_skills (
  id           UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id  UUID    NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  skill        TEXT    NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (employee_id, skill)
);

CREATE INDEX idx_skills_employee_id ON public.employee_skills(employee_id);

COMMENT ON TABLE public.employee_skills IS 'Skills tags per employee (was array in localStorage)';


-- ============================================================
-- TABLE 8 — certifications
--   Stores certifications array (was stored inside user object).
-- ============================================================
CREATE TABLE public.certifications (
  id           UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id  UUID    NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  name         TEXT    NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (employee_id, name)
);

CREATE INDEX idx_certs_employee_id ON public.certifications(employee_id);

COMMENT ON TABLE public.certifications IS 'Professional certifications per employee';


-- ============================================================
-- TABLE 9 — documents
--   Stores employee uploaded documents (was empty array in localStorage).
-- ============================================================
CREATE TABLE public.documents (
  id           UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id  UUID    NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  name         TEXT    NOT NULL,
  file_url     TEXT    NOT NULL,    -- Supabase Storage URL
  file_type    TEXT,                -- MIME type e.g. "application/pdf"
  file_size    INT,                 -- bytes
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_docs_employee_id ON public.documents(employee_id);

COMMENT ON TABLE public.documents IS 'Employee uploaded documents stored in Supabase Storage';


-- ============================================================
-- TABLE 10 — holidays
--   Public / company holidays. Mirrors store.js saveHolidays().
-- ============================================================
CREATE TABLE public.holidays (
  id           UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id   UUID    NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  date         DATE    NOT NULL,
  name         TEXT    NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (company_id, date)
);

CREATE INDEX idx_holidays_date ON public.holidays(date);

COMMENT ON TABLE public.holidays IS 'Public and company-declared holidays';


-- ============================================================
-- STEP 2 — AUTO-UPDATE updated_at TRIGGER
--   Automatically sets updated_at = now() on any row update.
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply trigger to all tables that have updated_at
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'company', 'employees', 'salary',
    'attendance', 'leave_requests', 'leave_balances'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at
       BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();',
      tbl, tbl
    );
  END LOOP;
END;
$$;


-- ============================================================
-- STEP 3 — AUTO-COMPUTE SALARY TRIGGER
--   Recalculates all salary components whenever monthly_wage
--   or any percentage column changes.
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_compute_salary()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_wage   NUMERIC := COALESCE(NEW.monthly_wage, 0);
  v_basic  NUMERIC;
  v_hra    NUMERIC;
  v_bonus  NUMERIC;
  v_lta    NUMERIC;
  v_pf_emp NUMERIC;
  v_pf_emr NUMERIC;
  v_p_tax  NUMERIC;
  v_fixed  NUMERIC;
  v_gross  NUMERIC;
  v_net    NUMERIC;
BEGIN
  v_basic  := ROUND(v_wage  * COALESCE(NEW.basic_pct, 50)    / 100);
  v_hra    := ROUND(v_basic * COALESCE(NEW.hra_pct, 50)      / 100);
  v_bonus  := ROUND(v_basic * COALESCE(NEW.bonus_pct, 10)    / 100);
  v_lta    := CASE
                WHEN COALESCE(NEW.lta_fixed, 0) > 0
                THEN ROUND(NEW.lta_fixed)
                ELSE ROUND(v_basic * COALESCE(NEW.lta_pct, 5) / 100)
              END;
  v_pf_emp := ROUND(v_basic * COALESCE(NEW.pf_employee_pct, 12) / 100);
  v_pf_emr := ROUND(v_basic * COALESCE(NEW.pf_employer_pct, 12) / 100);
  v_p_tax  := COALESCE(NEW.professional_tax, 200);

  v_fixed  := GREATEST(0, v_wage - v_basic - (v_hra + v_bonus + v_lta) - v_pf_emr);
  v_gross  := v_basic + v_hra + v_bonus + v_lta + v_fixed;
  v_net    := v_gross - (v_pf_emp + v_p_tax);

  NEW.yearly_wage      := v_wage * 12;
  NEW.basic            := v_basic;
  NEW.hra              := v_hra;
  NEW.bonus            := v_bonus;
  NEW.lta              := v_lta;
  NEW.pf_emp           := v_pf_emp;
  NEW.pf_emr           := v_pf_emr;
  NEW.fixed_allowance  := v_fixed;
  NEW.total_allowances := v_hra + v_bonus + v_lta;
  NEW.total_deductions := v_pf_emp + v_p_tax;
  NEW.gross_pay        := v_gross;
  NEW.net_salary       := v_net;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_salary_compute
BEFORE INSERT OR UPDATE ON public.salary
FOR EACH ROW EXECUTE FUNCTION public.fn_compute_salary();


-- ============================================================
-- STEP 4 — AUTO-INIT LEAVE BALANCE TRIGGER
--   Creates a leave_balance row whenever a new employee is added.
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_init_leave_balance()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.leave_balances (employee_id)
  VALUES (NEW.id)
  ON CONFLICT (employee_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_employee_leave_balance
AFTER INSERT ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.fn_init_leave_balance();


-- ============================================================
-- STEP 5 — AUTO-MARK ATTENDANCE ON LEAVE APPROVAL TRIGGER
--   When a leave_request status changes to 'approved',
--   automatically marks all days in the range as 'leave'
--   in the attendance table.
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_mark_leave_attendance()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  cur_date DATE;
BEGIN
  -- Only run when status changes TO 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    cur_date := NEW.start_date;
    WHILE cur_date <= NEW.end_date LOOP
      INSERT INTO public.attendance (employee_id, date, status)
      VALUES (NEW.employee_id, cur_date, 'leave')
      ON CONFLICT (employee_id, date)
      DO UPDATE SET status = 'leave', updated_at = now();

      cur_date := cur_date + INTERVAL '1 day';
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_leave_mark_attendance
AFTER UPDATE ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION public.fn_mark_leave_attendance();


-- ============================================================
-- STEP 6 — ROW LEVEL SECURITY (RLS)
--   Enforces Admin vs Employee access at database level.
--   Supabase uses auth.uid() to identify the current user.
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.employees       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_balances  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certifications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays        ENABLE ROW LEVEL SECURITY;


-- Helper function: check if current user is admin
CREATE OR REPLACE FUNCTION public.fn_is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employees
    WHERE auth_user_id = auth.uid() AND role = 'admin'
  );
$$;

-- Helper function: get current employee id
CREATE OR REPLACE FUNCTION public.fn_current_employee_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id FROM public.employees WHERE auth_user_id = auth.uid() LIMIT 1;
$$;


-- employees RLS
CREATE POLICY "employees_admin_all"   ON public.employees FOR ALL    USING (public.fn_is_admin());
CREATE POLICY "employees_self_select" ON public.employees FOR SELECT USING (auth_user_id = auth.uid());
CREATE POLICY "employees_self_update" ON public.employees FOR UPDATE USING (auth_user_id = auth.uid());

-- salary RLS
CREATE POLICY "salary_admin_all"   ON public.salary FOR ALL    USING (public.fn_is_admin());
CREATE POLICY "salary_self_select" ON public.salary FOR SELECT
  USING (employee_id = public.fn_current_employee_id());

-- attendance RLS
CREATE POLICY "attendance_admin_all"   ON public.attendance FOR ALL    USING (public.fn_is_admin());
CREATE POLICY "attendance_self_select" ON public.attendance FOR SELECT
  USING (employee_id = public.fn_current_employee_id());
CREATE POLICY "attendance_self_insert" ON public.attendance FOR INSERT
  WITH CHECK (employee_id = public.fn_current_employee_id());
CREATE POLICY "attendance_self_update" ON public.attendance FOR UPDATE
  USING (employee_id = public.fn_current_employee_id());

-- leave_requests RLS
CREATE POLICY "leave_admin_all"   ON public.leave_requests FOR ALL    USING (public.fn_is_admin());
CREATE POLICY "leave_self_select" ON public.leave_requests FOR SELECT
  USING (employee_id = public.fn_current_employee_id());
CREATE POLICY "leave_self_insert" ON public.leave_requests FOR INSERT
  WITH CHECK (employee_id = public.fn_current_employee_id());

-- leave_balances RLS
CREATE POLICY "balance_admin_all"   ON public.leave_balances FOR ALL    USING (public.fn_is_admin());
CREATE POLICY "balance_self_select" ON public.leave_balances FOR SELECT
  USING (employee_id = public.fn_current_employee_id());

-- employee_skills RLS
CREATE POLICY "skills_admin_all"   ON public.employee_skills FOR ALL    USING (public.fn_is_admin());
CREATE POLICY "skills_self_all"    ON public.employee_skills FOR ALL
  USING (employee_id = public.fn_current_employee_id());

-- certifications RLS
CREATE POLICY "certs_admin_all"    ON public.certifications FOR ALL    USING (public.fn_is_admin());
CREATE POLICY "certs_self_all"     ON public.certifications FOR ALL
  USING (employee_id = public.fn_current_employee_id());

-- documents RLS
CREATE POLICY "docs_admin_all"     ON public.documents FOR ALL    USING (public.fn_is_admin());
CREATE POLICY "docs_self_all"      ON public.documents FOR ALL
  USING (employee_id = public.fn_current_employee_id());

-- company and holidays: public read (app uses custom password auth, not Supabase Auth,
-- so auth.uid() is always null — we allow anonymous reads for these safe tables)
CREATE POLICY "company_read_public"  ON public.company   FOR SELECT USING (true);
CREATE POLICY "company_admin_write"  ON public.company   FOR ALL    USING (public.fn_is_admin());
CREATE POLICY "holidays_read_public" ON public.holidays  FOR SELECT USING (true);
CREATE POLICY "holidays_admin_write" ON public.holidays  FOR ALL    USING (public.fn_is_admin());

-- Grant anon role access to execute custom auth functions and read safe tables
GRANT EXECUTE ON FUNCTION public.fn_verify_password TO anon;
GRANT EXECUTE ON FUNCTION public.fn_is_admin TO anon;
GRANT EXECUTE ON FUNCTION public.fn_current_employee_id TO anon;
GRANT SELECT ON public.company  TO anon;
GRANT SELECT ON public.holidays TO anon;


-- ============================================================
-- STEP 7 — SEED DATA
--   Matches seed.js exactly: 1 company, 1 admin, 7 employees,
--   salary, leave balances, holidays.
-- ============================================================

-- Company
INSERT INTO public.company (id, name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Odoo India');

-- Admin
INSERT INTO public.employees (
  id, company_id, login_id, email, password_hash, role,
  name, serial_no, phone, address, dob, department, designation,
  join_date, account_number, about
) VALUES (
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'admin@hrms.com', 'admin@hrms.com',
  crypt('Admin@123', gen_salt('bf')),
  'admin',
  'Admin User', 0, '+91 98765 00000', 'Mumbai, Maharashtra',
  '1985-05-15', 'Administration', 'HR Manager',
  '2022-01-01', 'HDFC001122334',
  'Managing HR operations and company administration.'
);

-- Admin salary (trigger auto-computes all fields)
INSERT INTO public.salary (employee_id, monthly_wage, basic_pct, hra_pct, bonus_pct, lta_pct, pf_employee_pct, pf_employer_pct, professional_tax, working_days_per_week)
VALUES ('10000000-0000-0000-0000-000000000001', 120000, 50, 50, 10, 5, 12, 12, 200, 5);

-- Admin skills
INSERT INTO public.employee_skills (employee_id, skill) VALUES
  ('10000000-0000-0000-0000-000000000001', 'HR Management'),
  ('10000000-0000-0000-0000-000000000001', 'Recruitment'),
  ('10000000-0000-0000-0000-000000000001', 'Payroll');

-- Admin certifications
INSERT INTO public.certifications (employee_id, name) VALUES
  ('10000000-0000-0000-0000-000000000001', 'SHRM-CP'),
  ('10000000-0000-0000-0000-000000000001', 'PHR');


-- 7 Employees
INSERT INTO public.employees (
  id, company_id, login_id, email, password_hash, role,
  name, serial_no, phone, address, dob, department, designation,
  join_date, account_number, about
) VALUES
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
   'OIJODO2024001', 'john.doe@hrms.com',   crypt('Pass@123', gen_salt('bf')), 'employee',
   'John Doe',    1, '+91 98765 10001', 'Mumbai, MH',    '1992-01-10',
   'Engineering', 'Software Engineer',   '2024-01-15', 'HDFC000100000',
   'Experienced Software Engineer with a passion for delivering high-quality results.'),

  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
   'OISASM2024002', 'sarah.smith@hrms.com', crypt('Pass@123', gen_salt('bf')), 'employee',
   'Sarah Smith', 2, '+91 98765 10002', 'Delhi, DL',     '1993-02-11',
   'Design',      'UI/UX Designer',       '2024-03-01', 'HDFC000100001',
   'Experienced UI/UX Designer with a passion for delivering high-quality results.'),

  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001',
   'OIRAVE2024003', 'rahul.verma@hrms.com', crypt('Pass@123', gen_salt('bf')), 'employee',
   'Rahul Verma', 3, '+91 98765 10003', 'Bangalore, KA', '1994-03-12',
   'Engineering', 'Backend Developer',    '2024-02-10', 'HDFC000100002',
   'Experienced Backend Developer with a passion for delivering high-quality results.'),

  ('20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001',
   'OIPRSH2024004', 'priya.sharma@hrms.com',crypt('Pass@123', gen_salt('bf')), 'employee',
   'Priya Sharma',4, '+91 98765 10004', 'Pune, MH',      '1995-04-13',
   'Marketing',   'Marketing Executive',  '2024-04-01', 'HDFC000100003',
   'Experienced Marketing Executive with a passion for delivering high-quality results.'),

  ('20000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001',
   'OIAMKU2024005', 'amit.kumar@hrms.com',  crypt('Pass@123', gen_salt('bf')), 'employee',
   'Amit Kumar',  5, '+91 98765 10005', 'Chennai, TN',   '1996-05-14',
   'Sales',       'Sales Manager',        '2024-01-20', 'HDFC000100004',
   'Experienced Sales Manager with a passion for delivering high-quality results.'),

  ('20000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001',
   'OINEGU2024006', 'neha.gupta@hrms.com',  crypt('Pass@123', gen_salt('bf')), 'employee',
   'Neha Gupta',  6, '+91 98765 10006', 'Hyderabad, TS', '1997-06-15',
   'Finance',     'Finance Analyst',      '2024-05-01', 'HDFC000100005',
   'Experienced Finance Analyst with a passion for delivering high-quality results.'),

  ('20000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001',
   'OIVISI2024007', 'vikram.singh@hrms.com', crypt('Pass@123', gen_salt('bf')), 'employee',
   'Vikram Singh',7, '+91 98765 10007', 'Kolkata, WB',   '1998-07-16',
   'Engineering', 'DevOps Engineer',      '2024-03-15', 'HDFC000100006',
   'Experienced DevOps Engineer with a passion for delivering high-quality results.');


-- Employee salaries (trigger auto-computes all fields)
INSERT INTO public.salary (employee_id, monthly_wage, basic_pct, hra_pct, bonus_pct, lta_pct, pf_employee_pct, pf_employer_pct, professional_tax, working_days_per_week)
VALUES
  ('20000000-0000-0000-0000-000000000001', 75000, 50, 50, 10, 5, 12, 12, 200, 5),
  ('20000000-0000-0000-0000-000000000002', 65000, 50, 50, 10, 5, 12, 12, 200, 5),
  ('20000000-0000-0000-0000-000000000003', 80000, 50, 50, 10, 5, 12, 12, 200, 5),
  ('20000000-0000-0000-0000-000000000004', 55000, 50, 50, 10, 5, 12, 12, 200, 5),
  ('20000000-0000-0000-0000-000000000005', 70000, 50, 50, 10, 5, 12, 12, 200, 5),
  ('20000000-0000-0000-0000-000000000006', 68000, 50, 50, 10, 5, 12, 12, 200, 5),
  ('20000000-0000-0000-0000-000000000007', 85000, 50, 50, 10, 5, 12, 12, 200, 5);


-- Employee skills
INSERT INTO public.employee_skills (employee_id, skill) VALUES
  ('20000000-0000-0000-0000-000000000001', 'JavaScript'),
  ('20000000-0000-0000-0000-000000000001', 'React'),
  ('20000000-0000-0000-0000-000000000001', 'Node.js'),
  ('20000000-0000-0000-0000-000000000002', 'Figma'),
  ('20000000-0000-0000-0000-000000000002', 'Photoshop'),
  ('20000000-0000-0000-0000-000000000002', 'Sketch'),
  ('20000000-0000-0000-0000-000000000003', 'Python'),
  ('20000000-0000-0000-0000-000000000003', 'Django'),
  ('20000000-0000-0000-0000-000000000003', 'PostgreSQL'),
  ('20000000-0000-0000-0000-000000000004', 'SEO'),
  ('20000000-0000-0000-0000-000000000004', 'Content'),
  ('20000000-0000-0000-0000-000000000004', 'Analytics'),
  ('20000000-0000-0000-0000-000000000005', 'CRM'),
  ('20000000-0000-0000-0000-000000000005', 'Negotiation'),
  ('20000000-0000-0000-0000-000000000005', 'Leadership'),
  ('20000000-0000-0000-0000-000000000006', 'Excel'),
  ('20000000-0000-0000-0000-000000000006', 'Power BI'),
  ('20000000-0000-0000-0000-000000000006', 'Accounting'),
  ('20000000-0000-0000-0000-000000000007', 'Docker'),
  ('20000000-0000-0000-0000-000000000007', 'Kubernetes'),
  ('20000000-0000-0000-0000-000000000007', 'AWS');


-- Employee certifications
INSERT INTO public.certifications (employee_id, name) VALUES
  ('20000000-0000-0000-0000-000000000001', 'AWS CCP'),
  ('20000000-0000-0000-0000-000000000002', 'Adobe CC'),
  ('20000000-0000-0000-0000-000000000003', 'MongoDB Associate'),
  ('20000000-0000-0000-0000-000000000004', 'Google Analytics'),
  ('20000000-0000-0000-0000-000000000005', 'HubSpot Sales'),
  ('20000000-0000-0000-0000-000000000006', 'CFA Level 1'),
  ('20000000-0000-0000-0000-000000000007', 'CKA');


-- Leave requests (matches seed.js exactly)
INSERT INTO public.leave_requests (employee_id, leave_type, start_date, end_date, allocation, remarks, status, admin_comment, approved_by) VALUES
  ('20000000-0000-0000-0000-000000000001', 'paid',   '2024-12-23', '2024-12-26', 4, 'Family vacation',           'approved', '',                           '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002', 'sick',   '2024-12-10', '2024-12-11', 2, 'Fever and cold',            'approved', 'Get well soon!',             '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000003', 'paid',   '2025-01-02', '2025-01-03', 2, 'New year extension',        'rejected', 'Insufficient team coverage', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000004', 'unpaid', '2025-01-15', '2025-01-15', 1, 'Personal emergency',        'approved', '',                           '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000005', 'sick',   '2025-01-20', '2025-01-21', 2, 'Medical appointment',       'pending',  '', NULL),
  ('20000000-0000-0000-0000-000000000006', 'paid',   '2025-02-14', '2025-02-17', 4, 'Valentines trip',           'pending',  '', NULL),
  ('20000000-0000-0000-0000-000000000007', 'paid',   '2025-03-01', '2025-03-05', 5, 'Annual leave',              'pending',  '', NULL),
  ('20000000-0000-0000-0000-000000000001', 'sick',   '2025-01-08', '2025-01-08', 1, 'Doctor visit',              'approved', '',                           '10000000-0000-0000-0000-000000000001');


-- Public holidays (matches seed.js exactly)
INSERT INTO public.holidays (company_id, date, name) VALUES
  ('00000000-0000-0000-0000-000000000001', '2025-01-26', 'Republic Day'),
  ('00000000-0000-0000-0000-000000000001', '2025-03-31', 'Eid ul-Fitr'),
  ('00000000-0000-0000-0000-000000000001', '2025-04-14', 'Ambedkar Jayanti'),
  ('00000000-0000-0000-0000-000000000001', '2025-04-18', 'Good Friday'),
  ('00000000-0000-0000-0000-000000000001', '2025-05-01', 'Labour Day'),
  ('00000000-0000-0000-0000-000000000001', '2025-08-15', 'Independence Day'),
  ('00000000-0000-0000-0000-000000000001', '2025-10-02', 'Gandhi Jayanti'),
  ('00000000-0000-0000-0000-000000000001', '2025-10-24', 'Dussehra'),
  ('00000000-0000-0000-0000-000000000001', '2025-11-01', 'Diwali'),
  ('00000000-0000-0000-0000-000000000001', '2025-12-25', 'Christmas');


-- ============================================================
-- STEP 8 — USEFUL VIEWS
-- ============================================================

-- View: full employee with salary and leave balance in one row
CREATE OR REPLACE VIEW public.v_employee_full AS
SELECT
  e.*,
  s.monthly_wage, s.net_salary, s.gross_pay, s.basic,
  s.hra, s.bonus, s.lta, s.pf_emp, s.total_deductions,
  lb.paid   AS leave_paid_balance,
  lb.sick   AS leave_sick_balance,
  lb.unpaid AS leave_unpaid_balance
FROM public.employees e
LEFT JOIN public.salary         s  ON s.employee_id  = e.id
LEFT JOIN public.leave_balances lb ON lb.employee_id = e.id;

-- View: who is present / absent TODAY
CREATE OR REPLACE VIEW public.v_today_attendance AS
SELECT
  e.id AS employee_id,
  e.name,
  e.department,
  e.designation,
  e.avatar_url,
  COALESCE(a.status, 'absent') AS status,
  a.check_in,
  a.check_out,
  a.work_hours
FROM public.employees e
LEFT JOIN public.attendance a
  ON a.employee_id = e.id AND a.date = CURRENT_DATE
WHERE e.role = 'employee';

-- View: all pending leave requests with employee info
CREATE OR REPLACE VIEW public.v_pending_leaves AS
SELECT
  lr.*,
  e.name        AS employee_name,
  e.department  AS employee_department,
  e.avatar_url  AS employee_avatar
FROM public.leave_requests lr
JOIN public.employees e ON e.id = lr.employee_id
WHERE lr.status = 'pending'
ORDER BY lr.created_at DESC;


-- ============================================================
-- DONE
-- Tables   : company, employees, salary, attendance,
--            leave_requests, leave_balances, employee_skills,
--            certifications, documents, holidays  (10 total)
-- Triggers : auto updated_at, salary compute, leave balance
--            init, leave approval -> attendance sync  (4 total)
-- RLS      : Admin = full access | Employee = own data only
-- Views    : v_employee_full, v_today_attendance, v_pending_leaves
-- Seed     : 1 admin + 7 employees + salary + leaves + holidays
-- ============================================================
