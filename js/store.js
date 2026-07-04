/* ============================================================
   HRMS Store — Supabase Edition
   Replaces js/store.js (localStorage) with Supabase API calls.
   
   HOW TO USE:
   1. Replace js/store.js with this file (rename to store.js)
   2. Add Supabase SDK to index.html BEFORE your scripts:
      <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
      <script>
        window._supabase = supabase.createClient(
          'https://YOUR-PROJECT.supabase.co',
          'YOUR-ANON-PUBLIC-KEY'
        );
      </script>
   3. All page functions that call Store methods must be async/await.
   ============================================================ */

const Store = (() => {

  // ── Supabase client shorthand ─────────────────────────────
  const db = () => window._supabase;

  // ── Error handler ─────────────────────────────────────────
  const _err = (error, context = '') => {
    console.error(`[Store${context ? '.' + context : ''}]`, error.message || error);
    throw new Error(error.message || 'Database error');
  };

  // ── Salary computation (stays client-side for live preview) ──
  const computeSalaryComponents = (s) => {
    const wage  = parseFloat(s.monthlyWage) || 0;
    const basic = Math.round(wage * (parseFloat(s.basicPct) || 0) / 100);
    const hra   = Math.round(basic * (parseFloat(s.hraPct) || 0) / 100);
    const bonus = Math.round(basic * (parseFloat(s.bonusPct) || 0) / 100);
    const lta   = parseFloat(s.ltaFixed)
      ? Math.round(parseFloat(s.ltaFixed))
      : Math.round(basic * (parseFloat(s.ltaPct) || 0) / 100);
    const pfEmp = Math.round(basic * (parseFloat(s.pfEmployeePct) || 0) / 100);
    const pfEmr = Math.round(basic * (parseFloat(s.pfEmployerPct) || 0) / 100);
    const pTax  = parseFloat(s.professionalTax) || 200;
    const totalDeductions = pfEmp + pTax;
    const totalAllowances = hra + bonus + lta;
    const fixedAllowance  = Math.max(0, wage - basic - totalAllowances - pfEmr);
    const grossPay  = basic + totalAllowances + fixedAllowance;
    const netSalary = grossPay - totalDeductions;
    return {
      monthlyWage: wage, yearlyWage: wage * 12,
      workingDaysPerWeek: parseInt(s.workingDaysPerWeek) || 5,
      basicPct: parseFloat(s.basicPct) || 50,
      hraPct:   parseFloat(s.hraPct)   || 50,
      bonusPct: parseFloat(s.bonusPct) || 10,
      ltaPct:   parseFloat(s.ltaPct)   || 5,
      ltaFixed: parseFloat(s.ltaFixed) || 0,
      pfEmployeePct: parseFloat(s.pfEmployeePct) || 12,
      pfEmployerPct: parseFloat(s.pfEmployerPct) || 12,
      professionalTax: pTax,
      basic, hra, bonus, lta, pfEmp, pfEmr,
      fixedAllowance, grossPay, netSalary,
      totalDeductions, totalAllowances,
    };
  };

  // ── Private helpers ────────────────────────────────────────
  const _todayStr = () => new Date().toISOString().split('T')[0];
  const _timeStr  = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  // ── Mapper: DB row → JS user object (camelCase) ───────────
  // Maps snake_case DB columns to the camelCase format used by all pages.
  const _mapEmployee = (row) => {
    if (!row) return null;
    return {
      id:            row.id,
      loginId:       row.login_id,
      email:         row.email,
      role:          row.role,
      name:          row.name,
      serialNo:      row.serial_no,
      phone:         row.phone,
      address:       row.address,
      dob:           row.dob,
      about:         row.about,
      profilePic:    row.avatar_url,
      accountNumber: row.account_number,
      department:    row.department,
      designation:   row.designation,
      joinDate:      row.join_date,
      companyId:     row.company_id,
      createdAt:     row.created_at,
      // Joined fields from v_employee_full view
      salary:        row.monthly_wage ? {
        monthlyWage:       row.monthly_wage,
        yearlyWage:        row.monthly_wage * 12,
        netSalary:         row.net_salary,
        grossPay:          row.gross_pay,
        basic:             row.basic,
        hra:               row.hra,
        bonus:             row.bonus,
        lta:               row.lta,
        pfEmp:             row.pf_emp,
        totalDeductions:   row.total_deductions,
      } : null,
      // Arrays — loaded separately
      skills:         row.skills         || [],
      certifications: row.certifications || [],
      documents:      row.documents      || [],
    };
  };

  const _mapAttendance = (row) => ({
    id:          row.id,
    userId:      row.employee_id,
    date:        row.date,
    checkIn:     row.check_in,
    checkOut:    row.check_out,
    workHours:   row.work_hours,
    extraHours:  row.extra_hours,
    status:      row.status,
    createdAt:   row.created_at,
  });

  const _mapLeave = (row) => ({
    id:           row.id,
    userId:       row.employee_id,
    leaveType:    row.leave_type,
    startDate:    row.start_date,
    endDate:      row.end_date,
    allocation:   row.allocation,
    remarks:      row.remarks,
    status:       row.status,
    adminComment: row.admin_comment,
    approvedBy:   row.approved_by,
    approvedAt:   row.approved_at,
    rejectedAt:   row.rejected_at,
    createdAt:    row.created_at,
    // Joined fields from v_pending_leaves view
    employeeName:       row.employee_name,
    employeeDepartment: row.employee_department,
    employeeAvatar:     row.employee_avatar,
  });

  // ── Company ───────────────────────────────────────────────
  const getCompany = async () => {
    const { data, error } = await db().from('company').select('*').single();
    if (error) _err(error, 'getCompany');
    return data ? { id: data.id, name: data.name, logo: data.logo_url } : null;
  };

  const saveCompany = async (updates) => {
    const company = await getCompany();
    const { data, error } = await db()
      .from('company')
      .update({ name: updates.name, logo_url: updates.logo })
      .eq('id', company.id)
      .select().single();
    if (error) _err(error, 'saveCompany');
    return data;
  };

  // ── Users / Employees ─────────────────────────────────────
  const getUsers = async () => {
    const { data, error } = await db()
      .from('v_employee_full')
      .select('*')
      .order('serial_no', { ascending: true });
    if (error) _err(error, 'getUsers');

    // Load skills & certifications for all employees in bulk
    const ids = data.map(e => e.id);
    const [{ data: skills }, { data: certs }, { data: docs }] = await Promise.all([
      db().from('employee_skills').select('*').in('employee_id', ids),
      db().from('certifications').select('*').in('employee_id', ids),
      db().from('documents').select('*').in('employee_id', ids),
    ]);

    return data.map(row => {
      const emp = _mapEmployee(row);
      emp.skills         = (skills  || []).filter(s => s.employee_id === row.id).map(s => s.skill);
      emp.certifications = (certs   || []).filter(c => c.employee_id === row.id).map(c => c.name);
      emp.documents      = (docs    || []).filter(d => d.employee_id === row.id);
      return emp;
    });
  };

  const getUserById = async (id) => {
    const { data, error } = await db()
      .from('v_employee_full')
      .select('*')
      .eq('id', id)
      .single();
    if (error) _err(error, 'getUserById');

    const [{ data: skills }, { data: certs }, { data: docs }] = await Promise.all([
      db().from('employee_skills').select('skill').eq('employee_id', id),
      db().from('certifications').select('name').eq('employee_id', id),
      db().from('documents').select('*').eq('employee_id', id),
    ]);

    const emp = _mapEmployee(data);
    emp.skills         = (skills || []).map(s => s.skill);
    emp.certifications = (certs  || []).map(c => c.name);
    emp.documents      = docs || [];
    return emp;
  };

  const getUserByEmail = async (email) => {
    const { data, error } = await db()
      .from('employees')
      .select('*')
      .ilike('email', email)
      .maybeSingle();
    if (error) _err(error, 'getUserByEmail');
    return data ? _mapEmployee(data) : null;
  };

  const getUserByLoginId = async (loginId) => {
    const { data, error } = await db()
      .from('employees')
      .select('*')
      .ilike('login_id', loginId)
      .maybeSingle();
    if (error) _err(error, 'getUserByLoginId');
    return data ? _mapEmployee(data) : null;
  };

  const getEmployees = async () => {
    const users = await getUsers();
    return users.filter(u => u.role === 'employee');
  };

  const getAdmins = async () => {
    const users = await getUsers();
    return users.filter(u => u.role === 'admin');
  };

  // Create employee using stored function
  const createUser = async (data) => {
    const nameParts = (data.name || '').split(' ');
    const firstName = nameParts[0] || '';
    const lastName  = nameParts.slice(1).join(' ') || '';

    const { data: emp, error } = await db()
      .rpc('fn_add_employee', {
        p_company_id:   data.companyId,
        p_first_name:   firstName,
        p_last_name:    lastName,
        p_email:        data.email,
        p_password:     data.password,
        p_phone:        data.phone        || null,
        p_department:   data.department   || null,
        p_designation:  data.designation  || null,
        p_join_date:    data.joinDate     || _todayStr(),
        p_monthly_wage: data.salary?.monthlyWage || 0,
        p_role:         data.role         || 'employee',
      });
    if (error) _err(error, 'createUser');

    // Add skills and certifications
    if (data.skills?.length) {
      await db().from('employee_skills').insert(
        data.skills.map(skill => ({ employee_id: emp.id, skill }))
      );
    }
    if (data.certifications?.length) {
      await db().from('certifications').insert(
        data.certifications.map(name => ({ employee_id: emp.id, name }))
      );
    }

    return getUserById(emp.id);
  };

  // Update employee profile fields
  const updateUser = async (id, updates) => {
    // Map camelCase fields → snake_case DB columns
    const dbUpdates = {};
    if (updates.name        !== undefined) dbUpdates.name           = updates.name;
    if (updates.phone       !== undefined) dbUpdates.phone          = updates.phone;
    if (updates.address     !== undefined) dbUpdates.address        = updates.address;
    if (updates.dob         !== undefined) dbUpdates.dob            = updates.dob;
    if (updates.about       !== undefined) dbUpdates.about          = updates.about;
    if (updates.department  !== undefined) dbUpdates.department     = updates.department;
    if (updates.designation !== undefined) dbUpdates.designation    = updates.designation;
    if (updates.joinDate    !== undefined) dbUpdates.join_date      = updates.joinDate;
    if (updates.accountNumber !== undefined) dbUpdates.account_number = updates.accountNumber;
    if (updates.profilePic  !== undefined) dbUpdates.avatar_url    = updates.profilePic;
    if (updates.email       !== undefined) dbUpdates.email          = updates.email;
    if (updates.loginId     !== undefined) dbUpdates.login_id       = updates.loginId;

    if (Object.keys(dbUpdates).length > 0) {
      const { error } = await db().from('employees').update(dbUpdates).eq('id', id);
      if (error) _err(error, 'updateUser');
    }

    // Handle skills array update
    if (updates.skills !== undefined) {
      await db().from('employee_skills').delete().eq('employee_id', id);
      if (updates.skills.length > 0) {
        await db().from('employee_skills').insert(
          updates.skills.map(skill => ({ employee_id: id, skill }))
        );
      }
    }

    // Handle certifications array update
    if (updates.certifications !== undefined) {
      await db().from('certifications').delete().eq('employee_id', id);
      if (updates.certifications.length > 0) {
        await db().from('certifications').insert(
          updates.certifications.map(name => ({ employee_id: id, name }))
        );
      }
    }

    // Handle documents array update
    if (updates.documents !== undefined) {
      await db().from('documents').delete().eq('employee_id', id);
      if (updates.documents.length > 0) {
        await db().from('documents').insert(
          updates.documents.map(doc => ({
            employee_id: id,
            name:        doc.name,
            file_url:    doc.file_url || '#',
            file_type:   doc.file_type || null,
          }))
        );
      }
    }

    return getUserById(id);
  };

  const deleteUser = async (id) => {
    const { error } = await db().from('employees').delete().eq('id', id);
    if (error) _err(error, 'deleteUser');
  };

  // ── Salary ────────────────────────────────────────────────
  const getSalary = async (userId) => {
    const { data, error } = await db().from('salary').select('*').eq('employee_id', userId).maybeSingle();
    if (error) _err(error, 'getSalary');
    return data;
  };

  const updateSalary = async (userId, salaryData) => {
    const { data, error } = await db().rpc('fn_update_salary', {
      p_employee_id:      userId,
      p_monthly_wage:     parseFloat(salaryData.monthlyWage)    || 0,
      p_basic_pct:        parseFloat(salaryData.basicPct)        || 50,
      p_hra_pct:          parseFloat(salaryData.hraPct)          || 50,
      p_bonus_pct:        parseFloat(salaryData.bonusPct)        || 10,
      p_lta_pct:          parseFloat(salaryData.ltaPct)          || 5,
      p_lta_fixed:        parseFloat(salaryData.ltaFixed)        || 0,
      p_pf_employee_pct:  parseFloat(salaryData.pfEmployeePct)   || 12,
      p_pf_employer_pct:  parseFloat(salaryData.pfEmployerPct)   || 12,
      p_professional_tax: parseFloat(salaryData.professionalTax) || 200,
      p_working_days:     parseInt(salaryData.workingDaysPerWeek) || 5,
    });
    if (error) _err(error, 'updateSalary');
    return getUserById(userId);
  };

  // ── Attendance ────────────────────────────────────────────
  const getAttendance = async () => {
    const { data, error } = await db().from('attendance').select('*').order('date', { ascending: false });
    if (error) _err(error, 'getAttendance');
    return (data || []).map(_mapAttendance);
  };

  const getAttendanceByUser = async (userId) => {
    const { data, error } = await db()
      .from('attendance').select('*')
      .eq('employee_id', userId).order('date', { ascending: false });
    if (error) _err(error, 'getAttendanceByUser');
    return (data || []).map(_mapAttendance);
  };

  const getAttendanceByDate = async (date) => {
    const { data, error } = await db().from('attendance').select('*').eq('date', date);
    if (error) _err(error, 'getAttendanceByDate');
    return (data || []).map(_mapAttendance);
  };

  const getAttendanceByUserAndDate = async (userId, date) => {
    const { data, error } = await db()
      .from('attendance').select('*')
      .eq('employee_id', userId).eq('date', date).maybeSingle();
    if (error) _err(error, 'getAttendanceByUserAndDate');
    return data ? _mapAttendance(data) : null;
  };

  const getAttendanceByUserAndMonth = async (userId, year, month) => {
    const start = `${year}-${String(month).padStart(2,'0')}-01`;
    const end   = `${year}-${String(month).padStart(2,'0')}-31`;
    const { data, error } = await db()
      .from('attendance').select('*')
      .eq('employee_id', userId)
      .gte('date', start).lte('date', end);
    if (error) _err(error, 'getAttendanceByUserAndMonth');
    return (data || []).map(_mapAttendance);
  };

  const checkIn = async (userId) => {
    const { data, error } = await db().rpc('fn_check_in', { p_employee_id: userId });
    if (error) _err(error, 'checkIn');
    return data ? _mapAttendance(data) : null;
  };

  const checkOut = async (userId) => {
    const { data, error } = await db().rpc('fn_check_out', { p_employee_id: userId });
    if (error) _err(error, 'checkOut');
    return data ? _mapAttendance(data) : null;
  };

  const getTodayAttendance = async (userId) => {
    return getAttendanceByUserAndDate(userId, _todayStr());
  };

  const getMonthStats = async (userId, year, month) => {
    const { data, error } = await db().rpc('fn_get_month_stats', {
      p_employee_id: userId,
      p_year:        year,
      p_month:       month,
    });
    if (error) _err(error, 'getMonthStats');
    const row = data?.[0] || {};
    return {
      present:  parseInt(row.present)  || 0,
      halfDay:  parseInt(row.half_day) || 0,
      onLeave:  parseInt(row.on_leave) || 0,
      absent:   parseInt(row.absent)   || 0,
      workDays: parseInt(row.work_days)|| 0,
      payable:  parseFloat(row.payable)|| 0,
    };
  };

  // ── Leaves ────────────────────────────────────────────────
  const getLeaves = async () => {
    const { data, error } = await db()
      .from('leave_requests').select('*').order('created_at', { ascending: false });
    if (error) _err(error, 'getLeaves');
    return (data || []).map(_mapLeave);
  };

  const getLeaveById = async (id) => {
    const { data, error } = await db().from('leave_requests').select('*').eq('id', id).single();
    if (error) _err(error, 'getLeaveById');
    return _mapLeave(data);
  };

  const getLeavesByUser = async (userId) => {
    const { data, error } = await db()
      .from('leave_requests').select('*')
      .eq('employee_id', userId).order('created_at', { ascending: false });
    if (error) _err(error, 'getLeavesByUser');
    return (data || []).map(_mapLeave);
  };

  const getPendingLeaves = async () => {
    const { data, error } = await db()
      .from('v_pending_leaves').select('*');
    if (error) _err(error, 'getPendingLeaves');
    return (data || []).map(_mapLeave);
  };

  const getAllLeaves = async () => {
    const { data, error } = await db()
      .from('leave_requests')
      .select('*, employees!leave_requests_employee_id_fkey(name, department, avatar_url)')
      .order('created_at', { ascending: false });
    if (error) _err(error, 'getAllLeaves');
    return (data || []).map(row => ({
      ..._mapLeave(row),
      employeeName:       row.employees?.name,
      employeeDepartment: row.employees?.department,
      employeeAvatar:     row.employees?.avatar_url,
    }));
  };

  const createLeave = async (data) => {
    const { data: leave, error } = await db().rpc('fn_create_leave', {
      p_employee_id: data.userId,
      p_leave_type:  data.type || data.leaveType,
      p_start_date:  data.startDate,
      p_end_date:    data.endDate,
      p_remarks:     data.remarks || null,
    });
    if (error) _err(error, 'createLeave');
    return _mapLeave(leave);
  };

  const approveLeave = async (id, comment = '') => {
    const currentUser = JSON.parse(sessionStorage.getItem('hrms_session') || '{}');
    const { data, error } = await db().rpc('fn_approve_leave', {
      p_leave_id:    id,
      p_approved_by: currentUser.id,
      p_comment:     comment,
    });
    if (error) _err(error, 'approveLeave');
    return _mapLeave(data);
  };

  const rejectLeave = async (id, comment = '') => {
    const currentUser = JSON.parse(sessionStorage.getItem('hrms_session') || '{}');
    const { data, error } = await db().rpc('fn_reject_leave', {
      p_leave_id:    id,
      p_rejected_by: currentUser.id,
      p_comment:     comment,
    });
    if (error) _err(error, 'rejectLeave');
    return _mapLeave(data);
  };

  // ── Leave Balances ────────────────────────────────────────
  const getLeaveBalance = async (userId) => {
    const { data, error } = await db()
      .from('leave_balances').select('*').eq('employee_id', userId).maybeSingle();
    if (error) _err(error, 'getLeaveBalance');
    return data
      ? { userId: data.employee_id, paid: data.paid, sick: data.sick, unpaid: data.unpaid }
      : { userId, paid: 24, sick: 7, unpaid: 999 };
  };

  const updateLeaveBalance = async (userId, updates) => {
    const { error } = await db()
      .from('leave_balances')
      .upsert({ employee_id: userId, ...updates }, { onConflict: 'employee_id' });
    if (error) _err(error, 'updateLeaveBalance');
  };

  // ── Public Holidays ───────────────────────────────────────
  const getHolidays = async () => {
    const { data, error } = await db().from('holidays').select('*').order('date');
    if (error) _err(error, 'getHolidays');
    return (data || []).map(h => ({ date: h.date, name: h.name }));
  };

  const saveHolidays = async (list) => {
    const company = await getCompany();
    // Delete all then re-insert
    await db().from('holidays').delete().eq('company_id', company.id);
    if (list.length > 0) {
      const { error } = await db().from('holidays').insert(
        list.map(h => ({ company_id: company.id, date: h.date, name: h.name }))
      );
      if (error) _err(error, 'saveHolidays');
    }
  };

  // ── Seeded flag (stored in localStorage as a lightweight flag) ──
  const isSeeded  = () => !!localStorage.getItem('hrms_seeded_supabase');
  const markSeeded = () => localStorage.setItem('hrms_seeded_supabase', 'true');
  const clearAll   = async () => {
    // Admin-only: clears all data (use with caution!)
    localStorage.removeItem('hrms_seeded_supabase');
    console.warn('[Store] clearAll() called — this only clears the seed flag. Use Supabase dashboard to reset data.');
  };

  // ── Expose public API ─────────────────────────────────────
  return {
    // Company
    getCompany, saveCompany,
    // Users
    getUsers, getUserById, getUserByEmail, getUserByLoginId,
    createUser, updateUser, deleteUser, getEmployees, getAdmins,
    // Salary
    getSalary, updateSalary, computeSalaryComponents,
    // Attendance
    getAttendance, getAttendanceByUser, getAttendanceByDate,
    getAttendanceByUserAndDate, getAttendanceByUserAndMonth,
    checkIn, checkOut, getTodayAttendance, getMonthStats,
    // Leaves
    getLeaves, getLeaveById, getLeavesByUser, getPendingLeaves, getAllLeaves,
    createLeave, approveLeave, rejectLeave,
    // Leave Balance
    getLeaveBalance, updateLeaveBalance,
    // Holidays
    getHolidays, saveHolidays,
    // Misc
    isSeeded, markSeeded, clearAll,
  };
})();
