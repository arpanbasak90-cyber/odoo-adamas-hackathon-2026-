/* ============================================================
   Login Page (Supabase Async Version)
   ============================================================ */
Pages.Login = (() => {

  const render = async () => {
    if (!Auth.requireGuest()) return;
    document.title = 'Sign In — HRMS';
    const company = await Store.getCompany();
    const companyName = company?.name || 'HRMS';

    document.getElementById('app').innerHTML = `
    <div class="auth-page">
      <!-- Left Brand Side -->
      <div class="auth-brand">
        <div class="auth-brand-logo">🏢</div>
        <div class="auth-brand-tagline">Human Resource Management</div>
        <h1 class="auth-brand-title">Every workday,<br>perfectly aligned.</h1>
        <p class="auth-brand-desc">Streamline your HR operations — from attendance tracking and leave management to payroll visibility and employee onboarding.</p>
        <div class="auth-brand-features animate-fade-in-up">
          <div class="auth-brand-feature"><div class="auth-brand-feature-icon">📋</div>Employee Management</div>
          <div class="auth-brand-feature"><div class="auth-brand-feature-icon">📅</div>Attendance Tracking</div>
          <div class="auth-brand-feature"><div class="auth-brand-feature-icon">🏖️</div>Leave Management</div>
          <div class="auth-brand-feature"><div class="auth-brand-feature-icon">💰</div>Payroll Visibility</div>
        </div>
      </div>

      <!-- Right Form Side -->
      <div class="auth-form-side">
        <div class="auth-form-card animate-fade-in-up">
          <div class="auth-form-header">
            <h2 class="auth-form-title">Welcome back</h2>
            <p class="auth-form-subtitle">Sign in to your ${companyName} account</p>
          </div>

          <form class="auth-form" id="login-form" novalidate>
            <div class="form-group">
              <label class="form-label" for="loginId">Login ID or Email</label>
              <div class="input-icon-wrap">
                <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <input type="text" id="loginId" class="form-input" placeholder="e.g. OIJODO2024001 or admin@hrms.com" autocomplete="username" />
              </div>
              <div class="form-error" id="loginId-error"></div>
            </div>

            <div class="form-group">
              <label class="form-label" for="password">Password</label>
              <div class="input-password-wrap">
                <input type="password" id="password" class="form-input" placeholder="Enter your password" autocomplete="current-password" />
                <button type="button" class="input-password-toggle" id="toggle-pw">
                  <svg id="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
              </div>
              <div class="form-error" id="password-error"></div>
            </div>

            <div style="display:flex;align-items:center;justify-content:space-between">
              <label style="display:flex;align-items:center;gap:var(--space-2);font-size:var(--font-size-sm);color:var(--color-text-700);cursor:pointer">
                <input type="checkbox" id="remember-me" style="accent-color:var(--color-primary)" />
                Remember me
              </label>
            </div>

            <div class="form-error" id="form-error" style="text-align:center;padding:var(--space-3);background:var(--color-danger-bg);border-radius:var(--radius-md);display:none"></div>

            <button type="submit" class="btn btn-primary btn-full btn-lg" id="login-btn">
              Sign In
            </button>
          </form>

          <div class="auth-loginid-hint">
            <strong>Demo credentials:</strong><br>
            Admin: <code>admin@hrms.com</code> / <code>Admin@123</code><br>
            Employee: <code>OI-EMP-2024-001</code> / <code>Pass@123</code>
          </div>

          <div class="auth-form-footer" style="margin-top:var(--space-5)">
            Don't have an account? <a onclick="Router.go('signup')" id="goto-signup">Set up your company →</a>
          </div>
        </div>
      </div>
    </div>`;

    _bindEvents();
  };

  const _bindEvents = () => {
    // Toggle password visibility
    const toggleBtn = document.getElementById('toggle-pw');
    const pwInput   = document.getElementById('password');
    toggleBtn?.addEventListener('click', () => {
      const isText = pwInput.type === 'text';
      pwInput.type = isText ? 'password' : 'text';
      toggleBtn.innerHTML = isText
        ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
    });

    // Form submit
    document.getElementById('login-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      _submit();
    });

    // Enter key
    document.getElementById('password')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') _submit();
    });
  };

  const _submit = async () => {
    const loginId  = document.getElementById('loginId')?.value?.trim();
    const password = document.getElementById('password')?.value;
    const remember = document.getElementById('remember-me')?.checked;
    const formErr  = document.getElementById('form-error');
    const btn      = document.getElementById('login-btn');

    // Clear errors
    formErr.style.display = 'none';
    document.getElementById('loginId-error').textContent = '';
    document.getElementById('password-error').textContent = '';

    if (!loginId) { document.getElementById('loginId-error').textContent = 'Please enter your Login ID or email.'; return; }
    if (!password){ document.getElementById('password-error').textContent = 'Please enter your password.'; return; }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Signing in...';

    // Simulated short delay for animation/spinner
    setTimeout(async () => {
      const result = await Auth.login(loginId, password, remember);
      if (result.ok) {
        Utils.toast('Welcome back, ' + (result.user.name?.split(' ')?.[0] || 'User') + '!', 'success');
        setTimeout(() => Router.go('employees'), 300);
      } else {
        formErr.textContent = result.error;
        formErr.style.display = 'block';
        const form = document.getElementById('login-form');
        form?.classList.add('animate-shake');
        setTimeout(() => form?.classList.remove('animate-shake'), 500);
        btn.disabled = false;
        btn.textContent = 'Sign In';
      }
    }, 600);
  };

  return { render };
})();
