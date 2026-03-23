import fs from 'fs';

// 1. appStore.ts
let appStore = fs.readFileSync('src/store/appStore.ts', 'utf8');
appStore = appStore.replace(
  /staffType: 'INTERNAL' | 'EXTERNAL'/g,
  "staffType: 'INTERNAL' | 'EXTERNAL' | 'BENEFICIARY'"
);
fs.writeFileSync('src/store/appStore.ts', appStore);

// 2. Employees.tsx
let emp = fs.readFileSync('src/pages/Employees.tsx', 'utf8');
emp = emp.replace(
  /return matchesSearch && matchesTab;/,
  "return matchesSearch && matchesTab && emp.staffType !== 'BENEFICIARY';"
);
fs.writeFileSync('src/pages/Employees.tsx', emp);

// 3. Beneficiaries.tsx
let ben = fs.readFileSync('src/pages/Beneficiaries.tsx', 'utf8');
ben = ben.replace(/export function Employees/g, 'export function Beneficiaries');
ben = ben.replace(
  /return matchesSearch && matchesTab;/,
  "return matchesSearch && matchesTab && emp.staffType === 'BENEFICIARY';"
);
ben = ben.replace(/Add New Employee/g, 'Add New Beneficiary / Sponsored');
ben = ben.replace(/Edit Employee Record/g, 'Edit Beneficiary Record');
ben = ben.replace(/staffType: 'INTERNAL'/g, "staffType: 'BENEFICIARY'");
ben = ben.replace(/Create Employee/g, 'Create Beneficiary');
ben = ben.replace(/Employee Code/g, 'Beneficiary Code');
ben = ben.replace(/Employees/g, 'Beneficiaries');
ben = ben.replace(/employees_export/g, 'beneficiaries_export');
ben = ben.replace(/employeeCode/g, 'employeeCode');
fs.writeFileSync('src/pages/Beneficiaries.tsx', ben);

// 4. App.tsx
let app = fs.readFileSync('src/App.tsx', 'utf8');
if(!app.includes('Beneficiaries')) {
  app = app.replace(
    /import \{ Employees \} from '@\/src\/pages\/Employees';/,
    "import { Employees } from '@/src/pages/Employees';\nimport { Beneficiaries } from '@/src/pages/Beneficiaries';"
  );
  app = app.replace(
    /<Route path="employees" element=\{<Employees \/>\} \/>/,
    "<Route path=\"employees\" element={<Employees />} />\n              <Route path=\"beneficiaries\" element={<Beneficiaries />} />"
  );
  fs.writeFileSync('src/App.tsx', app);
}

// 5. Sidebar.tsx
let side = fs.readFileSync('src/components/layout/Sidebar.tsx', 'utf8');
if(!side.includes('Beneficiaries')) {
  side = side.replace(
    /\{ name: 'Employees', href: '\/app\/employees', icon: Users, permission: 'employees' \},/,
    "{ name: 'Employees', href: '/app/employees', icon: Users, permission: 'employees' },\n  { name: 'Beneficiaries & Stipends', href: '/app/beneficiaries', icon: Users, permission: 'employees' },"
  );
  fs.writeFileSync('src/components/layout/Sidebar.tsx', side);
}

console.log('Done mapping Beneficiaries module!');
