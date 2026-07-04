-- ============================================================
--  NextGen HRMS — Stored Procedures & Helper Functions
--  Platform  : Supabase (PostgreSQL 15+)
--  Run AFTER schema.sql
--  File      : database/functions.sql
-- ============================================================


-- ============================================================
-- FN 1 — fn_generate_login_id
--   Mirrors Utils.generateLoginId() from utils.js exactly.
--   Format: [CompanyInitials][Fn2][Ln2][Year][000Serial]
--   Example: OIJODO2024001
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_generate_login_id(
  p_company_name  TEXT,
  p_first_name    TEXT,
  p_last_name     TEXT,
  p_join_year     INT,
  p_serial_no     INT
)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_initials TEXT;
  v_fn       TEXT;
  v_ln       TEXT;
  v_yr       TEXT;
  v_sn       TEXT;
BEGIN
  -- Company initials (first letter of each word, max 4 chars, uppercased)
  SELECT string_agg(UPPER(LEFT(word, 1)), '')
  INTO   v_initials
  FROM   unnest(regexp_split_to_array(TRIM(COALESCE(p_company_name, 'HR')), '\s+')) AS word;
  v_initials := LEFT(COALESCE(v_initials, 'HR'), 4);

  -- First 2 chars of first name, uppercase, padded with 'X'
  v_fn := UPPER(LEFT(regexp_replace(COALESCE(p_first_name, ''), '\s+', '', 'g'), 2));
  v_fn := RPAD(v_fn, 2, 'X');

  -- First 2 chars of last name, uppercase, padded with 'X'
  v_ln := UPPER(LEFT(regexp_replace(COALESCE(p_last_name, ''), '\s+', '', 'g'), 2));
  v_ln := RPAD(v_ln, 2, 'X');

  -- Year and serial
  v_yr := COALESCE(p_join_year::TEXT, EXTRACT(YEAR FROM now())::TEXT);
  v_sn := LPAD(p_serial_no::TEXT, 3, '0');

  RETURN v_initials || v_fn || v_ln || v_yr || v_sn;
END;
$$;

COMMENT ON FUNCTION public.fn_generate_login_id IS
  'Generates employee login IDs matching Utils.generateLoginId() format. Example: OIJODO2024001';


-- ============================================================
-- FN 2 — fn_next_serial
--   Returns next serial number for a company's employees.
--   Mirrors Utils.nextSerial() from utils.js.
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_next_serial(p_company_id UUID)
RETURNS INT LANGUAGE sql STABLE AS $$
  SELECT COALESCE(MAX(serial_no), 0) + 1
  FROM   public.employees
  WHERE  company_id = p_company_id AND role = 'employee';
$$;

COMMENT ON FUNCTION public.fn_next_serial IS
  'Returns the next employee serial number for a given company.';


-- ============================================================
-- FN 3 — fn_add_employee
--   Creates a full employee record with salary in one call.
--   Auto-generates login_id and returns the created record.
--   Called by admin when adding a new employee.
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_add_employee(
  p_company_id    UUID,
  p_first_name    TEXT,
  p_last_name     TEXT,
  p_email         TEXT,
  p_password      TEXT,   -- plain text; hashed inside this function
  p_phone         TEXT    DEFAULT NULL,
  p_department    TEXT    DEFAULT NULL,
  p_designation   TEXT    DEFAULT NULL,
  p_join_date     DATE    DEFAULT CURRENT_DATE,
  p_monthly_wage  NUMERIC DEFAULT 0,
  p_role          TEXT    DEFAULT 'employee'
)
RETURNS public.employees LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_serial    INT;
  v_login_id  TEXT;
  v_employee  public.employees;
  v_company   public.company;
BEGIN
  -- Get company info
  SELECT * INTO v_company FROM public.company WHERE id = p_company_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Company % not found', p_company_id; END IF;

  -- Generate serial and login ID
  v_serial   := public.fn_next_serial(p_company_id);
  v_login_id := public.fn_generate_login_id(
                  v_company.name, p_first_name, p_last_name,
                  EXTRACT(YEAR FROM p_join_date)::INT, v_serial
                );

  -- Create employee row (leave balance auto-created by trigger)
  INSERT INTO public.employees (
    company_id, login_id, email, password_hash, role,
    name, serial_no, phone, department, designation, join_date
  ) VALUES (
    p_company_id, v_login_id, LOWER(p_email),
    crypt(p_password, gen_salt('bf')),
    p_role,
    TRIM(p_first_name || ' ' || p_last_name),
    v_serial, p_phone, p_department, p_designation, p_join_date
  )
  RETURNING * INTO v_employee;

  -- Create salary if wage provided
  IF p_monthly_wage > 0 THEN
    INSERT INTO public.salary (employee_id, monthly_wage)
    VALUES (v_employee.id, p_monthly_wage);
  END IF;

  RETURN v_employee;
