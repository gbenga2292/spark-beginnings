/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { Login } from './pages/Login';
import { SuperAdminSetup } from './pages/SuperAdminSetup';
import { Dashboard } from './pages/Dashboard';
import { Employees } from './pages/Employees';
import { Sites } from './pages/Sites';
import { Attendance } from './pages/Attendance';
import { Payroll } from './pages/Payroll';
import { FinanceHub } from './pages/FinanceHub';
import { Onboarding } from './pages/Onboarding';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { Profile } from './pages/Profile';
import { Variables } from './pages/Variables';
import { Leaves } from './pages/Leaves';
import { Users } from './pages/Users';
import { ToastContainer, ConfirmDialog } from './components/ui/toast';

export default function App() {
  return (
    <>
      <ToastContainer />
      <ConfirmDialog />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/setup" element={<SuperAdminSetup />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="employees" element={<Employees />} />
            <Route path="sites" element={<Sites />} />
            <Route path="payroll" element={<Payroll />} />
            <Route path="finance" element={<FinanceHub />} />
            <Route path="onboarding" element={<Onboarding />} />
            <Route path="reports" element={<Reports />} />
<Route path="settings" element={<Settings />} />
            <Route path="profile" element={<Profile />} />
            <Route path="variables" element={<Variables />} />
            <Route path="leaves" element={<Leaves />} />
            <Route path="users" element={<Users />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  );
}
