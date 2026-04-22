<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# DCEL Office Suite

DCEL Office Suite is a comprehensive HR and Finance management system designed for construction companies. It integrates daily attendance tracking, automated payroll computation, healthcare (HMO) management, and financial reporting into a unified desktop and mobile application.

## 🚀 Recent Updates (v1.4.2)

### 💬 Modern Task Experience
- **WhatsApp-Style Updates**: Reimagined task communications with a bubble-based chat interface, sender avatars, and colored names.
- **Improved Attachments**: Enhanced file sharing and subtask creation within the task update pane.
- **Smart Notifications**: Refined reminder logic to trigger only at specified times with direct navigation to task details.

### 🏗️ Operations & Logistics (Standardized)
- **Blue Theme Integration**: Completed the visual migration of the Operations module, ensuring consistent primary blue branding across Site Inventory, Waybills, and Checkouts.
- **Vehicle Tracking 2.0**: Robust movement log persistence with real-time Supabase sync and improved data hydration.
- **Unified Site/Client Hub**: Consolidated module for managing Sites and Clients with a unified site diary and conversation history.

### 💰 Billing & Payroll Refinements
- **Pro-rated Salaries**: Automated salary adjustments for employees joining mid-month.
- **Multi-Machine Invoicing**: Granular control over machine rates and durations in billing, supporting complex multi-asset projects.

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