END;
$$;

COMMENT ON FUNCTION public.fn_add_employee IS
  'Creates a complete employee record with auto-generated login ID and salary. Mirrors the Add Employee modal logic.';


-- ============================================================
-- FN 4 — fn_verify_password
--   Authenticates a user by loginId or email + password.
--   Returns the employee row if credentials match, NULL otherwise.
--   Mirrors Auth.login() from auth.js.
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_verify_password(
  p_login_or_email TEXT,
  p_password       TEXT
)
RETURNS public.employees LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_employee public.employees;
BEGIN
  SELECT * INTO v_employee
  FROM   public.employees
  WHERE  LOWER(login_id) = LOWER(p_login_or_email)
      OR LOWER(email)    = LOWER(p_login_or_email)
  LIMIT 1;

  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Verify bcrypt hash
  IF v_employee.password_hash = crypt(p_password, v_employee.password_hash) THEN
    RETURN v_employee;
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.fn_verify_password IS
  'Verifies login credentials (loginId or email + password). Returns employee row on success, NULL on failure.';


-- ============================================================
-- FN 5 — fn_change_password
--   Allows an employee to change their own password.
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_change_password(
  p_employee_id   UUID,
  p_old_password  TEXT,
  p_new_password  TEXT
)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE
  v_hash TEXT;
BEGIN
  SELECT password_hash INTO v_hash FROM public.employees WHERE id = p_employee_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  -- Verify old password
  IF v_hash <> crypt(p_old_password, v_hash) THEN RETURN FALSE; END IF;

  -- Update with new hash
  UPDATE public.employees
  SET    password_hash = crypt(p_new_password, gen_salt('bf'))
  WHERE  id = p_employee_id;

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.fn_change_password IS
  'Securely changes an employee password after verifying the current one.';


-- ============================================================
-- FN 6 — fn_check_in
--   Records a check-in for today. Creates or updates attendance row.
--   Mirrors Store.checkIn() from store.js.
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_check_in(p_employee_id UUID)
RETURNS public.attendance LANGUAGE plpgsql AS $$
DECLARE
  v_today    DATE    := CURRENT_DATE;
  v_now_time TIME    := CURRENT_TIME;
  v_rec      public.attendance;
BEGIN
  INSERT INTO public.attendance (employee_id, date, check_in, status)
  VALUES (p_employee_id, v_today, v_now_time, 'present')
  ON CONFLICT (employee_id, date)
  DO UPDATE SET
    check_in   = EXCLUDED.check_in,
    status     = 'present',
    updated_at = now()
  RETURNING * INTO v_rec;

  RETURN v_rec;
END;
$$;

COMMENT ON FUNCTION public.fn_check_in IS
  'Records employee check-in for today. Mirrors Store.checkIn(). Idempotent — safe to call multiple times.';


-- ============================================================
-- FN 7 — fn_check_out
--   Records checkout, calculates work_hours and extra_hours.
--   Mirrors Store.checkOut() from store.js exactly.
--   Standard workday = 8 hours. Extra = max(0, worked - 8).
--   If worked >= 4h → present, else → half-day.
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_check_out(p_employee_id UUID)
RETURNS public.attendance LANGUAGE plpgsql AS $$
DECLARE
  v_today    DATE    := CURRENT_DATE;
  v_now_time TIME    := CURRENT_TIME;
  v_rec      public.attendance;
  v_worked   NUMERIC;
  v_extra    NUMERIC;
  v_status   TEXT;
