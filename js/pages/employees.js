/* ============================================================
   Employees Grid Page — Landing page after login
   ============================================================ */
Pages.Employees = (() => {

  let filter = 'all';
  let search = '';
  let clockInterval = null;

  const render = () => {
    const user = Auth.requireAuth();
    if (!user) return;
    document.title = 'Employees — HRMS';

    document.getElementById('app').innerHTML = App.renderShell('employees', _buildHTML(user));
    _bindEvents(user);
    _startClock();
    _updateCheckinWidget(user);
  };

  const _buildHTML = (user) => {
    const isAdmin  = Auth.isAdmin();
    const employees= Store.getUsers().filter(u => u.role !== 'admin' || isAdmin);
    const today    = Utils.today();

    return `
    <!-- Check-in Widget -->
    <div class="checkin-widget" id="checkin-widget">
      <div class="checkin-time-display">
        <div class="checkin-clock" id="live-clock">--:--:--</div>
        <div class="checkin-date">${new Date().toLocaleDateString('en-IN',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
      </div>
      <div class="checkin-divider"></div>
      <div class="checkin-info" id="checkin-info">
        <div class="checkin-label">Status</div>
        <div class="checkin-value" id="checkin-status-text">Loading...</div>
      </div>
      <div class="checkin-info" id="checkin-duration-wrap" style="display:none">
        <div class="checkin-label">Time Since Check-in</div>
        <div class="checkin-value" id="checkin-duration">00:00:00</div>
      </div>
      <div class="checkin-actions" id="checkin-actions">
        <!-- Rendered dynamically -->
      </div>
    </div>

    <!-- Page Header -->
    <div class="page-header">
      <div class="page-header-left">
        <h1 class="page-title">Employees</h1>
        <p class="page-subtitle">${Store.getEmployees().length} team members</p>
      </div>
      <div class="page-header-right">
        <!-- Filter Pills -->
        <div class="filter-group" id="status-filter">
          <button class="filter-pill active" data-filter="all">All</button>
          <button class="filter-pill" data-filter="present">🟢 Present</button>
          <button class="filter-pill" data-filter="on-leave">✈️ On Leave</button>
          <button class="filter-pill" data-filter="absent">🟡 Absent</button>
        </div>
        <!-- Search -->
        <div class="search-bar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input class="search-input" type="text" id="emp-search" placeholder="Search employees..." />
        </div>
        ${Auth.isAdmin() ? `<button class="btn btn-primary" id="add-emp-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
          Add Employee
        </button>` : ''}
      </div>
    </div>

    <!-- Legend -->
    <div style="display:flex;gap:var(--space-4);margin-bottom:var(--space-4);flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:6px;font-size:var(--font-size-xs);color:var(--color-text-500)"><span style="width:10px;height:10px;border-radius:50%;background:var(--color-success);display:inline-block"></span> Present in office</div>
      <div style="display:flex;align-items:center;gap:6px;font-size:var(--font-size-xs);color:var(--color-text-500)"><span style="font-size:14px">✈️</span> On approved leave</div>
      <div style="display:flex;align-items:center;gap:6px;font-size:var(--font-size-xs);color:var(--color-text-500)"><span style="width:10px;height:10px;border-radius:50%;background:var(--color-warning);display:inline-block"></span> Absent</div>
    </div>

    <!-- Employees Grid -->
    <div class="employees-grid stagger" id="employees-grid">
      ${_renderGrid(Store.getUsers().filter(u => isAdmin || u.role === 'employee'))}
    </div>`;
  };

  const _renderGrid = (users) => {
    const filtered = users.filter(u => {
      const statusMatch = filter === 'all' || Utils.employeeCardStatus(u.id) === filter;
      const searchMatch = !search || u.name.toLowerCase().includes(search) || u.designation?.toLowerCase().includes(search) || u.department?.toLowerCase().includes(search);
      return statusMatch && searchMatch;
    });

    if (filtered.length === 0) return `
      <div style="grid-column:1/-1">
        <div class="empty-state">
          <div class="empty-state-icon">👥</div>
          <div class="empty-state-title">No employees found</div>
          <div class="empty-state-text">Try adjusting your search or filter.</div>
        </div>
      </div>`;

    return filtered.map(u => {
      const status    = Utils.employeeCardStatus(u.id);
      const statusCls = status;
      const statusIcon= status === 'on-leave' ? '✈️' : '';

      return `
      <div class="employee-card animate-fade-in-up" onclick="Pages.Employees.openProfile('${u.id}')" data-id="${u.id}">
        ${statusIcon
          ? `<div class="employee-card-status-icon">${statusIcon}</div>`
          : `<div class="employee-card-status ${statusCls}"></div>`}
        <div class="employee-card-avatar">
          ${Utils.avatarHTML(u, 'lg')}
        </div>
        <div class="employee-card-name">${u.name}</div>
        <div class="employee-card-role">${u.designation || u.role}</div>
        <div>
          <span class="badge badge-gray" style="font-size:10px">${u.department || '—'}</span>
        </div>
      </div>`;
    }).join('');
  };

  const _updateCheckinWidget = (user) => {
    const att  = Store.getTodayAttendance(user.id);
    const actions = document.getElementById('checkin-actions');
    const statusText = document.getElementById('checkin-status-text');
    const durationWrap = document.getElementById('checkin-duration-wrap');

    if (!att || (!att.checkIn)) {
      // Not checked in
      statusText.textContent = 'Not Checked In';
      statusText.style.color = 'var(--color-danger)';
      durationWrap.style.display = 'none';
      if (actions) actions.innerHTML = `<button class="btn-checkin" id="btn-checkin" onclick="Pages.Employees.doCheckIn()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
        Check In
      </button>`;
      // Update navbar dot
      const dot = document.querySelector('.checkin-status-dot');
      if (dot) { dot.classList.remove('checked-in'); }
    } else if (att.checkIn && !att.checkOut) {
      // Checked in, not out
      statusText.textContent = `Checked in at ${Utils.formatTime(att.checkIn)}`;
      statusText.style.color = 'var(--color-success)';
      durationWrap.style.display = 'flex';
      _startDurationCounter(att.checkIn);
      if (actions) actions.innerHTML = `<button class="btn-checkout" id="btn-checkout" onclick="Pages.Employees.doCheckOut()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        Check Out
      </button>`;
      const dot = document.querySelector('.checkin-status-dot');
      if (dot) { dot.classList.add('checked-in'); }
    } else {
      // Fully checked out
      statusText.textContent = `Worked ${att.workHours}h today`;
      statusText.style.color = 'var(--color-text-700)';
      durationWrap.style.display = 'none';
      if (actions) actions.innerHTML = `<span class="badge badge-success" style="padding:8px 16px;font-size:13px">✓ Done for today</span>`;
    }
  };

  let durationInterval = null;
  const _startDurationCounter = (checkInTime) => {
    if (durationInterval) clearInterval(durationInterval);
    const el = document.getElementById('checkin-duration');
    const [ch, cm] = checkInTime.split(':').map(Number);
    const checkInMs = (ch * 60 + cm) * 60000;
    const update = () => {
      if (!el || !document.contains(el)) { clearInterval(durationInterval); return; }
      const now = new Date();
      const nowMs = (now.getHours() * 60 + now.getMinutes()) * 60000 + now.getSeconds() * 1000;
      const diff = Math.max(0, nowMs - checkInMs);
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      el.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    };
    update();
    durationInterval = setInterval(update, 1000);
  };

  const _startClock = () => {
    if (clockInterval) clearInterval(clockInterval);
    const el = document.getElementById('live-clock');
    if (!el) return;
    const tick = () => {
      if (!el || !document.contains(el)) { clearInterval(clockInterval); return; }
      el.textContent = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    };
    tick();
    clockInterval = setInterval(tick, 1000);
  };

  const _bindEvents = (user) => {
    // Filter pills
    document.getElementById('status-filter')?.addEventListener('click', (e) => {
      const pill = e.target.closest('.filter-pill');
      if (!pill) return;
      document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      filter = pill.dataset.filter;
      _refreshGrid();
    });

    // Search
    document.getElementById('emp-search')?.addEventListener('input', (e) => {
      search = e.target.value.toLowerCase();
      _refreshGrid();
    });

    // Add employee (Admin)
    document.getElementById('add-emp-btn')?.addEventListener('click', () => {
      _openAddEmployeeModal();
    });
  };

  const _refreshGrid = () => {
    const isAdmin = Auth.isAdmin();
    const users   = Store.getUsers().filter(u => isAdmin || u.role === 'employee');
    const grid    = document.getElementById('employees-grid');
    if (grid) grid.innerHTML = _renderGrid(users);
  };

  // Open profile (view-only when clicking cards)
  const openProfile = (userId) => {
    Router.go('profile', { id: userId, mode: 'view' });
  };

  // Check In
  const doCheckIn = () => {
    const user = Auth.getCurrentUser();
    Store.checkIn(user.id);
    Utils.toast('Check-in recorded! Have a productive day 🚀', 'success');
    _updateCheckinWidget(user);
  };

  // Check Out
  const doCheckOut = () => {
    const user = Auth.getCurrentUser();
    const att  = Store.checkOut(user.id);
    if (att) {
      Utils.toast(`Checked out! Worked ${att.workHours}h today 👏`, 'success');
      _updateCheckinWidget(user);
    }
  };

  // Add Employee Modal (Admin)
  const _openAddEmployeeModal = () => {
    const company = Store.getCompany();
    Utils.openModal(`
      <div class="modal modal-lg animate-scale-in">
        <div class="modal-header">
          <span class="modal-title">Add New Employee</span>
          <button class="modal-close" onclick="Utils.closeModal()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">First Name <span class="required">*</span></label>
              <input type="text" id="ae-fname" class="form-input" placeholder="First name" />
            </div>
            <div class="form-group">
              <label class="form-label">Last Name <span class="required">*</span></label>
              <input type="text" id="ae-lname" class="form-input" placeholder="Last name" />
            </div>
            <div class="form-group">
              <label class="form-label">Work Email <span class="required">*</span></label>
              <input type="email" id="ae-email" class="form-input" placeholder="employee@company.com" />
            </div>
            <div class="form-group">
              <label class="form-label">Phone</label>
              <input type="text" id="ae-phone" class="form-input" placeholder="+91 98765 43210" />
            </div>
            <div class="form-group">
              <label class="form-label">Department <span class="required">*</span></label>
              <select id="ae-dept" class="form-select">
                <option value="">Select department</option>
                <option>Engineering</option><option>Design</option><option>Marketing</option>
                <option>Sales</option><option>Finance</option><option>HR</option><option>Operations</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Designation <span class="required">*</span></label>
              <input type="text" id="ae-desig" class="form-input" placeholder="Job title" />
            </div>
            <div class="form-group">
              <label class="form-label">Date of Joining <span class="required">*</span></label>
              <input type="date" id="ae-join" class="form-input" value="${Utils.today()}" />
            </div>
            <div class="form-group">
              <label class="form-label">Monthly Wage (₹)</label>
              <input type="number" id="ae-wage" class="form-input" placeholder="e.g. 60000" />
            </div>
          </div>

          <div class="generated-credentials" id="gen-credentials" style="display:none">
            <div class="credentials-title">Auto-Generated Credentials (share with employee)</div>
            <div class="credential-row"><span class="credential-key">Login ID</span><span class="credential-value" id="gen-loginid"></span></div>
            <div class="credential-row"><span class="credential-key">Password</span><span class="credential-value" id="gen-password"></span></div>
            <p style="font-size:var(--font-size-xs);color:var(--color-text-400);margin-top:var(--space-2)">Employee can change this password after first login.</p>
          </div>

          <div class="form-error" id="ae-error" style="margin-top:var(--space-3)"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Utils.closeModal()">Cancel</button>
          <button class="btn btn-primary" id="ae-submit-btn" onclick="Pages.Employees.submitAddEmployee()">Add Employee</button>
        </div>
      </div>
    `);
  };

  const submitAddEmployee = () => {
    const fname = document.getElementById('ae-fname')?.value?.trim();
    const lname = document.getElementById('ae-lname')?.value?.trim();
    const email = document.getElementById('ae-email')?.value?.trim().toLowerCase();
    const phone = document.getElementById('ae-phone')?.value?.trim();
    const dept  = document.getElementById('ae-dept')?.value;
    const desig = document.getElementById('ae-desig')?.value?.trim();
    const join  = document.getElementById('ae-join')?.value;
    const wage  = parseFloat(document.getElementById('ae-wage')?.value) || 0;
    const errEl = document.getElementById('ae-error');
    errEl.textContent = '';

    if (!fname || !lname || !email || !dept || !desig || !join) {
      errEl.textContent = 'Please fill in all required fields.'; return;
    }
    if (!Utils.validate.email(email)) { errEl.textContent = 'Invalid email address.'; return; }
    if (Store.getUserByEmail(email))  { errEl.textContent = 'An account with this email already exists.'; return; }

    const company  = Store.getCompany();
    const serial   = Utils.nextSerial();
    const loginId  = Utils.generateLoginId(company?.name || 'HR', fname, lname, new Date(join).getFullYear(), serial);
    const password = Utils.generatePassword();

    const user = Store.createUser({
      loginId, name: `${fname} ${lname}`, email, password, role: 'employee',
      companyId: company?.id, department: dept, designation: desig,
      joinDate: join, serialNo: serial, phone,
      salary: wage > 0 ? Store.computeSalaryComponents({ monthlyWage: wage, basicPct: 50, hraPct: 50, bonusPct: 10, ltaPct: 5, pfEmployeePct: 12, pfEmployerPct: 12, professionalTax: 200, workingDaysPerWeek: 5 }) : null,
    });

    // Show generated credentials
    document.getElementById('gen-loginid').textContent  = loginId;
    document.getElementById('gen-password').textContent = password;
    document.getElementById('gen-credentials').style.display = 'block';
    document.getElementById('ae-submit-btn').textContent = 'Close & Done';
    document.getElementById('ae-submit-btn').onclick = () => {
      Utils.closeModal();
      Utils.toast(`${fname} ${lname} added successfully!`, 'success');
      _refreshGrid();
    };
  };

  return { render, openProfile, doCheckIn, doCheckOut, submitAddEmployee };
})();
