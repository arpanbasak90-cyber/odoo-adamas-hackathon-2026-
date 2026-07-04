/* ============================================================
   Leave / Time Off Page (Supabase Async Version)
   ============================================================ */
Pages.Leave = (() => {

  let activeTab = 'timeoff'; // 'timeoff' | 'allocation'

  const render = async () => {
    const user = Auth.requireAuth();
    if (!user) return;
    document.title = 'Time Off — HRMS';

    document.getElementById('app').innerHTML = await App.renderShell('leave', await _buildHTML(user));
    _bindEvents(user);
  };

  const _buildHTML = async (user) => {
    const isAdmin = Auth.isAdmin();
    const balanceCardsHTML = await _renderBalanceCards(user);
    const mainContentHTML = isAdmin ? await _renderAdminTable() : await _renderEmployeeView(user);

    return `
    <div class="page-header">
      <div class="page-header-left">
        <h1 class="page-title">Time Off</h1>
        <p class="page-subtitle">${isAdmin ? 'Manage leave requests for all employees' : 'Apply and track your time off'}</p>
      </div>
      <div class="page-header-right">
        ${isAdmin ? `
        <div class="search-bar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input class="search-input" type="text" id="leave-search" placeholder="Search employees..." />
        </div>` : ''}
        <button class="btn btn-primary" id="new-leave-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Request
        </button>
      </div>
    </div>

    <!-- Tabs (Admin only) -->
    ${isAdmin ? `
    <div class="tabs">
      <button class="tab-btn active" data-tab="timeoff" id="tab-timeoff">Time Off</button>
      <button class="tab-btn" data-tab="allocation" id="tab-allocation">Allocation</button>
    </div>` : ''}

    <!-- Leave Balance Cards -->
    <div class="leave-balance-cards animate-fade-in-up" id="balance-cards">
      ${balanceCardsHTML}
    </div>

    <!-- Main Content -->
    <div id="leave-main-content">
      ${mainContentHTML}
    </div>`;
  };

  const _renderBalanceCards = async (user) => {
    const bal = await Store.getLeaveBalance(user.id);
    return `
    <div class="leave-balance-card">
      <div class="leave-balance-icon" style="background:#FEF3C7">🌴</div>
      <div>
        <div class="leave-balance-days">${bal.paid}</div>
        <div class="leave-balance-label">Paid Time Off Available</div>
      </div>
    </div>
    <div class="leave-balance-card">
      <div class="leave-balance-icon" style="background:#FEE2E2">🤒</div>
      <div>
        <div class="leave-balance-days">${bal.sick}</div>
        <div class="leave-balance-label">Sick Leave Available</div>
      </div>
    </div>
    <div class="leave-balance-card">
      <div class="leave-balance-icon" style="background:var(--color-surface-2)">📋</div>
      <div>
        <div class="leave-balance-days">∞</div>
        <div class="leave-balance-label">Unpaid Leave</div>
      </div>
    </div>`;
  };

  // ── Employee View: 12-month calendar ──────────────────────────
  const _renderEmployeeView = async (user) => {
    const year = new Date().getFullYear();
    const calendarHTML = await _renderYearCalendar(user, year);
    const leavesHTML = await _renderMyLeaves(user);

    return `
    <!-- Legend -->
    <div class="leave-legend">
      <div class="legend-item"><div class="legend-dot validated"></div> Validated / Approved</div>
      <div class="legend-item"><div class="legend-dot to-approve"></div> Pending Approval</div>
      <div class="legend-item"><div class="legend-dot refused"></div> Rejected</div>
      <div class="legend-item"><div class="legend-dot holiday"></div> Public Holiday</div>
    </div>

    <!-- 12-Month Calendar Grid -->
    <div class="year-calendar stagger" id="year-calendar">
      ${calendarHTML}
    </div>

    <!-- My Leave Requests Table -->
    <div class="card animate-fade-in-up" style="margin-top:var(--space-6)">
      <div class="card-header">
        <span class="card-title">My Leave Requests</span>
      </div>
      <div class="table-container" style="border:none;border-radius:0;box-shadow:none">
        <table class="table">
          <thead>
            <tr>
              <th>Type</th><th>From</th><th>To</th><th>Days</th><th>Remarks</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${leavesHTML}
          </tbody>
        </table>
      </div>
    </div>`;
  };

  const _renderYearCalendar = async (user, year) => {
    const leaves   = await Store.getLeavesByUser(user.id);
    const holidays = await Store.getHolidays();
    const today    = Utils.today();

    const leaveMap = {};
    leaves.forEach(l => {
      const s = new Date(l.startDate);
      const e = new Date(l.endDate);
      for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
        const ds = d.toISOString().split('T')[0];
        leaveMap[ds] = l.status === 'approved' ? 'validated' : l.status === 'rejected' ? 'refused' : 'to-approve';
      }
    });
    const holidaySet = new Set(holidays.map(h => h.date));

    const months = [];
    for (let m = 1; m <= 12; m++) {
      const monthName = new Date(year, m - 1, 1).toLocaleDateString('en-IN', { month: 'long' });
      const days = Utils.daysInMonth(year, m);
      const firstDay = Utils.firstDayOfMonth(year, m);
      const DAY_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

      let dayHeaders = DAY_LABELS.map(d => `<div class="cal-day-header">${d}</div>`).join('');
      let cells = Array(firstDay).fill(`<div class="cal-day empty"></div>`).join('');

      for (let d = 1; d <= days; d++) {
        const dateStr = `${year}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const isWknd  = Utils.isWeekend(year, m, d);
        const isHol   = holidaySet.has(dateStr);
        const leaveStatus = leaveMap[dateStr];
        const isTod   = dateStr === today;

        let cls = 'cal-day';
        if (isTod)               cls += ' today';
        else if (isHol)          cls += ' holiday';
        else if (isWknd)         cls += ' weekend';
        else if (leaveStatus)    cls += ` ${leaveStatus}`;

        const holiday = holidays.find(h => h.date === dateStr);
        cells += `<div class="${cls}" title="${holiday ? holiday.name : ''}">${d}</div>`;
      }

      months.push(`
        <div class="month-calendar animate-fade-in-up">
          <div class="month-calendar-header">${monthName} ${year}</div>
          <div class="month-calendar-grid">
            ${dayHeaders}
            ${cells}
          </div>
        </div>`);
    }
    return months.join('');
  };

  const _renderMyLeaves = async (user) => {
    const leaves = await Store.getLeavesByUser(user.id);
    if (!leaves.length) return `<tr><td colspan="6"><div class="empty-state" style="padding:var(--space-8)"><div class="empty-state-icon">🏖️</div><div class="empty-state-title">No leave requests yet</div></div></td></tr>`;

    return leaves.map(l => `
    <tr>
      <td><span class="badge ${l.leaveType === 'paid' ? 'badge-success' : l.leaveType === 'sick' ? 'badge-danger' : 'badge-gray'}">${l.leaveType === 'paid' ? '🌴 Paid' : l.leaveType === 'sick' ? '🤒 Sick' : '📋 Unpaid'}</span></td>
      <td>${Utils.formatDate(l.startDate)}</td>
      <td>${Utils.formatDate(l.endDate)}</td>
      <td><strong>${l.allocation || 1}</strong> day${l.allocation > 1 ? 's' : ''}</td>
      <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--color-text-500)">${l.remarks || '—'}</td>
      <td>
        ${Utils.statusBadge(l.status)}
        ${l.adminComment ? `<div style="font-size:10px;color:var(--color-text-400);margin-top:2px">"${l.adminComment}"</div>` : ''}
      </td>
    </tr>`).join('');
  };

  // ── Admin View: Table with Approve/Reject ────────────────────
  const _renderAdminTable = async (searchTerm = '') => {
    let leaves = await Store.getAllLeaves();
    if (searchTerm) {
      leaves = leaves.filter(l => l.employeeName?.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    const rows = leaves.map(l => {
      const avatarHTML = l.employeeAvatar 
        ? `<div class="avatar avatar-sm"><img src="${l.employeeAvatar}" alt="${l.employeeName}" /></div>`
        : `<div class="avatar avatar-sm" style="background:${Utils.getAvatarGradient(l.employeeName || '')}">${Utils.getInitials(l.employeeName || '?')}</div>`;

      return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:var(--space-3)">
            ${avatarHTML}
            <div>
              <div style="font-weight:600;font-size:var(--font-size-sm)">${l.employeeName || '—'}</div>
              <div style="font-size:var(--font-size-xs);color:var(--color-text-400)">${l.employeeDepartment || ''}</div>
            </div>
          </div>
        </td>
        <td>${Utils.formatDate(l.startDate)}</td>
        <td>${Utils.formatDate(l.endDate)}</td>
        <td>${l.allocation || 1} day${(l.allocation||1)>1?'s':''}</td>
        <td><span class="badge ${l.leaveType==='paid'?'badge-success':l.leaveType==='sick'?'badge-danger':'badge-gray'}">${l.leaveType==='paid'?'Paid':l.leaveType==='sick'?'Sick':'Unpaid'}</span></td>
        <td>${Utils.statusBadge(l.status)}</td>
        <td>
          ${l.status === 'pending' ? `
          <div class="leave-table-actions">
            <button class="btn btn-danger btn-sm" onclick="Pages.Leave.rejectLeave('${l.id}')">✕ Reject</button>
            <button class="btn btn-success btn-sm" onclick="Pages.Leave.approveLeave('${l.id}')">✓ Approve</button>
          </div>` : `<span style="font-size:var(--font-size-xs);color:var(--color-text-400)">${l.adminComment ? `"${l.adminComment}"` : '—'}</span>`}
        </td>
      </tr>`;
    }).join('');

    return `
    <div class="table-container">
      <table class="table">
        <thead>
          <tr>
            <th>Employee</th><th>From</th><th>To</th><th>Days</th><th>Type</th><th>Status</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="7"><div class="empty-state" style="padding:var(--space-8)"><div class="empty-state-title">No leave requests found</div></div></td></tr>`}
        </tbody>
      </table>
    </div>`;
  };

  // ── Approve / Reject ─────────────────────────────────────────
  const approveLeave = async (id) => {
    await _openCommentModal(id, 'approve');
  };
  
  const rejectLeave = async (id) => {
    await _openCommentModal(id, 'reject');
  };

  const _openCommentModal = async (leaveId, action) => {
    const leave = await Store.getLeaveById(leaveId);
    const emp   = await Store.getUserById(leave?.userId);
    const isApprove = action === 'approve';

    Utils.openModal(`
      <div class="modal modal-sm animate-scale-in">
        <div class="modal-header">
          <span class="modal-title">${isApprove ? '✓ Approve' : '✕ Reject'} Leave Request</span>
          <button class="modal-close" onclick="Utils.closeModal()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <p style="font-size:var(--font-size-sm);color:var(--color-text-700);margin-bottom:var(--space-4)">
            ${isApprove ? 'Approving' : 'Rejecting'} leave for <strong>${emp?.name}</strong>
            (${Utils.formatDate(leave?.startDate)} → ${Utils.formatDate(leave?.endDate)})
          </p>
          <div class="form-group">
            <label class="form-label">Comment (optional)</label>
            <textarea id="leave-comment" class="form-textarea" placeholder="${isApprove ? 'e.g. Get well soon!' : 'e.g. Insufficient team coverage'}" rows="3"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Utils.closeModal()">Cancel</button>
          <button class="btn ${isApprove ? 'btn-success' : 'btn-danger'}" onclick="Pages.Leave._confirmLeaveAction('${leaveId}','${action}')">
            ${isApprove ? '✓ Approve' : '✕ Reject'}
          </button>
        </div>
      </div>`);
  };

  const _confirmLeaveAction = async (leaveId, action) => {
    const comment = document.getElementById('leave-comment')?.value?.trim();
    if (action === 'approve') {
      await Store.approveLeave(leaveId, comment);
      Utils.toast('Leave approved successfully!', 'success');
    } else {
      await Store.rejectLeave(leaveId, comment);
      Utils.toast('Leave rejected.', 'info');
    }
    Utils.closeModal();

    // Re-render main content
    const content = document.getElementById('leave-main-content');
    if (content) content.innerHTML = await _renderAdminTable();

    // Update pending badge in navbar
    const badge = document.querySelector('#nav-leave .badge');
    const pending = (await Store.getPendingLeaves()).length;
    if (badge) badge.textContent = pending > 0 ? pending : '';
    if (badge && pending === 0) badge.style.display = 'none';
  };

  // ── New Leave Request Modal (Employee) ───────────────────────
  const _openNewLeaveModal = async (user) => {
    const employees = Auth.isAdmin() ? await Store.getEmployees() : [user];

    Utils.openModal(`
      <div class="modal animate-scale-in timeoff-modal">
        <div class="modal-header">
          <span class="modal-title">Time Off Request</span>
          <button class="modal-close" onclick="Utils.closeModal()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <div style="display:flex;flex-direction:column;gap:var(--space-4)">
            ${Auth.isAdmin() ? `
            <div class="form-group">
              <label class="form-label">Employee <span class="required">*</span></label>
              <select id="to-employee" class="form-select">
                ${employees.map(e => `<option value="${e.id}">${e.name}</option>`).join('')}
              </select>
            </div>` : `<input type="hidden" id="to-employee" value="${user.id}" />`}

            <div class="form-group">
              <label class="form-label">Time Off Type <span class="required">*</span></label>
              <select id="to-type" class="form-select">
                <option value="paid">🌴 Paid Time Off</option>
                <option value="sick">🤒 Sick Leave</option>
                <option value="unpaid">📋 Unpaid Leave</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Validity Period <span class="required">*</span></label>
              <div class="validity-row">
                <input type="date" id="to-start" class="form-input" style="flex:1" value="${Utils.today()}" />
                <span class="validity-sep">To</span>
                <input type="date" id="to-end" class="form-input" style="flex:1" value="${Utils.today()}" />
              </div>
              <div class="form-hint" id="to-allocation-hint">Duration: 1 day</div>
            </div>

            <div class="form-group">
              <label class="form-label">Remarks</label>
              <textarea id="to-remarks" class="form-textarea" placeholder="Reason for leave..." rows="3"></textarea>
            </div>

            <div class="form-group">
              <label class="form-label">Attachment <span style="font-size:var(--font-size-xs);color:var(--color-text-400)">(For sick leave certificate)</span></label>
              <div class="file-upload" onclick="document.getElementById('to-attachment').click()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:18px;height:18px;color:var(--color-text-400)"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <div class="file-upload-text"><span>Click to upload</span> or drag and drop</div>
                <input type="file" id="to-attachment" accept="image/*,.pdf" />
              </div>
              <div id="to-attachment-name" style="font-size:var(--font-size-xs);color:var(--color-primary);margin-top:4px"></div>
            </div>

            <div class="form-error" id="to-error"></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Utils.closeModal()">Discard</button>
          <button class="btn btn-primary" onclick="Pages.Leave.submitLeave()">Submit Request</button>
        </div>
      </div>`);

    // Update allocation hint on date change
    ['to-start', 'to-end'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => {
        const s = document.getElementById('to-start')?.value;
        const e = document.getElementById('to-end')?.value;
        if (s && e && e >= s) {
          const days = Utils.dateDiff(s, e);
          document.getElementById('to-allocation-hint').textContent = `Duration: ${days} day${days > 1 ? 's' : ''}`;
        }
      });
    });

    // Attachment name display
    document.getElementById('to-attachment')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) document.getElementById('to-attachment-name').textContent = `📎 ${file.name}`;
    });
  };

  const submitLeave = async () => {
    const uid     = document.getElementById('to-employee')?.value;
    const type    = document.getElementById('to-type')?.value;
    const start   = document.getElementById('to-start')?.value;
    const end     = document.getElementById('to-end')?.value;
    const remarks = document.getElementById('to-remarks')?.value?.trim();
    const attachEl= document.getElementById('to-attachment');
    const attachName = attachEl?.files[0]?.name || null;
    const errEl   = document.getElementById('to-error');
    errEl.textContent = '';

    if (!uid || !type || !start || !end) { errEl.textContent = 'Please fill in all required fields.'; return; }
    if (end < start)                     { errEl.textContent = 'End date must be on or after start date.'; return; }

    const allocation = Utils.dateDiff(start, end);
    await Store.createLeave({ userId: uid, type, startDate: start, endDate: end, remarks, allocation, attachmentName: attachName });
    Utils.closeModal();
    Utils.toast('Leave request submitted successfully!', 'success');

    // Refresh page content
    const user = Auth.getCurrentUserSync();
    const content = document.getElementById('leave-main-content');
    if (content) {
      content.innerHTML = Auth.isAdmin() ? await _renderAdminTable() : await _renderEmployeeView(await Store.getUserById(uid) || user);
    }
  };

  const _renderAllocationTab = async () => {
    const employees = await Store.getEmployees();
    
    // Map leave balances
    const rowsHTML = await Promise.all(employees.map(async (e) => {
      const bal = await Store.getLeaveBalance(e.id);
      return `<tr>
        <td>
          <div style="display:flex;align-items:center;gap:var(--space-3)">
            ${Utils.avatarHTML(e, 'sm')}
            <span style="font-weight:600;font-size:var(--font-size-sm)">${e.name}</span>
          </div>
        </td>
        <td>
          <div style="display:flex;align-items:center;gap:var(--space-2)">
            <input type="number" value="${bal.paid}" min="0" max="365" class="form-input" style="width:70px;padding:4px 8px;font-size:12px" onchange="Pages.Leave.updateBalance('${e.id}','paid',this.value)" />
            <span style="font-size:var(--font-size-xs);color:var(--color-text-400)">days</span>
          </div>
        </td>
        <td>
          <div style="display:flex;align-items:center;gap:var(--space-2)">
            <input type="number" value="${bal.sick}" min="0" max="365" class="form-input" style="width:70px;padding:4px 8px;font-size:12px" onchange="Pages.Leave.updateBalance('${e.id}','sick',this.value)" />
            <span style="font-size:var(--font-size-xs);color:var(--color-text-400)">days</span>
          </div>
        </td>
        <td><span class="badge badge-gray">Unlimited</span></td>
        <td><span style="font-size:var(--font-size-xs);color:var(--color-success)">Auto-saved</span></td>
      </tr>`;
    }));

    return `
    <div class="table-container">
      <table class="table">
        <thead>
          <tr><th>Employee</th><th>Paid Leave</th><th>Sick Leave</th><th>Unpaid</th><th>Actions</th></tr>
        </thead>
        <tbody>
          ${rowsHTML.join('')}
        </tbody>
      </table>
    </div>`;
  };

  const updateBalance = async (userId, field, value) => {
    await Store.updateLeaveBalance(userId, { [field]: parseInt(value) || 0 });
  };

  const _bindEvents = (user) => {
    document.getElementById('new-leave-btn')?.addEventListener('click', () => _openNewLeaveModal(user));

    // Tab switching (Admin)
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeTab = btn.dataset.tab;
        const content = document.getElementById('leave-main-content');
        if (content) content.innerHTML = activeTab === 'allocation' ? await _renderAllocationTab() : await _renderAdminTable();
      });
    });

    // Search
    document.getElementById('leave-search')?.addEventListener('input', async (e) => {
      const content = document.getElementById('leave-main-content');
      if (content) content.innerHTML = await _renderAdminTable(e.target.value);
    });
  };

  return { render, approveLeave, rejectLeave, _confirmLeaveAction, submitLeave, updateBalance };
})();
