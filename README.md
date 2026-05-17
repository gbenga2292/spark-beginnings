<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# DCEL Office Suite

DCEL Office Suite is a comprehensive HR and Finance management system designed for construction companies. It integrates daily attendance tracking, automated payroll computation, healthcare (HMO) management, and financial reporting into a unified desktop and mobile application.

## 🚀 Recent Updates (v1.5.3)

### 📊 Advanced Machine Analytics
- **Bulk Logging**: Implemented date range support for machine logs, allowing multi-day bulk submissions.
- **Dynamic Diesel Analytics**: Refactored diesel usage charts with 12-month average views and granular daily selection.
- **Reporting Consistency**: Standardized chart rendering across Site Machine Analytics and individual Machine Log interfaces.

### 📋 Task Workflow & Approvals
- **Strict Status Control**: Enforced "Pending Approval" status for sensitive tasks, restricting manual "Not Started" or "In Progress" selections for these items.
- **Real-time Synchronization**: Optimized Supabase real-time subscriptions and resolved camelCase/snake_case mapping issues in approval logic.
- **UI Layout Optimization**: Standardized task row rendering in the dashboard to prevent badge wrapping.

### 💰 Financial Reporting & VAT
- **Performance Optimization**: Achieved sub-20ms load times for Account Reports via lazy evaluation of payroll calculations.
- **VAT Precision**: Resolved "damages" field persistence issues and fixed VAT deficit discrepancies in client-filtered reports.
- **Ledger Summary**: Added full-screen toggle for Monthly Breakdown tables for better data analysis.

### 👥 HR & Recruitment
- **Interview Manager Enhancements**: Added collapsible stats section and improved AI-powered CV parsing for PDF/DOCX formats.
- **Unified User Status**: Standardized user filtering across the app using the global `isActive` flag.

---

## 🚀 Previous Updates (v1.5.2)
- **Production Build Pipeline**: Finalized the v1.5.2 production releases for Electron and Android.
- **System Stability**: General bug fixes and internal performance optimizations.

---

## 🚀 Previous Updates (v1.4.7)

### 🗓️ Task Management Revolution
- **Integrated Task Dashboard**: Launched a comprehensive task management hub with multi-view support (List, Calendar, Kanban).
- **Subtask & Progress Tracking**: Added granular subtask management with real-time progress indicators and administrative controls.
- **Smart Notifications**: Introduced Desktop Floating Calendars and Popup Notifications for proactive task tracking.
- **Task Archive**: Implemented a long-term task archival system for historical data management.

### 💰 Finance & Billing Excellence
- **Automated Billing Module**: Implemented a powerful Billing module supporting multi-machine invoice calculations and duration tracking.
- **Financial Reporting Dashboard**: Launched a multi-view financial analysis dashboard with payroll integration and data export.
- **Custom Report Builder**: Added tools for generating bespoke financial and payroll reports.

### 👥 HR & Onboarding
- **New Hire Workflow**: Streamlined the employee onboarding process with dedicated New Hire pages and documentation tracking.
- **RBAC Refinements**: Hardened user privilege schemas and role-based access controls across the dashboard.

### 📊 Operational Analytics
- **Weekly Report 2.0**: Redesigned weekly reports with advanced data visualization and multi-format export capabilities.
- **Site Onboarding Flow**: Implemented a structured workflow for client site onboarding and configuration management.

---

## 🚀 Previous Updates (v1.4.6)

## 🚀 Previous Updates (v1.4.4)

## 🚀 Previous Updates (v1.4.3)

### 📊 Operations & Asset Management
- **Asset Logging Reliability**: Resolved data persistence issues where asset logging requirements would reset after page refresh.
- **Operations UI Finalization**: Completed the transition from teal to the primary blue theme across all Operations modules.

---

## 🚀 Previous Updates (v1.4.2)

### 💬 Modern Task Experience
- **WhatsApp-Style Updates**: Reimagined task communications with a bubble-based chat interface.
- **Smart Notifications**: Refined reminder logic to trigger only at specified times with direct navigation.

### 💰 Billing & Payroll Refinements
- **Pro-rated Salaries**: Automated salary adjustments for employees joining mid-month.
- **Multi-Machine Invoicing**: Granular control over machine rates and durations in billing.

---

---

## 🛠️ Getting Started

### Prerequisites
- **Node.js** (v18+)
- **Supabase Account** (for authentication and database)

### Setup
1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Environment Variables**:
   Create a `.env` file in the root directory and add your Supabase credentials.
3. **Run Dev Mode**:
   ```bash
   npm run dev
   ```

### Building for Production
- **Electron (Windows)**: `npm run electron:build:win`
- **Android**: `npm run android:build`

---

## 🏗️ Version History
- **v1.5.3**: Advanced Machine Analytics, Task Workflow refinements, Financial Reporting optimizations, and Interview Manager enhancements.
- **v1.5.2**: Stability improvements and finalized build pipeline.
- **v1.4.7**: Task Management Revolution, Billing & Financial Dashboards, New Hire Onboarding.
- **v1.4.6**: Operations Reporting, Mobile Task UI, Staff Attendance, and Payroll precision logic.
- **v1.4.5**: Stability improvements and internal state management updates.
- **v1.4.4**: Client contacts relocation, enhanced site view toggles, and internal site diary refactor.
- **v1.4.3**: Asset logging reliability and Operations theme finalization.
- **v1.4.2**: Modern Task UI, Operations theme standardization, and multi-machine billing.
- **v1.4.1**: HMO Management and automated renewal task synchronization.
- **v1.4.0**: Comprehensive Payroll, Loans, and Reporting upgrade.
- **v1.3.6**: Stability fixes and UI refinements.
- **v1.3.5**: Initial site management and billing groundwork.
