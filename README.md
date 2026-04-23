<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# DCEL Office Suite

DCEL Office Suite is a comprehensive HR and Finance management system designed for construction companies. It integrates daily attendance tracking, automated payroll computation, healthcare (HMO) management, and financial reporting into a unified desktop and mobile application.

## 🚀 Recent Updates (v1.4.3)

### 📊 Operations & Asset Management
- **Asset Logging Reliability**: Resolved data persistence issues where asset logging requirements would reset after page refresh.
- **Operations UI Finalization**: Completed the transition from teal to the primary blue theme across all Operations modules, including Waybill and Site Inventory views.
- **Data Sync Enhancements**: Improved real-time synchronization between Supabase and the UI for vehicle movements and logistics logs.

### 🛠️ Stability & Performance
- **Critical Crash Fixes**: Resolved `ReferenceError: Label is not defined` in `DailyLogManager` and improved overall component error handling.
- **Hydration Improvements**: Refined data loading logic in `useDataLoader` to ensure accurate state restoration on initial load.

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
- **v1.4.2**: Modern Task UI, Operations theme standardization, and multi-machine billing.
- **v1.4.1**: HMO Management and automated renewal task synchronization.
- **v1.4.0**: Comprehensive Payroll, Loans, and Reporting upgrade.
- **v1.3.6**: Stability fixes and UI refinements.
- **v1.3.5**: Initial site management and billing groundwork.
