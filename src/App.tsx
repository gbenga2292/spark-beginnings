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
import { Billing } from './pages/Billing';
import { Payments } from './pages/Payments';
import { VatPayments } from './pages/VatPayments';
import { Onboarding } from './pages/Onboarding';
import { Reports } from './pages/Reports';
import { FinancialReports } from './pages/FinancialReports';
import { Settings } from './pages/Settings';
import { Profile } from './pages/Profile';
import { Leaves } from './pages/Leaves';
import { LeaveSummary } from './pages/LeaveSummary';
import { Users } from './pages/Users';
import { UserForm } from './pages/UserForm';
import { SalaryLoans } from './pages/SalaryLoans';
import { ClientSummary } from './pages/ClientSummary';
import { TitleBar } from './components/layout/TitleBar';
import { ToastContainer, ConfirmDialog } from './components/ui/toast';
import { GlobalDragScroll } from './components/ui/GlobalDragScroll';

export default function App() {
  return (
    <div className="flex flex-col h-[100dvh]">
      <TitleBar />
      <div className="flex-1 min-h-0 bg-slate-50 relative">
        <GlobalDragScroll />
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
            <Route path="invoices" element={<Billing />} />
            <Route path="payments" element={<Payments />} />
            <Route path="vat" element={<VatPayments />} />
            <Route path="onboarding" element={<Onboarding />} />
            <Route path="reports" element={<Reports />} />
            <Route path="financial-reports" element={<FinancialReports />} />
            <Route path="settings" element={<Settings />} />
            <Route path="profile" element={<Profile />} />
            <Route path="variables" element={<Navigate to="/settings" replace />} />
            <Route path="leaves" element={<Leaves />} />
            <Route path="leave-summary" element={<LeaveSummary />} />
            <Route path="users" element={<Users />} />
            <Route path="users/new" element={<UserForm />} />
            <Route path="users/:id/edit" element={<UserForm />} />
            <Route path="salary-loans" element={<SalaryLoans />} />
            <Route path="client-summary" element={<ClientSummary />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
      </div>
    </div>
  );
}