BEGIN
  SELECT * INTO v_rec
  FROM   public.attendance
  WHERE  employee_id = p_employee_id AND date = v_today;

  IF NOT FOUND OR v_rec.check_in IS NULL THEN
    RAISE EXCEPTION 'No check-in found for today. Cannot check out.';
  END IF;

  -- Calculate hours worked
  v_worked := ROUND(
    EXTRACT(EPOCH FROM (v_now_time - v_rec.check_in)) / 3600.0,
    2
  );
  v_extra  := GREATEST(0, v_worked - 8);
  v_status := CASE WHEN v_worked >= 4 THEN 'present' ELSE 'half-day' END;

  UPDATE public.attendance
  SET
    check_out   = v_now_time,
    work_hours  = v_worked,
    extra_hours = v_extra,
    status      = v_status,
    updated_at  = now()
  WHERE employee_id = p_employee_id AND date = v_today
  RETURNING * INTO v_rec;

  RETURN v_rec;
END;
$$;

COMMENT ON FUNCTION public.fn_check_out IS
  'Records employee check-out. Calculates work_hours and extra_hours. Mirrors Store.checkOut() logic exactly.';


-- ============================================================
-- FN 8 — fn_get_month_stats
--   Returns attendance stats for a user in a given month.
--   Mirrors Store.getMonthStats() from store.js.
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_get_month_stats(
  p_employee_id UUID,
  p_year        INT,
  p_month       INT
)
RETURNS TABLE (
  present   BIGINT,
  half_day  BIGINT,
  on_leave  BIGINT,
  absent    BIGINT,
  work_days INT,
  payable   NUMERIC
) LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_work_days INT := 0;
  v_day       INT;
  v_dow       INT;
BEGIN
  -- Count working days in month (Mon–Fri)
  FOR v_day IN 1 .. EXTRACT(DAY FROM (DATE_TRUNC('month', make_date(p_year, p_month, 1)) + INTERVAL '1 month - 1 day'))::INT
  LOOP
    v_dow := EXTRACT(DOW FROM make_date(p_year, p_month, v_day));
    IF v_dow NOT IN (0, 6) THEN v_work_days := v_work_days + 1; END IF;
  END LOOP;

  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE a.status = 'present')  AS present,
    COUNT(*) FILTER (WHERE a.status = 'half-day') AS half_day,
    COUNT(*) FILTER (WHERE a.status = 'leave')    AS on_leave,
    COUNT(*) FILTER (WHERE a.status = 'absent')   AS absent,
    v_work_days,
    (
      COUNT(*) FILTER (WHERE a.status = 'present')
      + COUNT(*) FILTER (WHERE a.status = 'half-day') * 0.5
      + COUNT(*) FILTER (WHERE a.status = 'leave')
    ) AS payable
  FROM public.attendance a
  WHERE a.employee_id = p_employee_id
    AND EXTRACT(YEAR  FROM a.date)::INT = p_year
    AND EXTRACT(MONTH FROM a.date)::INT = p_month;
END;
$$;

COMMENT ON FUNCTION public.fn_get_month_stats IS
  'Returns monthly attendance summary. Mirrors Store.getMonthStats(). Payable days = present + 0.5*half-day + on_leave.';


-- ============================================================
-- FN 9 — fn_approve_leave
--   Approves a leave request and records which admin approved it.
--   Mirrors Store.approveLeave() + leave→attendance sync trigger.
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_approve_leave(
  p_leave_id    UUID,
  p_approved_by UUID,
  p_comment     TEXT DEFAULT ''
)
RETURNS public.leave_requests LANGUAGE plpgsql AS $$
DECLARE
  v_leave public.leave_requests;
BEGIN
  UPDATE public.leave_requests
  SET
    status        = 'approved',
    admin_comment = p_comment,
    approved_by   = p_approved_by,
    approved_at   = now()
  WHERE id = p_leave_id
  RETURNING * INTO v_leave;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Leave request % not found', p_leave_id;
  END IF;

  -- Attendance sync is handled automatically by trg_leave_mark_attendance trigger
  RETURN v_leave;
END;
$$;

COMMENT ON FUNCTION public.fn_approve_leave IS
  'Approves a leave request. Attendance is automatically marked via trigger. Mirrors Store.approveLeave().';


-- ============================================================
-- FN 10 — fn_reject_leave
--   Rejects a leave request with admin comment.
--   Mirrors Store.rejectLeave() from store.js.
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_reject_leave(
  p_leave_id    UUID,
  p_rejected_by UUID,
  p_comment     TEXT DEFAULT ''
)
RETURNS public.leave_requests LANGUAGE plpgsql AS $$
DECLARE
  v_leave public.leave_requests;
