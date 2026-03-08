/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Employees } from './pages/Employees';
import { Sites } from './pages/Sites';
import { Attendance } from './pages/Attendance';
import { Payroll } from './pages/Payroll';
import { FinanceHub } from './pages/FinanceHub';
import { Onboarding } from './pages/Onboarding';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { Variables } from './pages/Variables';
import { Leaves } from './pages/Leaves';
import { ToastContainer, ConfirmDialog } from './components/ui/toast';

export default function App() {
  return (
    <>
      <ToastContainer />
      <ConfirmDialog />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
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
            <Route path="variables" element={<Variables />} />
            <Route path="leaves" element={<Leaves />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  );
}
