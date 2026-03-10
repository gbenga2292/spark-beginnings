import fs from 'fs';

let appStr = fs.readFileSync('src/App.tsx', 'utf8');
appStr = appStr.replace(/import \{ FinanceHub \} from '\.\/pages\/FinanceHub';/, "import { Billing } from './pages/Billing';\nimport { Payments } from './pages/Payments';\nimport { VatPayments } from './pages/VatPayments';");
appStr = appStr.replace(/<Route path="finance" element=\{<FinanceHub \/>\} \/>/, `<Route path="invoices" element={<Billing />} />\n            <Route path="payments" element={<Payments />} />\n            <Route path="vat" element={<VatPayments />} />`);
fs.writeFileSync('src/App.tsx', appStr);

let sideStr = fs.readFileSync('src/components/layout/Sidebar.tsx', 'utf8');
sideStr = sideStr.replace(/\s*\{ name: 'Financial Dashboard', href: '\/finance', icon: Landmark, privKey: 'financeDashboard', privField: 'canView' \},/, '');
sideStr = sideStr.replace(/\{ name: 'Invoices', href: '\/finance\?tab=invoices', icon: Receipt, privKey: 'financeDashboard', privField: 'canView' \},/, "{ name: 'Invoices', href: '/invoices', icon: Receipt, privKey: 'financeDashboard', privField: 'canView' },");
sideStr = sideStr.replace(/\{ name: 'Payments', href: '\/finance\?tab=payments', icon: DollarSign, privKey: 'financeDashboard', privField: 'canView' \},/, "{ name: 'Payments', href: '/payments', icon: DollarSign, privKey: 'financeDashboard', privField: 'canView' },");
sideStr = sideStr.replace(/\{ name: 'VAT & Tax Filing', href: '\/finance\?tab=vat', icon: Landmark, privKey: 'financeDashboard', privField: 'canView' \},/, "{ name: 'VAT & Tax Filing', href: '/vat', icon: Landmark, privKey: 'financeDashboard', privField: 'canView' },");
fs.writeFileSync('src/components/layout/Sidebar.tsx', sideStr);

function addHeaderToPage(filePath, title, subtitle) {
    let content = fs.readFileSync(filePath, 'utf8');
    let newWrapper = `<div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-indigo-400">
                        ${title}
                    </h1>
                    <p className="text-sm font-medium text-slate-500 mt-1">${subtitle}</p>
                </div>
            </div>
            <div className="flex flex-col flex-1 h-full w-full animate-in fade-in duration-300 gap-6">`;

    content = content.replace('<div className="flex flex-col flex-1 h-full w-full animate-in fade-in duration-300 gap-6">', newWrapper);

    content = content.replace(/<\/div>\s*\)\s*;\s*\}\s*$/, '</div>\n        </div>\n    );\n}\n');

    fs.writeFileSync(filePath, content);
}

addHeaderToPage('src/pages/Billing.tsx', 'Invoices', 'Manage active and pending invoices.');
addHeaderToPage('src/pages/Payments.tsx', 'Payments', 'Record and manage client payments.');
addHeaderToPage('src/pages/VatPayments.tsx', 'VAT Remittance', 'Record VAT remittances to FIRS.');

if (fs.existsSync('src/pages/FinanceHub.tsx')) {
    fs.unlinkSync('src/pages/FinanceHub.tsx');
}
if (fs.existsSync('src/pages/FinanceDashboard.tsx')) {
    fs.unlinkSync('src/pages/FinanceDashboard.tsx');
}

console.log("Pages isolated successfully");