BEGIN
  UPDATE public.leave_requests
  SET
    status        = 'rejected',
    admin_comment = p_comment,
    approved_by   = p_rejected_by,
    rejected_at   = now()
  WHERE id = p_leave_id
  RETURNING * INTO v_leave;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Leave request % not found', p_leave_id;
  END IF;

  RETURN v_leave;
END;
$$;

COMMENT ON FUNCTION public.fn_reject_leave IS
  'Rejects a leave request with a comment. Mirrors Store.rejectLeave().';


-- ============================================================
-- FN 11 — fn_create_leave
--   Creates a leave request. Calculates days automatically.
--   Mirrors Store.createLeave() from store.js.
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_create_leave(
  p_employee_id UUID,
  p_leave_type  TEXT,
  p_start_date  DATE,
  p_end_date    DATE,
  p_remarks     TEXT DEFAULT NULL
)
RETURNS public.leave_requests LANGUAGE plpgsql AS $$
DECLARE
  v_allocation INT;
  v_leave      public.leave_requests;
BEGIN
  -- Validate dates
  IF p_end_date < p_start_date THEN
    RAISE EXCEPTION 'End date cannot be before start date';
  END IF;

  -- Calculate allocation (number of calendar days, inclusive)
  v_allocation := (p_end_date - p_start_date) + 1;

  INSERT INTO public.leave_requests (
    employee_id, leave_type, start_date, end_date,
    allocation, remarks, status
  ) VALUES (
    p_employee_id, p_leave_type, p_start_date, p_end_date,
    v_allocation, p_remarks, 'pending'
  )
  RETURNING * INTO v_leave;

  RETURN v_leave;
END;
$$;

COMMENT ON FUNCTION public.fn_create_leave IS
  'Creates a leave request with auto-calculated days. Mirrors Store.createLeave().';


-- ============================================================
-- FN 12 — fn_update_salary
--   Updates salary for an employee. Trigger auto-recalculates.
--   Mirrors Store.updateSalary() from store.js.
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_update_salary(
  p_employee_id       UUID,
  p_monthly_wage      NUMERIC,
  p_basic_pct         NUMERIC DEFAULT 50,
  p_hra_pct           NUMERIC DEFAULT 50,
  p_bonus_pct         NUMERIC DEFAULT 10,
  p_lta_pct           NUMERIC DEFAULT 5,
  p_lta_fixed         NUMERIC DEFAULT 0,
  p_pf_employee_pct   NUMERIC DEFAULT 12,
  p_pf_employer_pct   NUMERIC DEFAULT 12,
  p_professional_tax  NUMERIC DEFAULT 200,
  p_working_days      INT     DEFAULT 5
)
RETURNS public.salary LANGUAGE plpgsql AS $$
DECLARE
  v_salary public.salary;
BEGIN
  INSERT INTO public.salary (
    employee_id, monthly_wage, basic_pct, hra_pct, bonus_pct,
    lta_pct, lta_fixed, pf_employee_pct, pf_employer_pct,
    professional_tax, working_days_per_week
  ) VALUES (
    p_employee_id, p_monthly_wage, p_basic_pct, p_hra_pct, p_bonus_pct,
    p_lta_pct, p_lta_fixed, p_pf_employee_pct, p_pf_employer_pct,
    p_professional_tax, p_working_days
  )
  ON CONFLICT (employee_id) DO UPDATE SET
    monthly_wage       = EXCLUDED.monthly_wage,
    basic_pct          = EXCLUDED.basic_pct,
    hra_pct            = EXCLUDED.hra_pct,
    bonus_pct          = EXCLUDED.bonus_pct,
    lta_pct            = EXCLUDED.lta_pct,
    lta_fixed          = EXCLUDED.lta_fixed,
    pf_employee_pct    = EXCLUDED.pf_employee_pct,
    pf_employer_pct    = EXCLUDED.pf_employer_pct,
    professional_tax   = EXCLUDED.professional_tax,
    working_days_per_week = EXCLUDED.working_days_per_week
  RETURNING * INTO v_salary;

  RETURN v_salary;
END;
$$;

COMMENT ON FUNCTION public.fn_update_salary IS
  'Upserts salary record. The fn_compute_salary trigger auto-calculates all components. Mirrors Store.updateSalary().';


