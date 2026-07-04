/* ============================================================
   HRMS Seed Data — Pre-populates demo data on first run
   ============================================================ */

const Seed = (() => {

  const run = () => {
    if (Store.isSeeded()) return;

    // ── 1. Company ──────────────────────────────────────────
    const company = Store.createCompany({
      name: 'Odoo India',
      logo: null,
    });

    // ── 2. Admin User ───────────────────────────────────────
    const admin = Store.createUser({
      loginId:     'admin@hrms.com',
      name:        'Admin User',
      email:       'admin@hrms.com',
      password:    'Admin@123',
      role:        'admin',
      companyId:   company.id,
      department:  'Administration',
      designation: 'HR Manager',
      joinDate:    '2022-01-01',
      serialNo:    0,
      phone:       '+91 98765 00000',
      address:     'Mumbai, Maharashtra',
      dob:         '1985-05-15',
      accountNumber: 'HDFC001122334',
      about:       'Managing HR operations and company administration.',
      skills:      ['HR Management', 'Recruitment', 'Payroll'],
      certifications: ['SHRM-CP', 'PHR'],
      salary: Store.computeSalaryComponents({
        monthlyWage: 120000, basicPct: 50, hraPct: 50, bonusPct: 10,
        ltaPct: 5, pfEmployeePct: 12, pfEmployerPct: 12, professionalTax: 200,
        workingDaysPerWeek: 5,
      }),
    });

    // ── 3. Employees ────────────────────────────────────────
    const empData = [
      { firstName: 'John',    lastName: 'Doe',     email: 'john.doe@hrms.com',    dept: 'Engineering',  desig: 'Software Engineer',   join: '2024-01-15', wage: 75000 },
      { firstName: 'Sarah',   lastName: 'Smith',   email: 'sarah.smith@hrms.com', dept: 'Design',       desig: 'UI/UX Designer',       join: '2024-03-01', wage: 65000 },
      { firstName: 'Rahul',   lastName: 'Verma',   email: 'rahul.verma@hrms.com', dept: 'Engineering',  desig: 'Backend Developer',    join: '2024-02-10', wage: 80000 },
      { firstName: 'Priya',   lastName: 'Sharma',  email: 'priya.sharma@hrms.com',dept: 'Marketing',    desig: 'Marketing Executive',  join: '2024-04-01', wage: 55000 },
      { firstName: 'Amit',    lastName: 'Kumar',   email: 'amit.kumar@hrms.com',  dept: 'Sales',        desig: 'Sales Manager',        join: '2024-01-20', wage: 70000 },
      { firstName: 'Neha',    lastName: 'Gupta',   email: 'neha.gupta@hrms.com',  dept: 'Finance',      desig: 'Finance Analyst',      join: '2024-05-01', wage: 68000 },
      { firstName: 'Vikram',  lastName: 'Singh',   email: 'vikram.singh@hrms.com',dept: 'Engineering',  desig: 'DevOps Engineer',      join: '2024-03-15', wage: 85000 },
    ];

    const employees = empData.map((e, i) => {
      const loginId = Utils.generateLoginId(company.name, e.firstName, e.lastName, new Date(e.join).getFullYear(), i + 1);
      return Store.createUser({
        loginId,
        name:        `${e.firstName} ${e.lastName}`,
        email:       e.email,
        password:    'Pass@123',
        role:        'employee',
        companyId:   company.id,
        department:  e.dept,
        designation: e.desig,
        joinDate:    e.join,
        serialNo:    i + 1,
        phone:       `+91 9${String(8765 + i).padStart(4,'0')} ${String(10001 + i).padStart(5,'0')}`,
        address:     ['Mumbai, MH', 'Delhi, DL', 'Bangalore, KA', 'Pune, MH', 'Chennai, TN', 'Hyderabad, TS', 'Kolkata, WB'][i],
        dob:         `199${2 + (i % 5)}-0${(i % 9) + 1}-${String(10 + i).padStart(2,'0')}`,
        accountNumber: `HDFC${String(100000 + i).padStart(9,'0')}`,
        about:       `Experienced ${e.desig} with a passion for delivering high-quality results.`,
        skills:      [['JavaScript','React','Node.js'], ['Figma','Photoshop','Sketch'], ['Python','Django','PostgreSQL'], ['SEO','Content','Analytics'], ['CRM','Negotiation','Leadership'], ['Excel','Power BI','Accounting'], ['Docker','Kubernetes','AWS']][i],
        certifications: [['AWS CCP'], ['Adobe CC'], ['MongoDB Associate'], ['Google Analytics'], ['HubSpot Sales'], ['CFA Level 1'], ['CKA']][i],
        salary: Store.computeSalaryComponents({
          monthlyWage: e.wage, basicPct: 50, hraPct: 50, bonusPct: 10,
          ltaPct: 5, pfEmployeePct: 12, pfEmployerPct: 12, professionalTax: 200,
          workingDaysPerWeek: 5,
        }),
      });
    });

    // ── 4. Attendance (last 60 days) ─────────────────────────
    const today = new Date();
    const allUsers = [admin, ...employees];

    allUsers.forEach(user => {
      for (let daysAgo = 59; daysAgo >= 0; daysAgo--) {
        const d = new Date(today);
        d.setDate(d.getDate() - daysAgo);
        if (d.getDay() === 0 || d.getDay() === 6) continue; // Skip weekends
        const dateStr = d.toISOString().split('T')[0];

        // Skip today (will be done live)
        if (dateStr === today.toISOString().split('T')[0]) continue;

        // 80% present, 10% absent, 5% half-day, 5% leave
        const r = Math.random();
        let status, checkIn, checkOut, workHours, extraHours;
        if (r < 0.78) {
          status = 'present';
          const startH = 9 + Math.floor(Math.random() * 1.5);
          const startM = Math.floor(Math.random() * 30);
          checkIn  = `${String(startH).padStart(2,'0')}:${String(startM).padStart(2,'0')}`;
          const endH = 17 + Math.floor(Math.random() * 2);
          const endM = Math.floor(Math.random() * 60);
          checkOut = `${String(endH).padStart(2,'0')}:${String(endM).padStart(2,'0')}`;
          const worked = (endH * 60 + endM - (startH * 60 + startM)) / 60;
          workHours  = worked.toFixed(2);
          extraHours = Math.max(0, worked - 8).toFixed(2);
        } else if (r < 0.88) {
          status = 'absent'; checkIn = null; checkOut = null; workHours = null; extraHours = null;
        } else if (r < 0.93) {
          status = 'half-day';
          checkIn  = '09:30'; checkOut = '13:30';
          workHours = '4.00'; extraHours = '0.00';
        } else {
          status = 'leave'; checkIn = null; checkOut = null; workHours = null; extraHours = null;
        }

        Store.createAttendance({ userId: user.id, date: dateStr, checkIn, checkOut, workHours, extraHours, status });
      }
    });

    // ── 5. Leaves ────────────────────────────────────────────
    const leaveTypes = ['paid', 'sick', 'unpaid'];
    const leaveSamples = [
      { userId: employees[0].id, type: 'paid',   startDate: '2024-12-23', endDate: '2024-12-26', remarks: 'Family vacation',         status: 'approved' },
      { userId: employees[1].id, type: 'sick',   startDate: '2024-12-10', endDate: '2024-12-11', remarks: 'Fever and cold',           status: 'approved', adminComment: 'Get well soon!' },
      { userId: employees[2].id, type: 'paid',   startDate: '2025-01-02', endDate: '2025-01-03', remarks: 'New year extension',       status: 'rejected', adminComment: 'Insufficient team coverage' },
      { userId: employees[3].id, type: 'unpaid', startDate: '2025-01-15', endDate: '2025-01-15', remarks: 'Personal emergency',       status: 'approved' },
      { userId: employees[4].id, type: 'sick',   startDate: '2025-01-20', endDate: '2025-01-21', remarks: 'Medical appointment',      status: 'pending' },
      { userId: employees[5].id, type: 'paid',   startDate: '2025-02-14', endDate: '2025-02-17', remarks: "Valentine's trip",         status: 'pending' },
      { userId: employees[6].id, type: 'paid',   startDate: '2025-03-01', endDate: '2025-03-05', remarks: 'Annual leave',             status: 'pending' },
      { userId: employees[0].id, type: 'sick',   startDate: '2025-01-08', endDate: '2025-01-08', remarks: 'Doctor visit',             status: 'approved' },
    ];

    leaveSamples.forEach(l => Store.createLeave({
      ...l,
      allocation: Utils.dateDiff(l.startDate, l.endDate),
    }));

    // ── 6. Public Holidays ───────────────────────────────────
    Store.saveHolidays([
      { date: '2025-01-26', name: 'Republic Day' },
      { date: '2025-03-31', name: 'Eid ul-Fitr' },
      { date: '2025-04-14', name: 'Ambedkar Jayanti' },
      { date: '2025-04-18', name: 'Good Friday' },
      { date: '2025-05-01', name: 'Labour Day' },
      { date: '2025-08-15', name: 'Independence Day' },
      { date: '2025-10-02', name: 'Gandhi Jayanti' },
      { date: '2025-10-24', name: 'Dussehra' },
      { date: '2025-11-01', name: 'Diwali' },
      { date: '2025-12-25', name: 'Christmas' },
    ]);

    Store.markSeeded();
    console.log('✅ HRMS demo data seeded successfully!');
    console.log('Admin login: admin@hrms.com / Admin@123');
    console.log('Employee login:', employees[0].loginId, '/ Pass@123');
  };

  return { run };
})();
