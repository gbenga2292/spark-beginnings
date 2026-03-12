const fs = require('fs');
const checks = [
  { f: 'src/components/layout/Header.tsx', k: 'privileges?.users?.canView', msg: 'Header crash fix' },
  { f: 'src/pages/Billing.tsx',      k: 'priv.canCreate', msg: 'Billing - Add Invoice gated' },
  { f: 'src/pages/Billing.tsx',      k: 'priv.canEdit',   msg: 'Billing - Edit gated' },
  { f: 'src/pages/Billing.tsx',      k: 'priv.canDelete', msg: 'Billing - Delete gated' },
  { f: 'src/pages/Leaves.tsx',       k: 'priv.canAdd',    msg: 'Leaves - File Leave Entry gated' },
  { f: 'src/pages/Leaves.tsx',       k: 'priv.canEdit',   msg: 'Leaves - Edit gated' },
  { f: 'src/pages/Leaves.tsx',       k: 'priv.canDelete', msg: 'Leaves - Delete gated' },
  { f: 'src/pages/VatPayments.tsx',  k: 'priv.canManageVat', msg: 'VatPayments - all actions gated' },
  { f: 'src/pages/Variables.tsx',    k: 'priv.canEdit',   msg: 'Variables - mutations gated' },
  { f: 'src/pages/Sites.tsx',        k: 'canAddSite',     msg: 'Sites - Add Site gated' },
  { f: 'src/pages/Sites.tsx',        k: 'canAddClient',   msg: 'Sites - Add Client gated' },
  { f: 'src/pages/Sites.tsx',        k: 'canEditSite',    msg: 'Sites - Edit gated' },
  { f: 'src/pages/Sites.tsx',        k: 'canDeleteSite',  msg: 'Sites - Delete gated' },
  { f: 'src/pages/Payroll.tsx',      k: 'priv.canGenerate',        msg: 'Payroll - Generate gated' },
  { f: 'src/pages/Payroll.tsx',      k: 'priv.canViewPayeSchedule',msg: 'Payroll - PAYE tab gated' },
  { f: 'src/pages/Attendance.tsx',   k: 'priv.canAdd',    msg: 'Attendance - Submit gated' },
  { f: 'src/pages/Attendance.tsx',   k: 'priv.canDelete', msg: 'Attendance - Clear gated' },
  { f: 'src/pages/Onboarding.tsx',   k: 'priv.canAdd',    msg: 'Onboarding - Generate Contract gated' },
  { f: 'src/pages/Employees.tsx',    k: 'priv.canAdd',    msg: 'Employees - Add gated' },
  { f: 'src/pages/Employees.tsx',    k: 'priv.canEdit',   msg: 'Employees - Edit gated' },
  { f: 'src/pages/Employees.tsx',    k: 'priv.canDelete', msg: 'Employees - Delete gated' },
  { f: 'src/pages/Payments.tsx',     k: 'priv.canAdd',    msg: 'Payments - Add gated' },
  { f: 'src/pages/Payments.tsx',     k: 'priv.canEdit',   msg: 'Payments - Edit gated' },
  { f: 'src/pages/Payments.tsx',     k: 'priv.canDelete', msg: 'Payments - Delete gated' },
];

checks.forEach(c => {
  const ok = fs.readFileSync(c.f, 'utf8').includes(c.k);
  console.log((ok ? '✅' : '❌') + ' ' + c.msg);
});
