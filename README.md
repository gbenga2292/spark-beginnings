<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# DCEL Office Suite

DCEL Office Suite is a comprehensive HR and Finance management system designed for construction companies. It integrates daily attendance tracking, automated payroll computation, healthcare (HMO) management, and financial reporting into a unified desktop and mobile application.

## 🚀 Recent Updates (v1.4.1)

### 🏥 HMO / LASHMA Management (New!)
- **Policy Directory**: Centralized tracking for employee health insurance (LASHMA/HMO).
- **Automated Renewal Tasks**: The system automatically detects policies expiring within 30 days and creates "Urgent" or "High" priority tasks for the HR department.
- **Smart Expiry Logic**: Automatically calculates end dates based on registration date and policy duration.
- **Renewal History**: Modal-based history logs to track policy changes over time.
- **Direct Export**: Export the entire HMO directory or pending renewals to CSV for external reporting.

### 💰 Payroll & Financials (v1.4.0)
- **A4 Payslip Engine**: Professional payslip generation with one-click Print and Download (.txt) support.
- **Attendance-Based Pay**: Real-time salary adjustments based on actual site attendance vs. official workdays.
- **Loan & Advance Management**: Automated deduction scheduling for salary advances and long-term loans.
- **Statutory Compliance**: Built-in logic for Nigerian PAYE tax and Pension contributions.

### 🏗️ Operations & Logistics
- **Site Work Reports**: Advanced site tracking with monthly and yearly density filtering.
- **Asset Analytics**: Real-time monitoring of equipment and restocking flows.

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
- **v1.4.1**: HMO Management and automated renewal task synchronization.
- **v1.4.0**: Comprehensive Payroll, Loans, and Reporting upgrade.
- **v1.3.6**: Stability fixes and UI refinements.
- **v1.3.5**: Initial site management and billing groundwork.
