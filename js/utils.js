/* ============================================================
   HRMS Utils — Helpers: Login ID generation, date/time, formatting
   ============================================================ */

const Utils = (() => {

  // ── Login ID Generator ───────────────────────────────────────
  // Format: [CompanyInitials][First2FirstName][First2LastName][Year][Serial]
  // Example: OIJODO2024001
  const generateLoginId = (companyName, firstName, lastName, joinYear, serialNo) => {
    const initials = (companyName || 'HR')
      .split(/\s+/)
      .map(w => w[0]?.toUpperCase() || '')
      .join('')
      .slice(0, 4);
    const fn = (firstName || '').replace(/\s+/g,'').toUpperCase().slice(0, 2).padEnd(2, 'X');
    const ln = (lastName  || '').replace(/\s+/g,'').toUpperCase().slice(0, 2).padEnd(2, 'X');
    const yr = String(joinYear || new Date().getFullYear());
    const sn = String(serialNo).padStart(3, '0');
    return `${initials}${fn}${ln}${yr}${sn}`;
  };

  // Auto-generate secure-ish initial password
  const generatePassword = () => {
    const chars  = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const special = '@#!$';
    let pw = '';
    for (let i = 0; i < 8; i++) pw += chars[Math.floor(Math.random() * chars.length)];
    pw += special[Math.floor(Math.random() * special.length)];
    pw += Math.floor(Math.random() * 90 + 10);
    return pw;
  };

  // ── Next serial number for employee ─────────────────────────
  const nextSerial = () => {
    const employees = Store.getEmployees();
    return (employees.length + 1);
  };

  // ── Date / Time ──────────────────────────────────────────────
  const today     = () => new Date().toISOString().split('T')[0];
  const nowTime   = () => { const d = new Date(); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; };

  const formatDate = (dateStr, opts = {}) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : ''));
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', ...opts });
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '—';
    const [h, m] = timeStr.split(':').map(Number);
    const ampm   = h >= 12 ? 'PM' : 'AM';
    const hr     = h % 12 || 12;
    return `${hr}:${String(m).padStart(2,'0')} ${ampm}`;
  };

  const formatCurrency = (amount) => {
    if (amount == null || isNaN(amount)) return '—';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  };

  const monthName = (month, year) => {
    return new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  };

  const daysInMonth = (year, month) => new Date(year, month, 0).getDate();

  const firstDayOfMonth = (year, month) => new Date(year, month - 1, 1).getDay();

  const isWeekend = (year, month, day) => {
    const dow = new Date(year, month - 1, day).getDay();
    return dow === 0 || dow === 6;
  };

  const isToday = (dateStr) => dateStr === today();

  const dateDiff = (start, end) => {
    const s = new Date(start);
    const e = new Date(end);
    return Math.round((e - s) / 86400000) + 1;
  };

  const liveTime = (el) => {
    const tick = () => {
      if (!document.contains(el)) return;
      const d = new Date();
      el.textContent = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
      requestAnimationFrame(tick);
    };
    tick();
  };

  // ── Avatar / Initials ────────────────────────────────────────
  const getInitials = (name = '') => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const avatarColors = [
    ['#4F46E5','#7C3AED'], ['#0EA5E9','#6366F1'], ['#10B981','#0EA5E9'],
    ['#F59E0B','#EF4444'], ['#8B5CF6','#EC4899'], ['#14B8A6','#3B82F6'],
    ['#F97316','#EF4444'], ['#6366F1','#8B5CF6'],
  ];
  const getAvatarGradient = (name = '') => {
    const idx = name.charCodeAt(0) % avatarColors.length;
    const [c1, c2] = avatarColors[idx];
    return `linear-gradient(135deg, ${c1}, ${c2})`;
  };

  const avatarHTML = (user, size = 'md', extraClass = '') => {
    const sizeClass = `avatar-${size}`;
    if (user?.profilePic) {
      return `<div class="avatar ${sizeClass} ${extraClass}"><img src="${user.profilePic}" alt="${user.name}" /></div>`;
    }
    const initials = getInitials(user?.name || '?');
    const gradient = getAvatarGradient(user?.name || '');
    return `<div class="avatar ${sizeClass} ${extraClass}" style="background:${gradient}">${initials}</div>`;
  };

  // ── Password strength ────────────────────────────────────────
  const passwordStrength = (pw) => {
    if (!pw) return 0;
    let s = 0;
    if (pw.length >= 8)                      s++;
    if (/[A-Z]/.test(pw))                    s++;
    if (/[0-9]/.test(pw))                    s++;
    if (/[^A-Za-z0-9]/.test(pw))            s++;
    return s; // 0-4
  };

  const strengthLabel = (s) => ['', 'Weak', 'Fair', 'Good', 'Strong'][s] || '';
  const strengthColor = (s) => ['','danger','warning','info','success'][s] || '';

  // ── Attendance status ────────────────────────────────────────
  const statusBadge = (status) => {
    const map = {
      present:   { cls: 'badge-success', label: 'Present' },
      absent:    { cls: 'badge-danger',  label: 'Absent' },
      'half-day':{ cls: 'badge-warning', label: 'Half Day' },
      leave:     { cls: 'badge-info',    label: 'On Leave' },
      pending:   { cls: 'badge-warning', label: 'Pending' },
      approved:  { cls: 'badge-success', label: 'Approved' },
      rejected:  { cls: 'badge-danger',  label: 'Rejected' },
    };
    const s = map[status] || { cls: 'badge-gray', label: status || '—' };
    return `<span class="badge ${s.cls}"><span class="badge-dot"></span>${s.label}</span>`;
  };

  const employeeCardStatus = async (userId) => {
    const today_str = today();
    const att = await Store.getAttendanceByUserAndDate(userId, today_str);
    if (att) {
      if (att.status === 'leave') return 'on-leave';
      return att.status; // present, half-day, absent
    }
    return 'absent';
  };

  // ── Toast ────────────────────────────────────────────────────
  const toast = (msg, type = 'info', duration = 3500) => {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<span class="toast-icon">${icons[type]||'ℹ'}</span><span class="toast-msg">${msg}</span>`;
    container.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(20px)'; t.style.transition = '300ms ease'; setTimeout(() => t.remove(), 300); }, duration);
  };

  // ── Modal helpers ────────────────────────────────────────────
  const openModal = (html) => {
    closeModal();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-overlay';
    overlay.innerHTML = html;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
  };
  const closeModal = () => {
    const o = document.getElementById('modal-overlay');
    if (o) { o.remove(); document.body.style.overflow = ''; }
  };

  // ── Confirm dialog ───────────────────────────────────────────
  const confirm = (msg, onYes, onNo) => {
    openModal(`
      <div class="modal modal-sm animate-scale-in">
        <div class="modal-header">
          <span class="modal-title">Confirm Action</span>
          <button class="modal-close" onclick="Utils.closeModal()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="modal-body"><p style="color:var(--color-text-700);font-size:var(--font-size-sm);line-height:1.6">${msg}</p></div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="confirm-no">Cancel</button>
          <button class="btn btn-danger" id="confirm-yes">Confirm</button>
        </div>
      </div>
    `);
    document.getElementById('confirm-yes').onclick = () => { closeModal(); onYes && onYes(); };
    document.getElementById('confirm-no').onclick  = () => { closeModal(); onNo  && onNo();  };
  };

  // ── Validation ───────────────────────────────────────────────
  const validate = {
    email:    (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    phone:    (v) => /^\+?[\d\s\-()]{7,15}$/.test(v),
    required: (v) => v !== null && v !== undefined && String(v).trim() !== '',
    minLen:   (v, n) => String(v).length >= n,
  };

  return {
    generateLoginId, generatePassword, nextSerial,
    today, nowTime, formatDate, formatTime, formatCurrency, monthName,
    daysInMonth, firstDayOfMonth, isWeekend, isToday, dateDiff, liveTime,
    getInitials, getAvatarGradient, avatarHTML,
    passwordStrength, strengthLabel, strengthColor,
    statusBadge, employeeCardStatus,
    toast, openModal, closeModal, confirm,
    validate,
  };
})();
