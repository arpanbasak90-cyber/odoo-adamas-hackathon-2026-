# NextGen HRMS (Human Resource Management System)

A modern, responsive, and lightweight Human Resource Management System (HRMS) designed to streamline employee tracking, attendance, leave management, and payroll. 

Built as a Single Page Application (SPA) using Vanilla JavaScript, HTML5, and CSS3. Data is persisted locally using the browser's `localStorage`, making it incredibly fast and easy to deploy as a frontend-only application for hackathons or demonstrations.

## 🔗 Live Demo

**[https://odoo-adamas-hackathon-2026.vercel.app/](https://odoo-adamas-hackathon-2026.vercel.app/)**

Repo: [https://github.com/arpanbasak90-cyber/odoo-adamas-hackathon-2026-](https://github.com/arpanbasak90-cyber/odoo-adamas-hackathon-2026-)

## 📸 Screenshots

**Login Page**


**Employee Dashboard**


**Add New Employee**


**Add New Employee — Auto-Generated Credentials**


## ✨ Key Features

### 🔐 Authentication & Roles
* **Role-Based Access Control (RBAC):** Distinct dashboards and capabilities for `Admin` and `Employee` roles.
* **Smart Credential Generation:** Admins can add new employees, and the system automatically generates standardized Login IDs and secure initial passwords.

### 👥 Employee Management
* **Employee Directory:** Visual grid of all employees with their current status (Present, Absent, On Leave).
* **Profile Management:** Employees can manage their personal info, upload a profile picture (saved as Base64), manage documents, and tag their skills/certifications.

### ⏱️ Attendance Tracking
* **One-Click Check-in/Check-out:** Seamless time tracking for employees from their dashboard.
* **Automated Hours Calculation:** Calculates total work hours and extra/overtime hours automatically.
* **Month View:** Employees can see their detailed attendance history for any month.
* **Admin Day View:** Admins have an exclusive "Day View" to quickly see who is present, absent, or on leave on any given day.

### 🏖️ Leave Management
* **Leave Balances:** Track Paid, Sick, and Unpaid leave balances.
* **Interactive Calendars:** Beautiful Year and Month calendar views showing approved leaves and holidays.
* **Approval Workflow:** Employees can submit time-off requests, which Admins can approve or reject with comments.

### 💰 Payroll & Salary Breakdown
* **Dynamic Salary Calculator:** Automatically computes Basic Pay, HRA, Bonus, LTA, PF, and Taxes based on a customizable percentage structure.
* **Net Pay Calculation:** Instantly updates Gross Pay and Net Salary whenever the base monthly wage or configuration changes.

### 🎨 UI/UX & Design System
* **Premium Aesthetics:** Designed with a modern "light and premium" philosophy using smooth gradients, glassmorphism hints, and micro-animations.
* **Fully Responsive:** Completely mobile and tablet friendly. Tables are horizontally scrollable, and layouts stack perfectly on small screens.
* **Modular CSS:** Built with a scalable CSS variable token system (`tokens.css`, `global.css`, `components.css`, `pages.css`).

---

## 🚀 Getting Started

Since this project relies purely on frontend technologies and `localStorage`, you don't need any complex backend setup to run it!

### Prerequisites
* A modern web browser (Chrome, Firefox, Edge, Safari).
* (Optional) A local web server like VS Code's "Live Server" extension for the best experience.

### Installation & Usage
1. **Clone the repository:**
   ```bash
   git clone https://github.com/arpanbasak90-cyber/odoo-adamas-hackathon-2026-.git
   ```
2. **Open the App:**
   Simply open `index.html` in your web browser. 
   *(Alternatively, right-click `index.html` in VS Code and select "Open with Live Server").*
3. **Demo Data (Auto-Seeding):**
   The very first time you load the app, `js/seed.js` will automatically populate the database with a demo Admin account, 7 sample employees, and historical attendance/leave data so you can test it immediately.
4. **Login:**
   * **Admin Login:** `admin@demo.com` / `password123`
   * **Employee Login:** Use any generated login ID from the Admin panel.

### Resetting the Database
If you want to clear all your changes and reset the application to its initial factory state:
1. Open Developer Tools in your browser (`F12`).
2. Go to the **Application** tab (or **Storage** tab).
3. Expand **Local Storage** and select the app URL.
4. Delete all keys (or click "Clear All").
5. Refresh the page! The `seed.js` script will instantly rebuild the demo data.

---

## 🛠️ Technology Stack
* **Core:** HTML5, CSS3, Vanilla JavaScript (ES6+).
* **Architecture:** Component-based SPA Shell (`App.js` router dynamically rendering modules in `js/pages/`).
* **Storage:** Window `localStorage` (abstracted via `store.js` for easy migration to a real backend API in the future).
* **Typography:** [Inter Font](https://fonts.google.com/specimen/Inter) by Google Fonts.

---

## 📁 Project Structure

```text
├── css/
│   ├── tokens.css      # CSS Variables (Colors, Spacing, Typography)
│   ├── global.css      # Reset, Base styles, Animations
│   ├── components.css  # Reusable UI (Buttons, Cards, Modals, Forms)
│   └── pages.css       # Page-specific layout structures
├── js/
│   ├── pages/          # Individual Page Modules (Employees, Attendance, Leave, etc.)
│   ├── app.js          # App Shell, Routing, and Auth State
│   ├── store.js        # LocalStorage CRUD wrappers
│   ├── utils.js        # Helper functions (Date formatting, status badges)
│   └── seed.js         # Initial mock data generator
└── index.html          # Main HTML entry point
```

---

## 🤝 Contributing
Contributions, issues, and feature requests are welcome! 
If you want to transition this project to a full-stack application, the data layer in `js/store.js` is fully decoupled from the UI, meaning you can easily swap out `localStorage` calls with `fetch()` or `axios` REST API calls.
