# 🧑‍💼 HRMS — Human Resource Management System

> **Every workday, perfectly aligned.**

A modern, role-based Human Resource Management System built for the **Odoo x Adamas University Hackathon '26**. HRMS digitizes and streamlines core HR operations — from onboarding and attendance to leave approvals and payroll visibility — through a clean, fast, and intuitive interface.

🔗 **Live Demo:** [ankush-shaw.github.io/Oddo-Hackathon-temporary-](https://ankush-shaw.github.io/Oddo-Hackathon-temporary-/)

---

## 📸 Preview

The Employee Directory view — real-time presence status, quick search, and one-click employee management.

*(Admins get a full team roster with live "Present / On Leave / Absent" indicators, department tags, and instant search — all from a single dashboard.)*

---

## ✨ Features

### 🔐 Authentication & Authorization
- Secure Sign Up with Employee ID, Email, and Password
- Role-based access control — **Admin/HR** vs **Employee**
- Email verification and password security rules
- Protected routes with session-based redirects to the dashboard

### 🏠 Role-Based Dashboards
| Role | Dashboard View |
|------|----------------|
| **Employee** | Quick-access cards for Profile, Attendance, Leave Requests, and recent activity/alerts |
| **Admin / HR** | Full employee directory, attendance records, and pending leave approvals in one place |

### 👥 Employee Profile Management
- View personal details, job info, salary structure, and documents
- Employees can edit limited fields (address, phone, profile picture)
- Admins have full edit access across all employee records

### 🕒 Attendance Management
- Daily and weekly attendance views
- Check-in / check-out tracking
- Status tracking: **Present · Absent · Half-day · Leave**
- Employees see their own record; Admins see the entire team

### 🌴 Leave & Time-Off Management
- Apply for Paid, Sick, or Unpaid leave
- Calendar-based date range selection with monthly Present/Absent markers
- Request status tracking: **Pending → Approved / Rejected**
- Admin approval workflow with comments, reflected instantly in employee records

### 💰 Payroll / Salary Management
- Read-only payroll view for employees
- Admin controls to view and update salary structures across the organization

---

## 🧩 System Design

- **User classes:** Admin/HR Officer (manage, approve, view payroll) and Employee (self-service profile, attendance, leave, salary view)
- **Architecture & flow diagrams:** [View on Excalidraw](https://link.excalidraw.com/l/65VNwvy7c4X/58RLEJ4oOwh)

---

## 🛠️ Tech Stack

> Update this section with your exact stack if it differs.

- **Frontend:** React + TypeScript
- **Routing:** React Router (hash-based, for static hosting)
- **Styling:** Tailwind CSS
- **Deployment:** GitHub Pages

---

## 🚀 Getting Started

```bash
# Clone the repository
git clone https://github.com/<org-or-user>/odoo-adamas-hackathon-2026-.git
cd odoo-adamas-hackathon-2026-

# Install dependencies
npm install

# Run the development server
npm run dev

# Build for production
npm run build
```

---

## 👨‍👩‍👧 Team

Built with ❤️ by a team of three for **Odoo x Adamas University Hackathon '26**.

---

## 📄 Project Documentation

Full functional and non-functional requirements — including authentication flows, dashboard specs, attendance logic, leave workflows, and payroll rules — are documented in the project's **Software Requirements Specification (SRS)**.

---

## 📃 License

This project was built for hackathon evaluation purposes as part of Odoo x Adamas University Hackathon '26.
