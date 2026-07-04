# 🗄️ NextGen HRMS — Database Documentation

## Overview

This folder contains the complete database layer for the HRMS project,
built on **Supabase (PostgreSQL 15+)**. No separate backend server is needed.

---

## 📁 File Structure

```
database/
├── schema.sql          ← Run FIRST  — All tables, triggers, RLS, indexes, seed data
├── functions.sql       ← Run SECOND — All stored procedures (15 functions)
├── store_supabase.js   ← Drop-in replacement for js/store.js
└── README.md           ← This file
```

---

## 🚀 How to Set Up (5 Steps)

### Step 1 — Create Supabase Project
1. Go to [supabase.com](https://supabase.com) → Sign up free
2. Click **New Project** → Enter name `hrms` → Set a strong DB password → Create
3. Wait ~2 minutes for provisioning

### Step 2 — Run `schema.sql`
1. In Supabase sidebar → **SQL Editor** → **New Query**
2. Open `database/schema.sql`, copy ALL content
3. Paste into SQL Editor → Click **Run**
4. You should see: ✅ Success

### Step 3 — Run `functions.sql`
1. In SQL Editor → **New Query**
2. Open `database/functions.sql`, copy ALL content
3. Paste → Click **Run**
4. You should see: ✅ Success

### Step 4 — Get Your API Keys
1. In Supabase sidebar → **Settings** → **API**
2. Copy:
   - **Project URL** → looks like `https://abcxyz.supabase.co`
   - **anon public key** → long JWT string starting with `eyJ...`

### Step 5 — Connect Frontend
Add this to `index.html` **before all your script tags**:

```html
<!-- Supabase SDK -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script>
  window._supabase = supabase.createClient(
    'https://YOUR-PROJECT-REF.supabase.co',   // ← paste Project URL
    'YOUR-ANON-PUBLIC-KEY'                     // ← paste anon key
  );
</script>
```

Then replace `js/store.js` with `database/store_supabase.js`.

---

## 📦 Database Tables (10 total)

| Table | Purpose | Rows in Seed |
|---|---|---|
| `company` | Organisation info | 1 |
| `employees` | All users (admin + employees) | 8 (1 admin + 7 emp) |
| `salary` | Full salary breakdown | 8 |
| `attendance` | Daily check-in/out records | 0 (created live) |
| `leave_requests` | Leave applications + approvals | 8 |
| `leave_balances` | Paid/Sick/Unpaid counters | 8 (auto-created) |
| `employee_skills` | Skills tags per employee | 24 |
| `certifications` | Certifications per employee | 8 |
| `documents` | Uploaded documents | 0 (uploaded live) |
| `holidays` | Public holidays | 10 |

---

## ⚡ Triggers (Auto-runs, no code needed)

| Trigger | When | What it does |
|---|---|---|
| `trg_*_updated_at` | Any row update | Sets `updated_at = now()` |
| `trg_salary_compute` | Salary insert/update | Auto-computes Basic, HRA, Bonus, LTA, PF, Net Pay |
| `trg_employee_leave_balance` | New employee | Auto-creates leave balance (24 paid, 7 sick) |
| `trg_leave_mark_attendance` | Leave approved | Auto-marks attendance as 'leave' for all days |

---

## 🔒 Row Level Security

| Table | Admin | Employee |
|---|---|---|
| `employees` | Full CRUD | Read/Update own row only |
| `salary` | Full CRUD | Read own salary only |
| `attendance` | Full CRUD | Read/Insert/Update own records |
| `leave_requests` | Full CRUD | Read/Create own requests |
| `leave_balances` | Full CRUD | Read own balance |
| `company`, `holidays` | Full CRUD | Read only |

---

## 🔧 Stored Functions (15 total)

| Function | Purpose | JS Equivalent |
|---|---|---|
| `fn_generate_login_id()` | Generate `OI-EMP-2024-001` format | `Utils.generateLoginId()` |
| `fn_next_serial()` | Get next employee serial no. | `Utils.nextSerial()` |
| `fn_add_employee()` | Create employee + salary in one call | `Store.createUser()` |
| `fn_verify_password()` | Authenticate login credentials | `Auth.login()` |
| `fn_change_password()` | Securely change password | — |
| `fn_check_in()` | Record check-in for today | `Store.checkIn()` |
| `fn_check_out()` | Record check-out, calc hours | `Store.checkOut()` |
| `fn_get_month_stats()` | Monthly attendance summary | `Store.getMonthStats()` |
| `fn_approve_leave()` | Approve leave + mark attendance | `Store.approveLeave()` |
| `fn_reject_leave()` | Reject leave with comment | `Store.rejectLeave()` |
| `fn_create_leave()` | Submit new leave request | `Store.createLeave()` |
| `fn_update_salary()` | Upsert salary structure | `Store.updateSalary()` |
| `fn_get_today_summary()` | Dashboard totals | — |
| `fn_employee_card_status()` | present/absent/on-leave | `Utils.employeeCardStatus()` |
| `fn_update_leave_balance()` | Deduct leave days | `Store.updateLeaveBalance()` |

---

## 👁️ Views (Ready-made queries)

| View | Use it for |
|---|---|
| `v_employee_full` | Employee list with salary + leave balance |
| `v_today_attendance` | Who is present/absent today |
| `v_pending_leaves` | All pending leave requests for admin |

---

## 🔑 Demo Credentials

| Role | Login ID / Email | Password |
|---|---|---|
| Admin | `admin@hrms.com` | `Admin@123` |
| Employee 1 | `john.doe@hrms.com` | `Pass@123` |
| Employee 2 | `sarah.smith@hrms.com` | `Pass@123` |
| Employee 3 | `rahul.verma@hrms.com` | `Pass@123` |
| Employee 4 | `priya.sharma@hrms.com` | `Pass@123` |
| Employee 5 | `amit.kumar@hrms.com` | `Pass@123` |
| Employee 6 | `neha.gupta@hrms.com` | `Pass@123` |
| Employee 7 | `vikram.singh@hrms.com` | `Pass@123` |

---

## 🔄 How to Reset Database

1. Open Supabase → SQL Editor
2. Run the following:
```sql
-- Nuclear reset: drops and recreates everything
\i schema.sql
\i functions.sql
```
Or simply re-run both SQL files in the SQL Editor.

---

## 📋 Migration Checklist (localStorage → Supabase)

- [x] `schema.sql` — All tables created
- [x] `functions.sql` — All stored procedures created
- [x] `store_supabase.js` — Drop-in store.js replacement
- [ ] Replace `js/store.js` with `store_supabase.js`
- [ ] Add Supabase SDK + config to `index.html`
- [ ] Make all page functions `async/await`
- [ ] Update `js/auth.js` to use Supabase Auth (optional)
- [ ] Test: Login, Check-in/out, Leave requests, Profile edit
