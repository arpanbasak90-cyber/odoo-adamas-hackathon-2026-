/* ============================================================
   HRMS Store — localStorage Data Layer (CRUD for all entities)
   All UI code calls ONLY store methods — never localStorage directly.
   This makes backend migration a single-file swap.
   ============================================================ */

const Store = (() => {
  const KEYS = {
    COMPANY:       'hrms_company',
    USERS:         'hrms_users',
    ATTENDANCE:    'hrms_attendance',
    LEAVES:        'hrms_leaves',
    LEAVE_BALANCE: 'hrms_leave_balance',
    HOLIDAYS:      'hrms_holidays',
    SEEDED:        'hrms_seeded',
  };

  // ── Generic helpers ──────────────────────────────────────────
  const _get  = (key)       => JSON.parse(localStorage.getItem(key) || 'null');
  const _set  = (key, data) => localStorage.setItem(key, JSON.stringify(data));
  const _uid  = ()          => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // ── Company ──────────────────────────────────────────────────
  const getCompany       = ()      => _get(KEYS.COMPANY);
  const saveCompany      = (data)  => { _set(KEYS.COMPANY, { ...(getCompany()||{}), ...data }); return getCompany(); };
  const createCompany    = (data)  => { const c = { id: _uid(), createdAt: new Date().toISOString(), ...data }; _set(KEYS.COMPANY, c); return c; };

  // ── Users ────────────────────────────────────────────────────
  const getUsers         = ()      => _get(KEYS.USERS) || [];
  const getUserById      = (id)    => getUsers().find(u => u.id === id) || null;
  const getUserByEmail   = (email) => getUsers().find(u => u.email?.toLowerCase() === email?.toLowerCase()) || null;
  const getUserByLoginId = (lid)   => getUsers().find(u => u.loginId?.toLowerCase() === lid?.toLowerCase()) || null;

  const createUser = (data) => {
    const users = getUsers();
    const user  = { id: _uid(), createdAt: new Date().toISOString(), documents: [], skills: [], certifications: [], ...data };
    users.push(user);
    _set(KEYS.USERS, users);
    // Init leave balance
    _initLeaveBalance(user.id);
    return user;
  };

  const updateUser = (id, data) => {
    const users = getUsers().map(u => u.id === id ? { ...u, ...data } : u);
    _set(KEYS.USERS, users);
    return getUserById(id);
  };

  const deleteUser = (id) => {
    _set(KEYS.USERS, getUsers().filter(u => u.id !== id));
  };

  const getEmployees = () => getUsers().filter(u => u.role === 'employee');
  const getAdmins    = () => getUsers().filter(u => u.role === 'admin');

  // ── Salary Structure ─────────────────────────────────────────
  // Salary is stored inside user object as user.salary = { ... }
  const getSalary = (userId) => (getUserById(userId) || {}).salary || null;

  const updateSalary = (userId, salaryData) => {
    const user   = getUserById(userId);
    if (!user) return null;
    const salary = computeSalaryComponents(salaryData);
    return updateUser(userId, { salary });
  };

  // Auto-compute all salary components from wage + percentages
  const computeSalaryComponents = (s) => {
    const wage  = parseFloat(s.monthlyWage) || 0;
    const basic = Math.round(wage * (parseFloat(s.basicPct) || 0) / 100);
    const hra   = Math.round(basic * (parseFloat(s.hraPct) || 0) / 100);
    const bonus = Math.round(basic * (parseFloat(s.bonusPct) || 0) / 100);
    const lta   = parseFloat(s.ltaFixed) ? Math.round(parseFloat(s.ltaFixed)) : Math.round(basic * (parseFloat(s.ltaPct) || 0) / 100);
    const pfEmp = Math.round(basic * (parseFloat(s.pfEmployeePct) || 0) / 100);
    const pfEmr = Math.round(basic * (parseFloat(s.pfEmployerPct) || 0) / 100);
    const pTax  = parseFloat(s.professionalTax) || 200;
    const totalDeductions = pfEmp + pTax;
    const totalAllowances = hra + bonus + lta;
    const fixedAllowance  = Math.max(0, wage - basic - totalAllowances - pfEmr);
    const grossPay  = basic + totalAllowances + fixedAllowance;
    const netSalary = grossPay - totalDeductions;
    const yearlyWage = wage * 12;

    return {
      monthlyWage: wage, yearlyWage,
      workingDaysPerWeek: parseInt(s.workingDaysPerWeek) || 5,
      basicPct: parseFloat(s.basicPct) || 50,
      hraPct:   parseFloat(s.hraPct)   || 50,
      bonusPct: parseFloat(s.bonusPct) || 10,
      ltaPct:   parseFloat(s.ltaPct)   || 5,
      ltaFixed: parseFloat(s.ltaFixed) || 0,
      pfEmployeePct: parseFloat(s.pfEmployeePct) || 12,
      pfEmployerPct: parseFloat(s.pfEmployerPct) || 12,
      professionalTax: pTax,
      // Computed
      basic, hra, bonus, lta, pfEmp, pfEmr,
      fixedAllowance, grossPay, netSalary,
      totalDeductions, totalAllowances,
    };
  };

  // ── Attendance ───────────────────────────────────────────────
  const getAttendance     = ()       => _get(KEYS.ATTENDANCE) || [];
  const getAttendanceById = (id)     => getAttendance().find(a => a.id === id) || null;

  const getAttendanceByUser = (userId) =>
    getAttendance().filter(a => a.userId === userId).sort((a, b) => a.date > b.date ? -1 : 1);

  const getAttendanceByDate = (date) =>
    getAttendance().filter(a => a.date === date);

  const getAttendanceByUserAndDate = (userId, date) =>
    getAttendance().find(a => a.userId === userId && a.date === date) || null;

  const getAttendanceByUserAndMonth = (userId, year, month) => {
    const prefix = `${year}-${String(month).padStart(2,'0')}`;
    return getAttendance().filter(a => a.userId === userId && a.date.startsWith(prefix));
  };

  const createAttendance = (data) => {
    const list = getAttendance();
    const rec  = { id: _uid(), createdAt: new Date().toISOString(), ...data };
    list.push(rec);
    _set(KEYS.ATTENDANCE, list);
    return rec;
  };

  const updateAttendance = (id, data) => {
    const list = getAttendance().map(a => a.id === id ? { ...a, ...data } : a);
    _set(KEYS.ATTENDANCE, list);
    return getAttendanceById(id);
  };

  // Check in
  const checkIn = (userId) => {
    const today = _todayStr();
    const existing = getAttendanceByUserAndDate(userId, today);
    const now = _timeStr();
    if (existing) {
      return updateAttendance(existing.id, { checkIn: now, status: 'present' });
    }
    return createAttendance({ userId, date: today, checkIn: now, checkOut: null, workHours: null, extraHours: null, status: 'present' });
  };

  const checkOut = (userId) => {
    const today   = _todayStr();
    const rec     = getAttendanceByUserAndDate(userId, today);
    if (!rec || !rec.checkIn) return null;
    const now     = _timeStr();
    const worked  = _calcHours(rec.checkIn, now);
    const standard = 8;
    const extra   = Math.max(0, worked - standard);
    return updateAttendance(rec.id, {
      checkOut: now,
      workHours: worked.toFixed(2),
      extraHours: extra.toFixed(2),
      status: worked >= 4 ? 'present' : 'half-day',
    });
  };

  const getTodayAttendance = (userId) => getAttendanceByUserAndDate(userId, _todayStr());

  // Attendance stats for a month
  const getMonthStats = (userId, year, month) => {
    const recs     = getAttendanceByUserAndMonth(userId, year, month);
    const present  = recs.filter(r => r.status === 'present').length;
    const halfDay  = recs.filter(r => r.status === 'half-day').length;
    const onLeave  = recs.filter(r => r.status === 'leave').length;
    const absent   = recs.filter(r => r.status === 'absent').length;
    const workDays = _workDaysInMonth(year, month);
    const payable  = present + halfDay * 0.5 + onLeave;
    return { present, halfDay, onLeave, absent, workDays, payable, recs };
  };

  // ── Leaves ───────────────────────────────────────────────────
  const getLeaves          = ()       => _get(KEYS.LEAVES) || [];
  const getLeaveById       = (id)     => getLeaves().find(l => l.id === id) || null;
  const getLeavesByUser    = (userId) => getLeaves().filter(l => l.userId === userId).sort((a, b) => b.createdAt > a.createdAt ? 1 : -1);
  const getPendingLeaves   = ()       => getLeaves().filter(l => l.status === 'pending').sort((a, b) => a.createdAt > b.createdAt ? -1 : 1);
  const getAllLeaves        = ()       => getLeaves().sort((a, b) => a.createdAt > b.createdAt ? -1 : 1);

  const createLeave = (data) => {
    const leaves = getLeaves();
    const leave  = { id: _uid(), createdAt: new Date().toISOString(), status: 'pending', adminComment: '', ...data };
    leaves.push(leave);
    _set(KEYS.LEAVES, leaves);
    return leave;
  };

  const updateLeave = (id, data) => {
    const leaves = getLeaves().map(l => l.id === id ? { ...l, ...data } : l);
    _set(KEYS.LEAVES, leaves);
    // Update attendance records if approved
    const leave = getLeaveById(id);
    if (data.status === 'approved' && leave) {
      _markLeaveAttendance(leave.userId, leave.startDate, leave.endDate);
    }
    return getLeaveById(id);
  };

  const approveLeave = (id, comment = '') => updateLeave(id, { status: 'approved', adminComment: comment, approvedAt: new Date().toISOString() });
  const rejectLeave  = (id, comment = '') => updateLeave(id, { status: 'rejected', adminComment: comment, rejectedAt: new Date().toISOString() });

  // ── Leave Balances ───────────────────────────────────────────
  const _initLeaveBalance = (userId) => {
    const balances = _get(KEYS.LEAVE_BALANCE) || [];
    if (!balances.find(b => b.userId === userId)) {
      balances.push({ userId, paid: 24, sick: 7, unpaid: 999 });
      _set(KEYS.LEAVE_BALANCE, balances);
    }
  };

  const getLeaveBalance = (userId) => {
    const balances = _get(KEYS.LEAVE_BALANCE) || [];
    return balances.find(b => b.userId === userId) || { userId, paid: 24, sick: 7, unpaid: 999 };
  };

  const updateLeaveBalance = (userId, data) => {
    const balances = _get(KEYS.LEAVE_BALANCE) || [];
    const idx = balances.findIndex(b => b.userId === userId);
    if (idx >= 0) balances[idx] = { ...balances[idx], ...data };
    else balances.push({ userId, ...data });
    _set(KEYS.LEAVE_BALANCE, balances);
  };

  // ── Public Holidays ──────────────────────────────────────────
  const getHolidays  = ()     => _get(KEYS.HOLIDAYS) || [];
  const saveHolidays = (list) => _set(KEYS.HOLIDAYS, list);

  // ── Seeded flag ──────────────────────────────────────────────
  const isSeeded  = ()    => !!_get(KEYS.SEEDED);
  const markSeeded = ()   => _set(KEYS.SEEDED, true);
  const clearAll  = ()    => Object.values(KEYS).forEach(k => localStorage.removeItem(k));

  // ── Private helpers ──────────────────────────────────────────
  function _todayStr() {
    return new Date().toISOString().split('T')[0];
  }
  function _timeStr() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }
  function _calcHours(start, end) {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    return ((eh * 60 + em) - (sh * 60 + sm)) / 60;
  }
  function _workDaysInMonth(year, month) {
    const days = new Date(year, month, 0).getDate();
    let count = 0;
    for (let d = 1; d <= days; d++) {
      const day = new Date(year, month - 1, d).getDay();
      if (day !== 0 && day !== 6) count++;
    }
    return count;
  }
  function _markLeaveAttendance(userId, startDate, endDate) {
    const start = new Date(startDate);
    const end   = new Date(endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const existing = getAttendanceByUserAndDate(userId, dateStr);
      if (existing) {
        updateAttendance(existing.id, { status: 'leave' });
      } else {
        createAttendance({ userId, date: dateStr, checkIn: null, checkOut: null, workHours: null, extraHours: null, status: 'leave' });
      }
    }
  }

  return {
    // Company
    getCompany, saveCompany, createCompany,
    // Users
    getUsers, getUserById, getUserByEmail, getUserByLoginId,
    createUser, updateUser, deleteUser, getEmployees, getAdmins,
    // Salary
    getSalary, updateSalary, computeSalaryComponents,
    // Attendance
    getAttendance, getAttendanceByUser, getAttendanceByDate,
    getAttendanceByUserAndDate, getAttendanceByUserAndMonth,
    createAttendance, updateAttendance, checkIn, checkOut,
    getTodayAttendance, getMonthStats,
    // Leaves
    getLeaves, getLeaveById, getLeavesByUser, getPendingLeaves, getAllLeaves,
    createLeave, updateLeave, approveLeave, rejectLeave,
    // Leave Balance
    getLeaveBalance, updateLeaveBalance,
    // Holidays
    getHolidays, saveHolidays,
    // Misc
    isSeeded, markSeeded, clearAll,
  };
})();