-- ============================================================
-- FN 13 — fn_get_today_summary (Admin Dashboard)
--   Returns a summary count of present/absent/on-leave today.
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_get_today_summary(p_company_id UUID)
RETURNS TABLE (
  total_employees BIGINT,
  present_count   BIGINT,
  absent_count    BIGINT,
  on_leave_count  BIGINT,
  pending_leaves  BIGINT
) LANGUAGE sql STABLE AS $$
  SELECT
    (SELECT COUNT(*) FROM public.employees WHERE company_id = p_company_id AND role = 'employee') AS total_employees,
    (SELECT COUNT(*) FROM public.v_today_attendance WHERE status = 'present')                     AS present_count,
    (SELECT COUNT(*) FROM public.v_today_attendance WHERE status = 'absent')                      AS absent_count,
    (SELECT COUNT(*) FROM public.v_today_attendance WHERE status = 'leave')                       AS on_leave_count,
    (SELECT COUNT(*) FROM public.leave_requests    WHERE status  = 'pending')                     AS pending_leaves;
$$;

COMMENT ON FUNCTION public.fn_get_today_summary IS
  'Returns dashboard summary counts for admin: present/absent/leave/pending leaves today.';


-- ============================================================
-- FN 14 — fn_employee_card_status
--   Determines display status for an employee card.
--   Mirrors Utils.employeeCardStatus() from utils.js.
--   Returns: 'on-leave' | 'present' | 'absent'
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_employee_card_status(p_employee_id UUID)
RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM public.leave_requests
      WHERE  employee_id = p_employee_id
        AND  status      = 'approved'
        AND  start_date  <= CURRENT_DATE
        AND  end_date    >= CURRENT_DATE
    ) THEN 'on-leave'
    WHEN EXISTS (
      SELECT 1 FROM public.attendance
      WHERE  employee_id = p_employee_id
        AND  date        = CURRENT_DATE
        AND  check_in    IS NOT NULL
    ) THEN 'present'
    ELSE 'absent'
  END;
$$;

COMMENT ON FUNCTION public.fn_employee_card_status IS
  'Returns display status for employee card. Mirrors Utils.employeeCardStatus(). Values: on-leave, present, absent.';


-- ============================================================
-- FN 15 — fn_update_leave_balance
--   Decrements leave balance when a leave is approved.
--   Called automatically or manually after approval.
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_update_leave_balance(
  p_employee_id UUID,
  p_leave_type  TEXT,
  p_days        INT
)
RETURNS public.leave_balances LANGUAGE plpgsql AS $$
DECLARE
  v_balance public.leave_balances;
BEGIN
  UPDATE public.leave_balances
  SET
    paid   = CASE WHEN p_leave_type = 'paid'   THEN GREATEST(0, paid   - p_days) ELSE paid   END,
    sick   = CASE WHEN p_leave_type = 'sick'   THEN GREATEST(0, sick   - p_days) ELSE sick   END,
    unpaid = CASE WHEN p_leave_type = 'unpaid' THEN GREATEST(0, unpaid - p_days) ELSE unpaid END
  WHERE employee_id = p_employee_id
  RETURNING * INTO v_balance;

  RETURN v_balance;
END;
$$;

COMMENT ON FUNCTION public.fn_update_leave_balance IS
  'Decrements leave balance for paid/sick/unpaid leaves when approved. Mirrors Store.updateLeaveBalance().';


-- ============================================================
-- DONE
-- Functions created (15 total):
--   fn_generate_login_id     — mirrors Utils.generateLoginId()
--   fn_next_serial           — mirrors Utils.nextSerial()
--   fn_add_employee          — full employee creation with salary
--   fn_verify_password       — mirrors Auth.login()
--   fn_change_password       — secure password update
--   fn_check_in              — mirrors Store.checkIn()
--   fn_check_out             — mirrors Store.checkOut()
--   fn_get_month_stats       — mirrors Store.getMonthStats()
--   fn_approve_leave         — mirrors Store.approveLeave()
--   fn_reject_leave          — mirrors Store.rejectLeave()
--   fn_create_leave          — mirrors Store.createLeave()
--   fn_update_salary         — mirrors Store.updateSalary()
--   fn_get_today_summary     — admin dashboard summary
--   fn_employee_card_status  — mirrors Utils.employeeCardStatus()
--   fn_update_leave_balance  — mirrors Store.updateLeaveBalance()
-- ============================================================
