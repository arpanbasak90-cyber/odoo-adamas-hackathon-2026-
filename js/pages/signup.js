/* ============================================================
   Signup Page — Admin/Company Setup (Supabase Async Version)
   ============================================================ */
Pages.Signup = (() => {

  let logoBase64 = null;

  const render = () => {
    if (!Auth.requireGuest()) return;
    document.title = 'Set Up Your Company — HRMS';

    document.getElementById('app').innerHTML = `
    <div class="auth-page">
      <!-- Left Brand Side -->
      <div class="auth-brand">
        <div class="auth-brand-logo">🚀</div>
        <div class="auth-brand-tagline">Get Started Today</div>
        <h1 class="auth-brand-title">Set up your HR workspace in minutes.</h1>
        <p class="auth-brand-desc">Create your company account and start managing your team with our powerful HR tools — completely free for the demo.</p>
        <div class="auth-brand-features animate-fade-in-up">
          <div class="auth-brand-feature"><div class="auth-brand-feature-icon">⚡</div>Instant setup, no configuration</div>
          <div class="auth-brand-feature"><div class="auth-brand-feature-icon">🔒</div>Role-based access control</div>
          <div class="auth-brand-feature"><div class="auth-brand-feature-icon">📊</div>Real-time attendance tracking</div>
          <div class="auth-brand-feature"><div class="auth-brand-feature-icon">🤝</div>Auto-generated employee credentials</div>
        </div>
      </div>

      <!-- Right Form Side -->
      <div class="auth-form-side">
        <div class="auth-form-card animate-fade-in-up" style="max-width:440px">
          <div class="auth-form-header">
            <h2 class="auth-form-title">Create your company</h2>
            <p class="auth-form-subtitle">You'll be set up as the HR Admin</p>
          </div>

          <form class="auth-form" id="signup-form" novalidate>
            <!-- Company -->
            <div class="form-group">
              <label class="form-label">Company Details</label>
              <div class="logo-upload-area">
                <div class="logo-preview" id="logo-preview" onclick="document.getElementById('logo-file').click()">
                  <div class="logo-preview-placeholder" id="logo-placeholder">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="m9 9 6 6M15 9l-6 6"/></svg>
                    <span>Logo</span>
                  </div>
                  <img id="logo-img" style="display:none;width:100%;height:100%;object-fit:cover;border-radius:10px" />
                </div>
                <input type="file" id="logo-file" accept="image/*" style="display:none" />
                <div class="form-group" style="flex:1;margin:0">
                  <input type="text" id="companyName" class="form-input" placeholder="Company name" />
                  <div class="form-error" id="companyName-error"></div>
                </div>
              </div>
            </div>

            <div class="divider"></div>

            <!-- Admin -->
            <div class="form-group">
              <label class="form-label" for="name">Your Name <span class="required">*</span></label>
              <input type="text" id="name" class="form-input" placeholder="Full name" autocomplete="name" />
              <div class="form-error" id="name-error"></div>
            </div>

            <div class="form-group">
              <label class="form-label" for="email">Work Email <span class="required">*</span></label>
              <div class="input-icon-wrap">
                <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                <input type="email" id="email" class="form-input" placeholder="admin@company.com" autocomplete="email" />
              </div>
              <div class="form-error" id="email-error"></div>
            </div>

            <div class="form-group">
              <label class="form-label" for="pw">Password <span class="required">*</span></label>
              <div class="input-password-wrap">
                <input type="password" id="pw" class="form-input" placeholder="Create a strong password" autocomplete="new-password" />
                <button type="button" class="input-password-toggle" id="toggle-pw">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
              </div>
              <div class="password-strength" id="strength-bars">
                <div class="strength-bar" id="bar-0"></div><div class="strength-bar" id="bar-1"></div>
                <div class="strength-bar" id="bar-2"></div><div class="strength-bar" id="bar-3"></div>
              </div>
              <div class="form-hint" id="strength-label">Use 8+ chars with uppercase, numbers & symbols</div>
              <div class="form-error" id="pw-error"></div>
            </div>

            <div class="form-group">
              <label class="form-label" for="confirm-pw">Confirm Password <span class="required">*</span></label>
              <div class="input-password-wrap">
                <input type="password" id="confirm-pw" class="form-input" placeholder="Re-enter password" autocomplete="new-password" />
                <button type="button" class="input-password-toggle" id="toggle-confirm-pw">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
              </div>
              <div class="form-error" id="confirm-pw-error"></div>
            </div>

            <div class="form-error" id="form-error" style="text-align:center;padding:var(--space-3);background:var(--color-danger-bg);border-radius:var(--radius-md);display:none"></div>

            <button type="submit" class="btn btn-primary btn-full btn-lg" id="signup-btn">
              Create Company Account
            </button>
          </form>

          <div class="auth-form-footer" style="margin-top:var(--space-5)">
            Already have an account? <a onclick="Router.go('login')" id="goto-login">Sign In</a>
          </div>
        </div>
      </div>
    </div>`;

    _bindEvents();
  };

  const _bindEvents = () => {
    // Logo file upload
    document.getElementById('logo-file')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        logoBase64 = ev.target.result;
        const img = document.getElementById('logo-img');
        const placeholder = document.getElementById('logo-placeholder');
        img.src = logoBase64;
        img.style.display = 'block';
        placeholder.style.display = 'none';
      };
      reader.readAsDataURL(file);
    });

    // Password strength
    document.getElementById('pw')?.addEventListener('input', (e) => {
      const s = Utils.passwordStrength(e.target.value);
      for (let i = 0; i < 4; i++) {
        const bar = document.getElementById(`bar-${i}`);
        bar.className = 'strength-bar';
        if (i < s) bar.classList.add(`active-${['weak','fair','good','strong'][s-1]}`);
      }
      const lbl = document.getElementById('strength-label');
      lbl.textContent = s > 0 ? `Password strength: ${Utils.strengthLabel(s)}` : 'Use 8+ chars with uppercase, numbers & symbols';
      lbl.style.color = ['','var(--color-danger)','var(--color-warning)','var(--color-info)','var(--color-success)'][s];
    });

    // Toggle password visibility
    _togglePw('toggle-pw', 'pw');
    _togglePw('toggle-confirm-pw', 'confirm-pw');

    // Submit
    document.getElementById('signup-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      _submit();
    });
  };

  const _togglePw = (btnId, inputId) => {
    document.getElementById(btnId)?.addEventListener('click', () => {
      const input = document.getElementById(inputId);
      input.type = input.type === 'text' ? 'password' : 'text';
    });
  };

  const _clearErrors = () => {
    ['companyName-error','name-error','email-error','pw-error','confirm-pw-error','form-error'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.textContent = ''; el.style.display = ''; }
    });
  };

  const _showError = (id, msg) => {
    const el = document.getElementById(id);
    if (el) el.textContent = msg;
  };

  const _submit = async () => {
    _clearErrors();
    const companyName = document.getElementById('companyName')?.value?.trim();
    const name        = document.getElementById('name')?.value?.trim();
    const email       = document.getElementById('email')?.value?.trim().toLowerCase();
    const pw          = document.getElementById('pw')?.value;
    const confirmPw   = document.getElementById('confirm-pw')?.value;
    const btn         = document.getElementById('signup-btn');

    let valid = true;
    if (!companyName)              { _showError('companyName-error', 'Company name is required.'); valid = false; }
    if (!name)                     { _showError('name-error', 'Your name is required.'); valid = false; }
    if (!Utils.validate.email(email)) { _showError('email-error', 'Please enter a valid email address.'); valid = false; }
    if (Utils.passwordStrength(pw) < 2) { _showError('pw-error', 'Password is too weak. Add uppercase letters, numbers and symbols.'); valid = false; }
    if (pw !== confirmPw)          { _showError('confirm-pw-error', 'Passwords do not match.'); valid = false; }
    if (!valid) return;

    // Check email uniqueness asynchronously
    const existing = await Store.getUserByEmail(email);
    if (existing) { _showError('email-error', 'An account with this email already exists.'); return; }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Creating your workspace...';

    // Simulated short delay for UI transition
    setTimeout(async () => {
      try {
        // Create company on database
        const { data: company, error: cErr } = await window._supabase
          .from('company')
          .insert([{ name: companyName, logo_url: logoBase64 }])
          .select().single();
        
        if (cErr) throw cErr;

        // Create admin user on database
        await Store.createUser({
          loginId: email,
          name: name,
          email: email,
          password: pw,
          role: 'admin',
          companyId: company.id,
          designation: 'HR Manager',
          department: 'Administration',
          joinDate: Utils.today(),
          serialNo: 0,
        });

        // Log in
        await Auth.login(email, pw, false);
        Utils.toast('Company created! Welcome to HRMS 🎉', 'success');
        setTimeout(() => Router.go('employees'), 500);
      } catch (e) {
        console.error(e);
        _showError('form-error', e.message || 'Workspace creation failed.');
        btn.disabled = false;
        btn.textContent = 'Create Company Account';
      }
    }, 800);
  };

  return { render };
})();
