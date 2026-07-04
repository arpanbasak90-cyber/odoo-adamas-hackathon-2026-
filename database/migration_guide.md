# 🔄 Frontend Migration Guide (localStorage → Supabase)

To fully transition the frontend to use the Supabase database, you must make all Store calls and rendering flows asynchronous. Below are the exact modifications required for each file.

---

## 1. `index.html`
Add the Supabase SDK client library and config before your scripts load.

```html
<!-- Insert before js/store.js in index.html -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script>
  window._supabase = supabase.createClient(
    'https://YOUR-PROJECT.supabase.co',   // Replace with your Project URL
    'YOUR-ANON-PUBLIC-KEY'                 // Replace with your anon public key
  );
</script>

<!-- Replace store.js and auth.js with supabase versions -->
<script src="database/store_supabase.js"></script>
<script src="database/auth_supabase.js"></script>
<script src="js/utils.js"></script>
<script src="js/seed.js"></script>
```

---

## 2. `js/app.js`
Update `renderNavbar` and the router to support async company details and pending leave counts.

```javascript
// Modify renderNavbar to be async
const renderNavbar = async (activePage) => {
  const user = Auth.getCurrentUserSync();
  const company = await Store.getCompany(); // Async call
  const isAdmin = Auth.isAdmin();

  const todayAtt = user ? await Store.getTodayAttendance(user.id) : null; // Async call
  const checkedIn = todayAtt && todayAtt.checkIn && !todayAtt.checkOut;
  const pendingCount = isAdmin ? (await Store.getPendingLeaves()).length : 0; // Async call

  const companyName = company?.name || 'HRMS';
  const companyInitial = companyName[0]?.toUpperCase() || 'H';

  return `
    <nav class="navbar" id="main-navbar">
      <!-- (Keep identical HTML template as original) -->
    </nav>
  `;
};

// Modify renderShell to be async
const renderShell = async (activePage, content) => {
  const navbarHTML = await renderNavbar(activePage);
  return `
    <div class="page-wrapper">
      ${navbarHTML}
      <div class="page-content animate-fade-in">
        ${content}
      </div>
    </div>`;
};

// Modify Router.init to support async routes
const init = () => {
  const navigate = async () => {
    const { page, params: qp } = parseHash();
    params = qp;
    const handler = routes[page] || routes[''];
    const app = document.getElementById('app');
    if (app) app.innerHTML = '';
    await handler(); // Await page render
  };
  window.addEventListener('hashchange', navigate);
  navigate();
};
```

---

## 3. `js/pages/login.js`
Mark `render` and `_submit` as async, and call `await Auth.login(...)`.

```javascript
Pages.Login = (() => {
  const render = async () => {
    if (!Auth.requireGuest()) return;
    document.title = 'Sign In — HRMS';
    const company = await Store.getCompany(); // Async call
    const companyName = company?.name || 'HRMS';
    // ...
  };

  const _submit = async () => {
    // ...
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Signing in...';

    // Call async login function
    const result = await Auth.login(loginId, password, remember);
    if (result.ok) {
      Utils.toast('Welcome back, ' + result.user.name.split(' ')[0] + '!', 'success');
      setTimeout(() => Router.go('employees'), 300);
    } else {
      // Handle error...
    }
  };
  // ...
```

---

## 4. `js/pages/signup.js`
Mark `_submit` as async to create the company and admin user on Supabase.

```javascript
  const _submit = async () => {
    _clearErrors();
    // ... validation ...
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Creating your workspace...';

    try {
      // Create company on Supabase
      const company = await Store.createCompany({ name: companyName, logo: logoBase64 });
      
      // Create admin user on Supabase
      await Store.createUser({
        loginId: email, name, email, password: pw, role: 'admin',
        companyId: company.id, designation: 'HR Manager', department: 'Administration',
        joinDate: Utils.today(), serialNo: 0,
      });

      // Login
      await Auth.login(email, pw, false);
      Utils.toast('Company created! Welcome to HRMS 🎉', 'success');
      setTimeout(() => Router.go('employees'), 500);
    } catch (e) {
      _showError('form-error', e.message);
      btn.disabled = false;
    }
  };
```

---

## 5. `js/pages/employees.js`
Make rendering and interactive check-in/out calls async.

```javascript
Pages.Employees = (() => {
  const render = async () => {
    const user = Auth.requireAuth();
    if (!user) return;
    document.title = 'Employees — HRMS';

    const shellHTML = await App.renderShell('employees', await _buildHTML(user));
    document.getElementById('app').innerHTML = shellHTML;
    _bindEvents(user);
    _startClock();
    await _updateCheckinWidget(user);
  };

  const _buildHTML = async (user) => {
    const isAdmin = Auth.isAdmin();
    const allUsers = await Store.getUsers(); // Async call
    const employees = allUsers.filter(u => u.role !== 'admin' || isAdmin);
    // ...
  };

  const _updateCheckinWidget = async (user) => {
    const att = await Store.getTodayAttendance(user.id); // Async call
    // ...
  };

  const doCheckIn = async () => {
    const user = Auth.getCurrentUserSync();
    await Store.checkIn(user.id);
    Utils.toast('Check-in recorded! Have a productive day 🚀', 'success');
    await _updateCheckinWidget(user);
  };

  const doCheckOut = async () => {
    const user = Auth.getCurrentUserSync();
    const att = await Store.checkOut(user.id);
    if (att) {
      Utils.toast(`Checked out! Worked ${att.workHours}h today 👏`, 'success');
      await _updateCheckinWidget(user);
    }
  };
  // ...
```

---

## 6. `js/pages/profile.js`
Make tabs, tags, and salary calculations async.

```javascript
Pages.Profile = (() => {
  const render = async () => {
    const currentUser = Auth.requireAuth();
    if (!currentUser) return;

    const params = Router.getParams();
    const uid = params.id || currentUser.id;
    const mode = params.mode || 'view';

    targetUser = await Store.getUserById(uid); // Async call
    // ...
    const shellHTML = await App.renderShell('employees', _buildHTML(currentUser));
    document.getElementById('app').innerHTML = shellHTML;
    _renderTabContent();
    _bindEvents(currentUser);
  };

  const _saveProfile = async () => {
    // ... collect fields ...
    await Store.updateUser(targetUser.id, updates);
    targetUser = await Store.getUserById(targetUser.id);
    // ... re-render ...
  };
  // ...
```
