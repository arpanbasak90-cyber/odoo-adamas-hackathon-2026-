/* ============================================================
   Attendance Page
   ============================================================ */
Pages.Attendance = (() => {

  let currentDate  = new Date();
  let currentMonth = currentDate.getMonth() + 1;
  let currentYear  = currentDate.getFullYear();
  let currentDayDate = new Date().toISOString().split('T')[0];
  let currentView  = 'month'; // 'month' or 'day'
  let viewEmployee = null; // For admin switching
  let daySearch    = '';

  const render = () => {
    const user = Auth.requireAuth();
    if (!user) return;
    document.title = 'Attendance — HRMS';
    viewEmployee = user;

    document.getElementById('app').innerHTML = App.renderShell('attendance', _buildHTML(user));
    _bindEvents(user);
    _renderTable(user);
  };

  const _buildHTML = (user) => {
    const isAdmin = Auth.isAdmin();
    const employees = Store.getEmployees();

    const stats = Store.getMonthStats(user.id, currentYear, currentMonth);

    return `
    <div class="page-header">
      <div class="page-header-left">
        <h1 class="page-title">Attendance</h1>
        <p class="page-subtitle">${isAdmin ? 'View and manage attendance records' : 'Your personal attendance records'}</p>
      </div>
      <div class="page-header-right">
        ${isAdmin ? `
        <select class="select-sm" id="emp-switcher" style="min-width:180px; ${currentView==='day' ? 'display:none;' : ''}">
          <option value="${user.id}">My Attendance</option>
          ${employees.map(e => `<option value="${e.id}">${e.name}</option>`).join('')}
        </select>` : ''}
        ${isAdmin ? `
        <div class="filter-group">
          <button class="filter-pill ${currentView==='month'?'active':''}" id="view-month">Month View</button>
          <button class="filter-pill ${currentView==='day'?'active':''}" id="view-day">Day View</button>
        </div>` : ''}
      </div>
    </div>

    <!-- Stats Cards (Hide in day view) -->
    <div class="attendance-stats" style="${currentView==='day' ? 'display:none;' : ''}">
      <div class="stat-card animate-fade-in-up">
        <div class="stat-card-icon" style="background:var(--color-success-bg)">📅</div>
        <div>
          <div class="stat-card-label">Days Present</div>
          <div class="stat-card-value" id="stat-present">${stats.present}</div>
          <div class="stat-card-sub">This month</div>
        </div>
      </div>
      <div class="stat-card animate-fade-in-up" style="animation-delay:50ms">
        <div class="stat-card-icon" style="background:var(--color-warning-bg)">🏖️</div>
        <div>
          <div class="stat-card-label">On Leave</div>
          <div class="stat-card-value" id="stat-leave">${stats.onLeave}</div>
          <div class="stat-card-sub">This month</div>
        </div>
      </div>
      <div class="stat-card animate-fade-in-up" style="animation-delay:100ms">
        <div class="stat-card-icon" style="background:var(--color-primary-50)">💼</div>
        <div>
          <div class="stat-card-label">Working Days</div>
          <div class="stat-card-value" id="stat-workdays">${stats.workDays}</div>
          <div class="stat-card-sub">This month total</div>
        </div>
      </div>
    </div>

    <!-- Attendance Table Card -->
    <div class="card animate-fade-in-up" style="animation-delay:150ms">
      <div class="card-header" id="table-header">
        <!-- Nav pager injected here -->
      </div>
      <div class="table-container" style="border:none;border-radius:0;box-shadow:none">
        <table class="table">
          <thead id="att-thead"></thead>
          <tbody id="att-tbody"></tbody>
        </table>
      </div>
    </div>`;
  };

  const _renderTable = (targetUser) => {
    const isAdmin = Auth.isAdmin();
    const user    = targetUser || viewEmployee;

    if (currentView === 'day' && isAdmin) {
      _renderDayTable();
    } else {
      _renderMonthTable(user);
    }
  };

  const _renderMonthTable = (user) => {
    // Update header nav
    const header = document.getElementById('table-header');
    if (header) header.innerHTML = `
      <div class="nav-pager">
        <button class="nav-pager-btn" id="prev-period" onclick="Pages.Attendance.prevPeriod()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <span class="nav-pager-label">${Utils.monthName(currentMonth, currentYear)}</span>
        <button class="nav-pager-btn" id="next-period" onclick="Pages.Attendance.nextPeriod()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      </div>
      <span style="font-size:var(--font-size-sm);color:var(--color-text-400)">Viewing: <strong style="color:var(--color-text-700)">${user.name}</strong></span>
    `;

    // Thead
    const thead = document.getElementById('att-thead');
    const tbody = document.getElementById('att-tbody');
    if (!thead || !tbody) return;

    thead.innerHTML = `<tr>
      <th>Date</th>
      <th>Day</th>
      <th>Check In</th>
      <th>Check Out</th>
      <th>Work Hours</th>
      <th>Extra Hours</th>
      <th>Status</th>
    </tr>`;

    // Get attendance for the month
    const records = Store.getAttendanceByUserAndMonth(user.id, currentYear, currentMonth);
    const recMap  = {};
    records.forEach(r => { recMap[r.date] = r; });

    const days = Utils.daysInMonth(currentYear, currentMonth);
    const today = Utils.today();
    let rows = '';

    for (let d = 1; d <= days; d++) {
      const dateStr = `${currentYear}-${String(currentMonth).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const dayName = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' });
      const isWeekend = new Date(dateStr + 'T00:00:00').getDay() === 0 || new Date(dateStr + 'T00:00:00').getDay() === 6;
      const isFuture  = dateStr > today;
      const rec = recMap[dateStr];

      let status = '—';
      if (isWeekend)    status = '<span class="badge badge-gray">Weekend</span>';
      else if (isFuture)status = '<span class="badge badge-gray">—</span>';
      else if (rec)     status = Utils.statusBadge(rec.status);
      else              status = Utils.statusBadge('absent');

      const isToday = dateStr === today;
      const rowStyle = isToday ? 'background:var(--color-primary-50)' : isWeekend ? 'background:var(--color-surface-2)' : '';

      rows += `<tr style="${rowStyle}">
        <td style="font-weight:${isToday ? 600 : 400}">
          ${Utils.formatDate(dateStr)}
          ${isToday ? '<span class="badge badge-purple" style="margin-left:6px;font-size:9px">Today</span>' : ''}
        </td>
        <td style="color:var(--color-text-400)">${dayName}</td>
        <td>${rec?.checkIn  ? Utils.formatTime(rec.checkIn)  : '<span style="color:var(--color-text-300)">—</span>'}</td>
        <td>${rec?.checkOut ? Utils.formatTime(rec.checkOut) : '<span style="color:var(--color-text-300)">—</span>'}</td>
        <td>${rec?.workHours  ? `<strong>${rec.workHours}h</strong>` : '<span style="color:var(--color-text-300)">—</span>'}</td>
        <td>${rec?.extraHours && parseFloat(rec.extraHours) > 0 ? `<span style="color:var(--color-success)">+${rec.extraHours}h</span>` : '<span style="color:var(--color-text-300)">0h</span>'}</td>
        <td>${status}</td>
      </tr>`;
    }

    tbody.innerHTML = rows || `<tr><td colspan="7"><div class="empty-state" style="padding:var(--space-10)"><div class="empty-state-title">No records yet</div></div></td></tr>`;

    // Update stats
    const stats = Store.getMonthStats(user.id, currentYear, currentMonth);
    const sp = document.getElementById('stat-present');
    const sl = document.getElementById('stat-leave');
    const sw = document.getElementById('stat-workdays');
    if (sp) sp.textContent = stats.present;
    if (sl) sl.textContent = stats.onLeave;
    if (sw) sw.textContent = stats.workDays;
  };

  const _renderDayTable = () => {
    const header = document.getElementById('table-header');
    if (header) header.innerHTML = `
      <div class="nav-pager">
        <button class="nav-pager-btn" onclick="Pages.Attendance.prevDay()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <span class="nav-pager-label">${Utils.formatDate(currentDayDate)}</span>
        <button class="nav-pager-btn" onclick="Pages.Attendance.nextDay()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      </div>
      <div class="search-bar" style="margin:0;max-width:250px">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input class="search-input" type="text" id="day-search" placeholder="Search employees..." value="${daySearch}" />
      </div>
    `;

    const thead = document.getElementById('att-thead');
    const tbody = document.getElementById('att-tbody');
    if (!thead || !tbody) return;

    thead.innerHTML = `<tr>
      <th>Employee</th>
      <th>Login ID</th>
      <th>Check In</th>
      <th>Check Out</th>
      <th>Work Hours</th>
      <th>Extra Hours</th>
      <th>Status</th>
    </tr>`;

    const employees = Store.getUsers().filter(u => u.role !== 'admin');
    const records = Store.getAttendanceByDate(currentDayDate);
    const recMap = {};
    records.forEach(r => recMap[r.userId] = r);

    const isWeekend = new Date(currentDayDate + 'T00:00:00').getDay() === 0 || new Date(currentDayDate + 'T00:00:00').getDay() === 6;
    const isFuture  = currentDayDate > Utils.today();
    const todayStr  = Utils.today();

    let rows = '';
    employees.forEach(emp => {
      if (daySearch && !emp.name.toLowerCase().includes(daySearch.toLowerCase()) && !emp.loginId.toLowerCase().includes(daySearch.toLowerCase())) return;

      const rec = recMap[emp.id];
      // Check for leave
      const leaves = Store.getLeavesByUser(emp.id);
      const onLeave = leaves.some(l => l.status === 'approved' && l.startDate <= currentDayDate && l.endDate >= currentDayDate);

      let status = '—';
      if (onLeave)       status = Utils.statusBadge('leave');
      else if (isWeekend)status = '<span class="badge badge-gray">Weekend</span>';
      else if (isFuture) status = '<span class="badge badge-gray">—</span>';
      else if (rec)      status = Utils.statusBadge(rec.status);
      else               status = Utils.statusBadge('absent');

      rows += `<tr>
        <td style="display:flex;align-items:center;gap:8px">
          ${Utils.avatarHTML(emp, 'sm')}
          <span style="font-weight:500;color:var(--color-text-900)">${emp.name}</span>
        </td>
        <td style="color:var(--color-text-500)">${emp.loginId || '—'}</td>
        <td>${rec?.checkIn  ? Utils.formatTime(rec.checkIn)  : '<span style="color:var(--color-text-300)">—</span>'}</td>
        <td>${rec?.checkOut ? Utils.formatTime(rec.checkOut) : '<span style="color:var(--color-text-300)">—</span>'}</td>
        <td>${rec?.workHours  ? `<strong>${rec.workHours}h</strong>` : '<span style="color:var(--color-text-300)">—</span>'}</td>
        <td>${rec?.extraHours && parseFloat(rec.extraHours) > 0 ? `<span style="color:var(--color-success)">+${rec.extraHours}h</span>` : '<span style="color:var(--color-text-300)">0h</span>'}</td>
        <td>${status}</td>
      </tr>`;
    });

    tbody.innerHTML = rows || `<tr><td colspan="7"><div class="empty-state" style="padding:var(--space-10)"><div class="empty-state-title">No employees found</div></div></td></tr>`;

    // Bind search event
    document.getElementById('day-search')?.addEventListener('input', (e) => {
      daySearch = e.target.value;
      _renderDayTable();
    });
  };

  const prevPeriod = () => {
    currentMonth--;
    if (currentMonth < 1) { currentMonth = 12; currentYear--; }
    _renderTable(viewEmployee);
  };

  const nextPeriod = () => {
    currentMonth++;
    if (currentMonth > 12) { currentMonth = 1; currentYear++; }
    _renderTable(viewEmployee);
  };

  const prevDay = () => {
    const d = new Date(currentDayDate + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    currentDayDate = d.toISOString().split('T')[0];
    _renderTable(viewEmployee);
  };

  const nextDay = () => {
    const d = new Date(currentDayDate + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    currentDayDate = d.toISOString().split('T')[0];
    _renderTable(viewEmployee);
  };

  const _bindEvents = (user) => {
    document.getElementById('emp-switcher')?.addEventListener('change', (e) => {
      const uid = e.target.value;
      viewEmployee = Store.getUserById(uid) || user;
      _renderTable(viewEmployee);
    });

    document.getElementById('view-month')?.addEventListener('click', () => {
      currentView = 'month';
      document.getElementById('app').innerHTML = App.renderShell('attendance', _buildHTML(user));
      _bindEvents(user);
      _renderTable(viewEmployee);
    });

    document.getElementById('view-day')?.addEventListener('click', () => {
      currentView = 'day';
      document.getElementById('app').innerHTML = App.renderShell('attendance', _buildHTML(user));
      _bindEvents(user);
      _renderTable(viewEmployee);
    });
  };

  return { render, prevPeriod, nextPeriod, prevDay, nextDay };
})();
