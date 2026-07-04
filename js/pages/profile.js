/* ============================================================
   Profile Page (Supabase Async Version)
   ============================================================ */
Pages.Profile = (() => {

  let editMode    = false;
  let targetUser  = null;
  let activeTab   = 'personal';
  let profilePicBase64 = null;

  const render = async () => {
    const currentUser = Auth.requireAuth();
    if (!currentUser) return;

    profilePicBase64 = null; // Clear any pending profile pic from a previous edit

    const params = Router.getParams();
    const uid    = params.id || currentUser.id;
    const mode   = params.mode || 'view';

    targetUser = await Store.getUserById(uid);
    if (!targetUser) targetUser = currentUser;

    editMode = mode === 'edit' || (Auth.isAdmin() && mode !== 'view');
    // Employees editing their own profile
    if (targetUser.id === currentUser.id && !Auth.isAdmin()) editMode = true;

    document.title = `${targetUser.name} — HRMS`;
    const shellHTML = await App.renderShell('employees', _buildHTML(currentUser));
    document.getElementById('app').innerHTML = shellHTML;
    _renderTabContent();
    _bindEvents(currentUser);
  };

  const _buildHTML = (currentUser) => {
    const isOwn   = targetUser.id === currentUser.id;
    const isAdmin = Auth.isAdmin();
    const canEdit = isAdmin || isOwn;

    return `
    <!-- Back button -->
    <div style="margin-bottom:var(--space-4)">
      <button class="btn btn-ghost btn-sm" onclick="Router.go('employees')" style="gap:var(--space-2)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><path d="m15 18-6-6 6-6"/></svg>
        Back to Employees
      </button>
    </div>

    <div class="profile-layout">
      <!-- Sidebar Card -->
      <div class="profile-sidebar-card animate-fade-in">
        <div class="profile-avatar-wrap">
          ${Utils.avatarHTML(targetUser, '2xl')}
          ${canEdit ? `<label class="profile-avatar-upload" title="Change photo" for="profile-pic-input">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <input type="file" id="profile-pic-input" accept="image/*" style="display:none" />
          </label>` : ''}
        </div>
        <div class="profile-name">${targetUser.name}</div>
        <div class="profile-designation">${targetUser.designation || targetUser.role}</div>
        <div class="profile-loginid">${targetUser.loginId || '—'}</div>

        <div style="margin-top:var(--space-4);text-align:left;width:100%">
          <div class="profile-meta-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
            <span>${targetUser.department || '—'}</span>
          </div>
          <div class="profile-meta-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span>Joined ${Utils.formatDate(targetUser.joinDate)}</span>
          </div>
          <div class="profile-meta-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13 19.79 19.79 0 0 1 1.61 4.27 2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.09 6.09l1.27-.84a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            <span>${targetUser.phone || '—'}</span>
          </div>
          <div class="profile-meta-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            <span style="word-break:break-all">${targetUser.email || '—'}</span>
          </div>
        </div>

        ${canEdit ? `<button class="btn btn-primary btn-full" style="margin-top:var(--space-5)" id="edit-save-btn">
          ${editMode ? '💾 Save Changes' : '✏️ Edit Profile'}
        </button>` : ''}
        ${editMode && canEdit ? `<button class="btn btn-secondary btn-full" style="margin-top:var(--space-2)" onclick="Pages.Profile.cancelEdit()">Cancel</button>` : ''}
      </div>

      <!-- Main Card -->
      <div class="profile-main-card animate-fade-in-up">
        <div class="card-body" style="padding:0">
          <!-- Tabs -->
          <div style="padding:0 var(--space-6)">
            <div class="tabs" id="profile-tabs">
              <button class="tab-btn active" data-tab="personal">Personal Info</button>
              <button class="tab-btn" data-tab="private">Private Info</button>
              <button class="tab-btn" data-tab="salary">Salary Info</button>
              <button class="tab-btn" data-tab="documents">Documents</button>
            </div>
          </div>
          <!-- Tab content -->
          <div id="profile-tab-content" style="padding:var(--space-6);padding-top:0">
          </div>
        </div>
      </div>
    </div>`;
  };

  const _renderTabContent = () => {
    const isAdmin = Auth.isAdmin();
    const canEditField = (field) => {
      if (isAdmin) return true;
      // Employees can only edit: phone, address, about, skills, certifications, profilePic
      return ['phone', 'address', 'about', 'skills', 'certifications'].includes(field);
    };

    const field = (label, key, type = 'text', options = null) => {
      const val = targetUser[key] || '';
      const editable = editMode && canEditField(key);

      if (!editable) {
        return `<div class="info-field">
          <label>${label}</label>
          <div class="info-value">${val || '—'}</div>
        </div>`;
      }

      if (type === 'select' && options) {
        return `<div class="info-field">
          <label>${label}</label>
          <select class="form-select" id="field-${key}" style="margin-top:4px">
            ${options.map(o => `<option ${val === o ? 'selected' : ''}>${o}</option>`).join('')}
          </select>
        </div>`;
      }
      if (type === 'date') {
        return `<div class="info-field">
          <label>${label}</label>
          <input type="date" id="field-${key}" class="form-input" value="${val}" style="margin-top:4px" />
        </div>`;
      }
      if (type === 'textarea') {
        return `<div class="info-field full-width">
          <label>${label}</label>
          <textarea id="field-${key}" class="form-textarea" style="margin-top:4px">${val}</textarea>
        </div>`;
      }
      return `<div class="info-field">
        <label>${label}</label>
        <input type="${type}" id="field-${key}" class="form-input" value="${val}" style="margin-top:4px" />
      </div>`;
    };

    const content = document.getElementById('profile-tab-content');
    if (!content) return;

    if (activeTab === 'personal') {
      content.innerHTML = `
      <div class="info-grid">
        ${field('Full Name',    'name',        'text')}
        ${field('Date of Birth','dob',         'date')}
        ${field('Phone',        'phone',       'tel')}
        ${field('Email',        'email',       'email')}
        ${field('Department',   'department',  'select', ['Engineering','Design','Marketing','Sales','Finance','HR','Operations','Administration'])}
        ${field('Designation',  'designation', 'text')}
        ${field('About',        'about',       'textarea')}
      </div>

      <div style="margin-top:var(--space-6)">
        <div class="section-title">Skills</div>
        <div class="tags-container" id="skills-container">
          ${(targetUser.skills || []).map(s => `<span class="tag">${s}${editMode ? `<span class="tag-remove" onclick="Pages.Profile.removeTag('skills','${s}')">×</span>` : ''}</span>`).join('')}
          ${editMode ? `<button class="tag-input" onclick="Pages.Profile.addTag('skills')">+ Add skill</button>` : ''}
        </div>
      </div>

      <div style="margin-top:var(--space-5)">
        <div class="section-title">Certifications</div>
        <div class="tags-container" id="certifications-container">
          ${(targetUser.certifications || []).map(c => `<span class="tag">${c}${editMode ? `<span class="tag-remove" onclick="Pages.Profile.removeTag('certifications','${c}')">×</span>` : ''}</span>`).join('')}
          ${editMode ? `<button class="tag-input" onclick="Pages.Profile.addTag('certifications')">+ Add certification</button>` : ''}
        </div>
      </div>`;

    } else if (activeTab === 'private') {
      content.innerHTML = `
      <div class="info-grid">
        ${field('Address',        'address',       'text')}
        ${field('Date of Joining','joinDate',       'date')}
        ${field('Employee ID',    'loginId',        'text')}
        ${field('Account Number', 'accountNumber',  'text')}
      </div>`;

    } else if (activeTab === 'salary') {
      const salary = targetUser.salary;
      if (!salary) {
        content.innerHTML = `<div class="empty-state" style="padding:var(--space-10)"><div class="empty-state-icon">💰</div><div class="empty-state-title">No salary structure set</div>${isAdmin ? `<button class="btn btn-primary" style="margin-top:var(--space-4)" onclick="Pages.Profile.openSalaryEditor()">Set Up Salary</button>` : '<div class="empty-state-text">Contact your HR admin.</div>'}</div>`;
        return;
      }
      content.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-5)">
        <div>
          <div style="font-size:var(--font-size-sm);color:var(--color-text-400)">Monthly Wage</div>
          <div style="font-size:var(--font-size-3xl);font-weight:700;color:var(--color-text-900)">${Utils.formatCurrency(salary.monthlyWage)}</div>
          <div style="font-size:var(--font-size-sm);color:var(--color-text-400)">Yearly: ${Utils.formatCurrency(salary.yearlyWage)}</div>
        </div>
        ${isAdmin ? `<button class="btn btn-secondary" onclick="Pages.Profile.openSalaryEditor()">✏️ Edit Structure</button>` : ''}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-6)">
        <!-- Earnings -->
        <div>
          <div class="section-title" style="color:var(--color-success)">📈 Earnings</div>
          <div class="salary-component-row">
            <div><div class="salary-component-name">Basic Wage</div><div class="salary-component-formula">${salary.basicPct}% of Monthly Wage</div></div>
            <div class="salary-component-value">${Utils.formatCurrency(salary.basic)}</div>
          </div>
          <div class="salary-component-row">
            <div><div class="salary-component-name">HRA</div><div class="salary-component-formula">${salary.hraPct}% of Basic</div></div>
            <div class="salary-component-value">${Utils.formatCurrency(salary.hra)}</div>
          </div>
          <div class="salary-component-row">
            <div><div class="salary-component-name">Performance Bonus</div><div class="salary-component-formula">${salary.bonusPct}% of Basic</div></div>
            <div class="salary-component-value">${Utils.formatCurrency(salary.bonus)}</div>
          </div>
          <div class="salary-component-row">
            <div><div class="salary-component-name">Leave Travel Allowance</div><div class="salary-component-formula">${salary.ltaPct}% of Basic</div></div>
            <div class="salary-component-value">${Utils.formatCurrency(salary.lta)}</div>
          </div>
          <div class="salary-component-row">
            <div><div class="salary-component-name">Fixed Allowance</div><div class="salary-component-formula">Wage − All components</div></div>
            <div class="salary-component-value">${Utils.formatCurrency(salary.fixedAllowance)}</div>
          </div>
        </div>

        <!-- Deductions -->
        <div>
          <div class="section-title" style="color:var(--color-danger)">📉 Deductions</div>
          <div class="salary-component-row">
            <div><div class="salary-component-name">PF (Employee)</div><div class="salary-component-formula">${salary.pfEmployeePct}% of Basic</div></div>
            <div class="salary-component-value" style="color:var(--color-danger)">−${Utils.formatCurrency(salary.pfEmp)}</div>
          </div>
          <div class="salary-component-row">
            <div><div class="salary-component-name">PF (Employer)</div><div class="salary-component-formula">${salary.pfEmployerPct}% of Basic</div></div>
            <div class="salary-component-value" style="color:var(--color-text-400)">${Utils.formatCurrency(salary.pfEmr)}</div>
          </div>
          <div class="salary-component-row">
            <div><div class="salary-component-name">Professional Tax</div><div class="salary-component-formula">Fixed</div></div>
            <div class="salary-component-value" style="color:var(--color-danger)">−${Utils.formatCurrency(salary.professionalTax)}</div>
          </div>
        </div>
      </div>

      <div class="salary-total-row">
        <div>
          <div class="salary-total-label">💵 Net Monthly Salary</div>
          <div style="font-size:var(--font-size-xs);color:var(--color-primary);opacity:0.8">After all deductions</div>
        </div>
        <div class="salary-total-value">${Utils.formatCurrency(salary.netSalary)}</div>
      </div>`;

    } else if (activeTab === 'documents') {
      const docs = targetUser.documents || [];
      content.innerHTML = `
      ${isAdmin || targetUser.id === Auth.getCurrentUserSync()?.id ? `
      <div style="margin-bottom:var(--space-5)">
        <div class="file-upload" onclick="document.getElementById('doc-upload').click()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:18px;height:18px;color:var(--color-text-400)"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <div class="file-upload-text"><span>Click to upload document</span></div>
          <input type="file" id="doc-upload" accept="image/*,.pdf,.doc,.docx" style="display:none" />
        </div>
      </div>` : ''}
      <div style="display:flex;flex-direction:column;gap:var(--space-2)">
        ${docs.length === 0 ? '<div class="empty-state" style="padding:var(--space-8)"><div class="empty-state-icon">📁</div><div class="empty-state-title">No documents uploaded</div></div>' :
          docs.map((doc, i) => `
          <div class="document-item">
            <div class="document-icon">📄</div>
            <div class="document-name">${doc.name}</div>
            <div class="document-actions">
              <button class="btn btn-ghost btn-sm" style="color:var(--color-danger)" onclick="Pages.Profile.removeDocument(${i})">Remove</button>
            </div>
          </div>`).join('')}
      </div>`;

      // Bind doc upload
      setTimeout(() => {
        document.getElementById('doc-upload')?.addEventListener('change', async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const docs = targetUser.documents || [];
          docs.push({ name: file.name, uploadedAt: Utils.today() });
          await Store.updateUser(targetUser.id, { documents: docs });
          targetUser = await Store.getUserById(targetUser.id);
          _renderTabContent();
          Utils.toast('Document uploaded!', 'success');
        });
      }, 100);
    }
  };

  // ── Salary Editor Modal ──────────────────────────────────────
  const openSalaryEditor = () => {
    const s = targetUser.salary || {};
    Utils.openModal(`
      <div class="modal modal-lg animate-scale-in">
        <div class="modal-header">
          <span class="modal-title">Edit Salary Structure</span>
          <button class="modal-close" onclick="Utils.closeModal()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="grid-2">
            <div class="form-group">
              <label class="form-label">Monthly Wage (₹) <span class="required">*</span></label>
              <input type="number" id="sal-wage" class="form-input" value="${s.monthlyWage||''}" placeholder="e.g. 60000" oninput="Pages.Profile.previewSalary()" />
            </div>
            <div class="form-group">
              <label class="form-label">Working Days/Week</label>
              <select id="sal-wdpw" class="form-select" onchange="Pages.Profile.previewSalary()">
                ${[5,6].map(d => `<option ${s.workingDaysPerWeek===d?'selected':''}>${d} days</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Basic (% of Wage)</label>
              <input type="number" id="sal-basic" class="form-input" value="${s.basicPct||50}" min="1" max="100" oninput="Pages.Profile.previewSalary()" />
            </div>
            <div class="form-group">
              <label class="form-label">HRA (% of Basic)</label>
              <input type="number" id="sal-hra" class="form-input" value="${s.hraPct||50}" min="0" max="100" oninput="Pages.Profile.previewSalary()" />
            </div>
            <div class="form-group">
              <label class="form-label">Performance Bonus (% of Basic)</label>
              <input type="number" id="sal-bonus" class="form-input" value="${s.bonusPct||10}" min="0" max="100" oninput="Pages.Profile.previewSalary()" />
            </div>
            <div class="form-group">
              <label class="form-label">LTA (% of Basic)</label>
              <input type="number" id="sal-lta" class="form-input" value="${s.ltaPct||5}" min="0" max="100" oninput="Pages.Profile.previewSalary()" />
            </div>
            <div class="form-group">
              <label class="form-label">PF Employee (% of Basic)</label>
              <input type="number" id="sal-pfe" class="form-input" value="${s.pfEmployeePct||12}" min="0" max="100" oninput="Pages.Profile.previewSalary()" />
            </div>
            <div class="form-group">
              <label class="form-label">PF Employer (% of Basic)</label>
              <input type="number" id="sal-pfer" class="form-input" value="${s.pfEmployerPct||12}" min="0" max="100" oninput="Pages.Profile.previewSalary()" />
            </div>
            <div class="form-group">
              <label class="form-label">Professional Tax (₹ fixed)</label>
              <input type="number" id="sal-ptax" class="form-input" value="${s.professionalTax||200}" min="0" oninput="Pages.Profile.previewSalary()" />
            </div>
          </div>

          <!-- Live preview -->
          <div id="sal-preview" style="margin-top:var(--space-5);background:var(--color-surface-2);border-radius:var(--radius-lg);padding:var(--space-4)">
            <div style="font-size:var(--font-size-xs);font-weight:600;color:var(--color-text-400);text-transform:uppercase;letter-spacing:.05em;margin-bottom:var(--space-3)">Live Preview</div>
            <div id="sal-preview-content" style="font-size:var(--font-size-sm);color:var(--color-text-500)">Enter a wage to see preview</div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Utils.closeModal()">Cancel</button>
          <button class="btn btn-primary" onclick="Pages.Profile.saveSalary()">Save Salary Structure</button>
        </div>
      </div>`);

    previewSalary();
  };

  const previewSalary = () => {
    const wage = parseFloat(document.getElementById('sal-wage')?.value) || 0;
    if (!wage) return;
    const data = _getSalaryFormData();
    const s = Store.computeSalaryComponents(data);
    const preview = document.getElementById('sal-preview-content');
    if (!preview) return;
    preview.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--space-2)">
        ${[
          ['Basic', s.basic], ['HRA', s.hra], ['Bonus', s.bonus],
          ['LTA', s.lta], ['Fixed Allowance', s.fixedAllowance], ['PF (Emp)', s.pfEmp],
        ].map(([n,v]) => `<div><span style="color:var(--color-text-400)">${n}: </span><strong>${Utils.formatCurrency(v)}</strong></div>`).join('')}
      </div>
      <div style="margin-top:var(--space-3);padding-top:var(--space-3);border-top:1px solid var(--color-border);font-weight:700;font-size:var(--font-size-md);color:var(--color-primary)">
        Net Salary: ${Utils.formatCurrency(s.netSalary)}
      </div>`;
  };

  const _getSalaryFormData = () => ({
    monthlyWage:    document.getElementById('sal-wage')?.value,
    basicPct:       document.getElementById('sal-basic')?.value,
    hraPct:         document.getElementById('sal-hra')?.value,
    bonusPct:       document.getElementById('sal-bonus')?.value,
    ltaPct:         document.getElementById('sal-lta')?.value,
    pfEmployeePct:  document.getElementById('sal-pfe')?.value,
    pfEmployerPct:  document.getElementById('sal-pfer')?.value,
    professionalTax:document.getElementById('sal-ptax')?.value,
    workingDaysPerWeek: parseInt(document.getElementById('sal-wdpw')?.value) || 5,
  });

  const saveSalary = async () => {
    const data = _getSalaryFormData();
    if (!data.monthlyWage) { Utils.toast('Please enter a monthly wage.', 'error'); return; }
    await Store.updateSalary(targetUser.id, data);
    targetUser = await Store.getUserById(targetUser.id);
    Utils.closeModal();
    Utils.toast('Salary structure saved!', 'success');
    _renderTabContent();
  };

  // ── Tags (skills/certs) ──────────────────────────────────────
  const addTag = (field) => {
    const val = prompt(`Add ${field === 'skills' ? 'skill' : 'certification'}:`);
    if (!val?.trim()) return;
    const arr = [...(targetUser[field] || []), val.trim()];
    targetUser = { ...targetUser, [field]: arr };
    _renderTabContent();
  };

  const removeTag = (field, value) => {
    const arr = (targetUser[field] || []).filter(v => v !== value);
    targetUser = { ...targetUser, [field]: arr };
    _renderTabContent();
  };

  const removeDocument = async (index) => {
    const docs = [...(targetUser.documents || [])];
    docs.splice(index, 1);
    await Store.updateUser(targetUser.id, { documents: docs });
    targetUser = await Store.getUserById(targetUser.id);
    _renderTabContent();
    Utils.toast('Document removed.', 'info');
  };

  // ── Save / Cancel ────────────────────────────────────────────
  const cancelEdit = async () => {
    editMode = false;
    profilePicBase64 = null;
    targetUser = await Store.getUserById(targetUser.id);
    Router.go('profile', { id: targetUser.id, mode: 'view' });
  };

  const _saveProfile = async () => {
    const updates = {};

    // Collect all editable field values
    const fields = ['name','phone','email','address','about','department','designation','joinDate','dob','accountNumber','loginId'];
    fields.forEach(key => {
      const el = document.getElementById(`field-${key}`);
      if (el) updates[key] = el.value?.trim();
    });

    // Tags (already on targetUser object from addTag/removeTag)
    updates.skills         = targetUser.skills || [];
    updates.certifications = targetUser.certifications || [];

    // Profile pic
    if (profilePicBase64) {
      updates.profilePic = profilePicBase64;
      profilePicBase64 = null; // Reset after saving
    }

    await Store.updateUser(targetUser.id, updates);
    targetUser = await Store.getUserById(targetUser.id);
    editMode   = false;
    Utils.toast('Profile saved successfully!', 'success');

    // Re-render
    const shellHTML = await App.renderShell('employees', _buildHTML(Auth.getCurrentUserSync()));
    document.getElementById('app').innerHTML = shellHTML;
    _renderTabContent();
    _bindEvents(Auth.getCurrentUserSync());
  };

  // ── Bind Events ──────────────────────────────────────────────
  const _bindEvents = (currentUser) => {
    // Tab switching
    document.querySelectorAll('#profile-tabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#profile-tabs .tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeTab = btn.dataset.tab;
        _renderTabContent();
      });
    });

    // Edit / Save button
    document.getElementById('edit-save-btn')?.addEventListener('click', async () => {
      if (editMode) { await _saveProfile(); }
      else {
        editMode = true;
        const shellHTML = await App.renderShell('employees', _buildHTML(currentUser));
        document.getElementById('app').innerHTML = shellHTML;
        _renderTabContent();
        _bindEvents(currentUser);
      }
    });

    // Profile pic upload
    document.getElementById('profile-pic-input')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        profilePicBase64 = ev.target.result;
        // Update avatar preview
        const avatarEl = document.querySelector('.profile-avatar-wrap .avatar');
        if (avatarEl) {
          avatarEl.style.background = 'transparent';
          avatarEl.innerHTML = `<img src="${profilePicBase64}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />`;
        }
        Utils.toast('Photo updated. Save profile to confirm.', 'info');
      };
      reader.readAsDataURL(file);
    });
  };

  return { render, openSalaryEditor, previewSalary, saveSalary, addTag, removeTag, removeDocument, cancelEdit };
})();
