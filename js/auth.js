/* ============================================================
   HRMS Auth — Session management, role guards
   ============================================================ */

const Auth = (() => {
  const SESSION_KEY = 'hrms_session';

  const getSession    = ()     => JSON.parse(sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY) || 'null');
  const _setSession   = (user, remember) => {
    const data = JSON.stringify(user);
    sessionStorage.setItem(SESSION_KEY, data);
    if (remember) localStorage.setItem(SESSION_KEY, data);
  };
  const clearSession  = ()     => { sessionStorage.removeItem(SESSION_KEY); localStorage.removeItem(SESSION_KEY); };

  const getCurrentUser = () => {
    const session = getSession();
    if (!session) return null;
    // Re-fetch from store for fresh data
    return Store.getUserById(session.id) || null;
  };

  const isLoggedIn = () => !!getCurrentUser();
  const isAdmin    = () => { const u = getCurrentUser(); return u && (u.role === 'admin' || u.role === 'hr'); };

  const login = (loginIdOrEmail, password, remember = false) => {
    // Try login ID first, then email
    let user = Store.getUserByLoginId(loginIdOrEmail) || Store.getUserByEmail(loginIdOrEmail);
    if (!user)       return { ok: false, error: 'No account found with these credentials.' };
    if (user.password !== password) return { ok: false, error: 'Incorrect password. Please try again.' };
    _setSession({ id: user.id, role: user.role }, remember);
    return { ok: true, user };
  };

  const logout = () => {
    clearSession();
    window.location.hash = '#/login';
  };

  // Route guard — call at top of each page init
  const requireAuth = (role = null) => {
    const user = getCurrentUser();
    if (!user) { window.location.hash = '#/login'; return null; }
    if (role && user.role !== role && !(role === 'admin' && user.role === 'hr')) {
      window.location.hash = '#/employees';
      return null;
    }
    return user;
  };

  const requireGuest = () => {
    if (isLoggedIn()) { window.location.hash = '#/employees'; return false; }
    return true;
  };

  return { getSession, getCurrentUser, isLoggedIn, isAdmin, login, logout, requireAuth, requireGuest };
})();
