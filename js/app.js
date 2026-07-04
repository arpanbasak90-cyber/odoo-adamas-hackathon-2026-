/* ============================================================
   HRMS App — Router, Layout, Navbar renderer
   ============================================================ */

const App = (() => {

  // ── Navbar Icons ─────────────────────────────────────────────
  const icons = {
    employees:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    attendance: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="m9 16 2 2 4-4"/></svg>`,
    leave:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    profile:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    logout:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
    chevron:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>`,
    settings:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>`,
  };

  // ── Render Navbar ─────────────────────────────────────────────
  const renderNavbar = (activePage) => {
    const user    = Auth.getCurrentUser();
    const company = Store.getCompany();
    const isAdmin = Auth.isAdmin();

    const todayAtt  = user ? Store.getTodayAttendance(user.id) : null;
    const checkedIn = todayAtt && todayAtt.checkIn && !todayAtt.checkOut;
    const pendingCount = isAdmin ? Store.getPendingLeaves().length : 0;

    const companyName = company?.name || 'HRMS';
    const companyInitial = companyName[0]?.toUpperCase() || 'H';

    return `
    <nav class="navbar" id="main-navbar">
      <a class="navbar-brand" href="#/employees">
        <div class="navbar-logo-placeholder">${companyInitial}</div>
        <span class="navbar-company-name">${companyName}</span>
      </a>

      <div class="navbar-nav">
        <button class="nav-link ${activePage === 'employees' ? 'active' : ''}" onclick="Router.go('employees')" id="nav-employees">
          ${icons.employees} Employees
        </button>
        <button class="nav-link ${activePage === 'attendance' ? 'active' : ''}" onclick="Router.go('attendance')" id="nav-attendance">
          ${icons.attendance} Attendance
        </button>
        <button class="nav-link ${activePage === 'leave' ? 'active' : ''}" onclick="Router.go('leave')" id="nav-leave">
          ${icons.leave} Time Off
          ${pendingCount > 0 ? `<span class="badge badge-danger" style="padding:2px 6px;font-size:10px">${pendingCount}</span>` : ''}
        </button>
      </div>

      <div class="navbar-right">
        <!-- Check-in status dot -->
        <div class="checkin-status-dot ${checkedIn ? 'checked-in' : ''}" title="${checkedIn ? 'Checked In' : 'Not Checked In'}"></div>

        <!-- Profile Avatar Dropdown -->
        <div class="dropdown" id="profile-dropdown">
          <button class="avatar-btn" onclick="App.toggleDropdown()" id="avatar-dropdown-btn">
            ${Utils.avatarHTML(user, 'sm')}
            <span style="font-size:var(--font-size-sm);font-weight:500;color:var(--color-text-700);max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${user?.name?.split(' ')[0] || 'User'}</span>
            ${icons.chevron}
          </button>
          <div class="dropdown-menu" id="avatar-dropdown-menu" style="display:none">
            <div style="padding:var(--space-3) var(--space-4);border-bottom:1px solid var(--color-border)">
              <div style="font-size:var(--font-size-sm);font-weight:600;color:var(--color-text-900)">${user?.name || ''}</div>
              <div style="font-size:var(--font-size-xs);color:var(--color-text-400);margin-top:2px">${user?.designation || user?.role}</div>
            </div>
            <button class="dropdown-item" onclick="App.goMyProfile()">
              ${icons.profile} My Profile
            </button>
            <div class="dropdown-divider"></div>
            <button class="dropdown-item danger" onclick="Auth.logout()">
              ${icons.logout} Log Out
            </button>
          </div>
        </div>
      </div>
    </nav>`;
  };

  // ── Render Page Shell ─────────────────────────────────────────
  const renderShell = (activePage, content) => {
    return `
      <div class="page-wrapper">
        ${renderNavbar(activePage)}
        <div class="page-content animate-fade-in">
          ${content}
        </div>
      </div>`;
  };

  // ── Dropdown Toggle ───────────────────────────────────────────
  const toggleDropdown = () => {
    const menu = document.getElementById('avatar-dropdown-menu');
    if (!menu) return;
    const isHidden = menu.style.display === 'none';
    menu.style.display = isHidden ? 'block' : 'none';
  };

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('profile-dropdown');
    if (dropdown && !dropdown.contains(e.target)) {
      const menu = document.getElementById('avatar-dropdown-menu');
      if (menu) menu.style.display = 'none';
    }
  });

  const goMyProfile = () => {
    const user = Auth.getCurrentUser();
    if (user) Router.go('profile', { id: user.id, mode: 'edit' });
    const menu = document.getElementById('avatar-dropdown-menu');
    if (menu) menu.style.display = 'none';
  };

  // ── Init ──────────────────────────────────────────────────────
  const init = () => {
    // Seed demo data on first run
    Seed.run();
    // Start router
    Router.init();
  };

  return { renderNavbar, renderShell, toggleDropdown, goMyProfile, init };
})();

// ── Router ────────────────────────────────────────────────────
const Router = (() => {
  const routes = {
    '':          () => Auth.isLoggedIn() ? go('employees') : go('login'),
    'login':     () => Pages.Login.render(),
    'signup':    () => Pages.Signup.render(),
    'employees': () => Pages.Employees.render(),
    'attendance':() => Pages.Attendance.render(),
    'leave':     () => Pages.Leave.render(),
    'profile':   () => Pages.Profile.render(),
  };

  let params = {};

  const parseHash = () => {
    const hash = window.location.hash.replace('#/', '').split('?');
    const page = hash[0] || '';
    const qp   = {};
    if (hash[1]) hash[1].split('&').forEach(p => { const [k,v] = p.split('='); qp[k] = decodeURIComponent(v||''); });
    return { page, params: qp };
  };

  const getParams = () => params;

  const go = (page, p = {}) => {
    params = p;
    let qs = Object.entries(p).map(([k,v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    window.location.hash = `#/${page}${qs ? '?' + qs : ''}`;
  };

  const init = () => {
    const navigate = () => {
      const { page, params: qp } = parseHash();
      params = qp;
      const handler = routes[page] || routes[''];
      const app     = document.getElementById('app');
      if (app) app.innerHTML = '';
      handler();
    };
    window.addEventListener('hashchange', navigate);
    navigate();
  };

  return { init, go, getParams };
})();

// ── Pages namespace ───────────────────────────────────────────
const Pages = {};

// Start when all scripts are loaded
window.addEventListener('load', App.init);
