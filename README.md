<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# DCEL Office Suite

DCEL Office Suite is a comprehensive HR and Finance management system designed for construction companies. It integrates daily attendance tracking, automated payroll computation, healthcare (HMO) management, and financial reporting into a unified desktop and mobile application.

## 🚀 Recent Updates (v1.4.6)

### 📊 Operations & Reporting
- **Professional Operations Reports**: Launched a comprehensive reporting module for high-level business intelligence and operational tracking.
- **Enhanced Data Visualization**: Improved reporting dashboards with professional styling and clearer data presentation.

### 🛠️ Task & UX Optimization
- **Mobile Task Experience**: Refactored the Task Detail view for full mobile responsiveness and improved accessibility.
- **Smart Task Automation**: Optimized Vehicle Document renewal workflows with strict metadata-based idempotency to prevent duplicate tasks.
- **Task Stability**: Resolved issues causing redundant task generation in the vehicle tracking system.

### 💰 Payroll & Attendance
- **Staff Attendance Portal**: Created a dedicated Attendance page for streamlined tracking and management of staff records.
- **Precision Payroll Logic**: Synchronized payroll cycles with calendar months and corrected UTC boundary errors for accurate period calculations.
- **Holiday-Aware Calculations**: Integrated public holiday subtraction logic to ensure precise daily rate divisors.

---

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
- **v1.4.6**: Operations Reporting, Mobile Task UI, Staff Attendance, and Payroll precision logic.
- **v1.4.5**: Stability improvements and internal state management updates.
- **v1.4.4**: Client contacts relocation, enhanced site view toggles, and internal site diary refactor.
- **v1.4.3**: Asset logging reliability and Operations theme finalization.
- **v1.4.2**: Modern Task UI, Operations theme standardization, and multi-machine billing.
- **v1.4.1**: HMO Management and automated renewal task synchronization.
- **v1.4.0**: Comprehensive Payroll, Loans, and Reporting upgrade.
- **v1.3.6**: Stability fixes and UI refinements.
- **v1.3.5**: Initial site management and billing groundwork.
