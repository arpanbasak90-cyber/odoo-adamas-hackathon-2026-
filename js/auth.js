/* ============================================================
   HRMS Auth — Supabase/Async Edition
   Session management, role guards with support for async Store.
   ============================================================ */

const Auth = (() => {
  const SESSION_KEY = 'hrms_session';
  let _cachedUser = null; // Cache to allow synchronous checks where needed

  const getSession = () => JSON.parse(sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY) || 'null');
  
  const _setSession = (user, remember) => {
    const data = JSON.stringify({ id: user.id, role: user.role, name: user.name, designation: user.designation });
    sessionStorage.setItem(SESSION_KEY, data);
    if (remember) localStorage.setItem(SESSION_KEY, data);
    _cachedUser = user;
  };

  const clearSession = () => {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
    _cachedUser = null;
  };

  // Async fetch for fresh user data
  const getCurrentUser = async () => {
    const session = getSession();
    if (!session) return null;
    try {
      const user = await Store.getUserById(session.id);
      _cachedUser = user;
      return user;
    } catch (e) {
      console.error('[Auth] Failed to fetch current user', e);
      return session; // Fallback to session details if database is down
    }
  };

  // Sync check using session cache
  const getCurrentUserSync = () => {
    if (_cachedUser) return _cachedUser;
    const session = getSession();
    return session;
  };

  const isLoggedIn = () => {
    return !!getSession();
  };

  const isAdmin = () => {
    const u = getCurrentUserSync();
    return u && (u.role === 'admin' || u.role === 'hr');
  };

  // Async login using database verification function
  const login = async (loginIdOrEmail, password, remember = false) => {
    try {
      // Direct call to stored procedure for secure server-side verification
      const { data, error } = await window._supabase.rpc('fn_verify_password', {
        p_login_or_email: loginIdOrEmail,
        p_password:       password
      });

      if (error) throw error;
      if (!data) return { ok: false, error: 'Incorrect credentials. Please try again.' };

      // Handle both single object or array response from Supabase RPC
      const userRecord = Array.isArray(data) ? data[0] : data;
      if (!userRecord) return { ok: false, error: 'Incorrect credentials. Please try again.' };

      // Map snake_case response to user object
      const user = {
        id: userRecord.id,
        loginId: userRecord.login_id,
        email: userRecord.email,
        role: userRecord.role,
        name: userRecord.name,
        designation: userRecord.designation,
        department: userRecord.department
      };

      _setSession(user, remember);
      return { ok: true, user };
    } catch (e) {
      console.error('[Auth] Login error:', e);
      return { ok: false, error: e.message || 'An error occurred during authentication.' };
    }
  };

  const logout = () => {
    clearSession();
    window.location.hash = '#/login';
  };

  // Route guard — call at top of each page init
  const requireAuth = (role = null) => {
    const user = getSession();
    if (!user) {
      window.location.hash = '#/login';
      return null;
    }
    if (role && user.role !== role && !(role === 'admin' && user.role === 'hr')) {
      window.location.hash = '#/employees';
      return null;
    }
    return user;
  };

  const requireGuest = () => {
    if (isLoggedIn()) {
      window.location.hash = '#/employees';
      return false;
    }
    return true;
  };

  return { 
    getSession, 
    getCurrentUser, 
    getCurrentUserSync, 
    isLoggedIn, 
    isAdmin, 
    login, 
    logout, 
    requireAuth, 
    requireGuest 
  };
})();
