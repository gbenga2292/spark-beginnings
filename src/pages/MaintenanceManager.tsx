import React, { useState } from 'react';
import { useOperations } from '../contexts/OperationsContext';
import { supabase } from '@/src/integrations/supabase/client';
import { MaintenanceCertificate } from '../types/operations';
import { 
  Plus, 
  Settings2, 
  Wrench,
  Clock,
  AlertCircle,
  BarChart3,
  Calendar,
  CheckCircle2,
  List,
  LayoutDashboard,
  Activity,
  Truck,
  FileDown,
  ChevronDown,
  Award,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Printer
} from 'lucide-react';
import { Card, CardContent } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { cn } from '@/src/lib/utils';
import { MaintenanceDashboard } from '@/src/pages/MaintenanceDashboard';
import { MaintenanceAssetGrid } from '@/src/pages/MaintenanceAssetGrid';
import { LogMaintenanceForm } from '@/src/pages/LogMaintenanceForm';
import { MaintenanceCertificateModal } from '@/src/components/maintenance/MaintenanceCertificateModal';
import { toast } from '@/src/components/ui/toast';
import { Badge } from '@/src/components/ui/badge';
import { formatDisplayDate } from '@/src/lib/dateUtils';

type MaintenanceTab = 'dashboard' | 'machines' | 'vehicles' | 'log' | 'certificates';

import { useSetPageTitle } from '@/src/contexts/PageContext';

export function MaintenanceManager() {
  const [activeTab, setActiveTab] = useState<MaintenanceTab>('dashboard');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [logViewAssetId, setLogViewAssetId] = useState<string | null>(null);
  const [logAssetId, setLogAssetId] = useState<string | null>(null);
  const [previousTab, setPreviousTab] = useState<MaintenanceTab>('dashboard');
  const [regenCert, setRegenCert] = useState<MaintenanceCertificate | null>(null);
  const { maintenanceAssets, maintenanceSessions, maintenanceCertificates } = useOperations();
  
  const handleLogAsset = (id: string) => {
    setPreviousTab(activeTab);
    setLogAssetId(id);
    setActiveTab('log');
    setSelectedAssetId(null);
    setLogViewAssetId(null);
  };
  
  const machinesCount = maintenanceAssets.filter(a => a.category === 'machine').length;
  const vehiclesCount = maintenanceAssets.filter(a => a.category === 'vehicle').length;

  // ── Direct print: renders the saved certificate as pure HTML in a new window.
  // No html2canvas — fires the print dialog in < 1 second.
  const handleDirectPrint = async (cert: MaintenanceCertificate) => {
    toast.loading('Opening print dialog...');

    // Fetch company info with fallback defaults
    let company = {
      name: 'Dewatering Construction Etc Limited',
      regNumber: 'RC-1245678',
      email: 'hr@dcel.com',
      phone: '+234 801 234 5678',
      address: 'Victoria Island, Lagos, Nigeria',
    };
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('company_name,company_reg_number,company_email,company_phone,company_address')
        .limit(1).single();
      if (data) {
        company = {
          name: data.company_name || company.name,
          regNumber: data.company_reg_number || company.regNumber,
          email: data.company_email || company.email,
          phone: data.company_phone || company.phone,
          address: data.company_address || company.address,
        };
      }
    } catch { /* use defaults */ }

    const fmt = (d?: string | null) =>
      d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A';

    const issuedFmt    = fmt(cert.issuedDateOverride || cert.issuedDate);
    const expiryFmt    = fmt(cert.expiryDate);
    const inspFmt      = fmt(cert.lastInspectionDateOverride || cert.lastServiceDate);
    const allCompliant = cert.criteriaCompliance
      ? Object.values(cert.criteriaCompliance).every(Boolean)
      : true;

    const CRITERIA_LIST = [
      { id: 'structural', label: 'Structural Integrity',        desc: 'Checks for any physical damage or wear that could compromise safety.' },
      { id: 'performance', label: 'Performance Testing',         desc: 'Assesses the functionality under simulated usage conditions.' },
      { id: 'standards',   label: 'Compliance with Standards',   desc: 'Verification against relevant health and safety standards.' },
      { id: 'training',    label: 'User Training Verification',  desc: 'Confirmation of proper training provided to equipment users.' },
      { id: 'maintenance', label: 'Maintenance Review',          desc: 'Review of regular maintenance and repairs conducted.' },
    ];

    const criteriaRows = CRITERIA_LIST.map((c, i) => {
      const ok = cert.criteriaCompliance?.[c.id] !== false;
      return `<tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
        <td style="border:1px solid #e5e7eb;padding:7px 10px;font-weight:700;color:#0a1628;font-size:8px">${c.label}</td>
        <td style="border:1px solid #e5e7eb;padding:7px 10px;color:#374151;font-size:8px;line-height:1.5">${c.desc}</td>
        <td style="border:1px solid #e5e7eb;padding:7px 10px;text-align:center">
          <span style="padding:2px 8px;border-radius:4px;font-weight:900;font-size:7.5px;text-transform:uppercase;background:${ok ? '#d1fae5' : '#fee2e2'};color:${ok ? '#065f46' : '#991b1b'}">${ok ? '✓ Yes' : '✗ No'}</span>
        </td></tr>`;
    }).join('');

    // HTML snippet helpers (local to keep template readable)
    const sectionTitle = (t: string) =>
      `<div style="display:flex;align-items:center;gap:8px">` +
      `<div style="flex:1;height:1.5px;background:rgba(10,22,40,0.15)"></div>` +
      `<p style="font-size:8.5px;font-weight:900;text-transform:uppercase;letter-spacing:0.18em;color:#0a1628;padding:0 4px">${t}</p>` +
      `<div style="flex:1;height:1.5px;background:#c9a84c"></div></div>`;

    const th = (label: string, extra = '') =>
      `<th style="border:1px solid #1e3a5f;padding:7px 10px;text-align:left;font-weight:700;text-transform:uppercase;font-size:7.5px;${extra}">${label}</th>`;

    const logoSrc = `${window.location.origin}/logo/logo-2.png`;
    const shieldSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0a1628" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>`;

    const html = `<!DOCTYPE html><html><head>
  <meta charset="utf-8"/>
  <title>Equipment Certificate — ${cert.machineName}</title>
  <style>
    @page{size:A4 portrait;margin:0}
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#fff;font-family:Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  </style>
</head><body>
<div style="width:210mm;min-height:297mm;background:#fff;position:relative;font-family:Arial,sans-serif">
  <div style="position:absolute;inset:0;border:10px solid #0a1628;pointer-events:none;z-index:10"></div>
  <div style="position:absolute;inset:14px;border:1.5px solid #c9a84c;pointer-events:none;z-index:10"></div>
  <!-- watermark -->
  <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:1">
    <img src="${logoSrc}" style="width:60%;opacity:0.07;object-fit:contain" onerror="this.style.display='none'"/>
  </div>
  <div style="position:absolute;inset:24px;display:flex;flex-direction:column;z-index:5">

    <!-- HEADER -->
    <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:11px;border-bottom:2px solid #0a1628">
      <img src="${logoSrc}" style="height:60px;object-fit:contain" onerror="this.style.display='none'"/>
      <div style="text-align:center;flex:1;padding:0 14px">
        <h1 style="font-size:14px;font-weight:900;color:#0a1628;text-transform:uppercase;letter-spacing:0.05em;line-height:1.2">${company.name}</h1>
        <p style="font-size:8px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin-top:2px">RC No: ${company.regNumber} &nbsp;·&nbsp; ${company.address}</p>
        <div style="height:2px;background:linear-gradient(to right,transparent,#c9a84c,transparent);margin:5px 0"></div>
        <h2 style="font-size:12px;font-weight:900;color:#0a1628;text-transform:uppercase;letter-spacing:0.12em">Equipment Certification Form</h2>
        <p style="font-size:7.5px;color:#6b7280;margin-top:2px;font-style:italic;font-family:Georgia,serif">An official document for maintaining compliance with equipment operational and safety regulations</p>
      </div>
      <div style="text-align:right;font-size:7.5px;color:#6b7280;min-width:95px">
        <p style="font-weight:700;color:#0a1628;font-size:8.5px">Cert Reference</p>
        <p style="font-family:monospace;font-weight:700;color:#0a1628;background:#f8f5e4;border:1px solid rgba(201,168,76,0.5);padding:2px 7px;border-radius:3px">${cert.certNumber}</p>
        <p style="margin-top:3px">Date Issued:</p>
        <p style="font-weight:700;color:#0a1628">${issuedFmt}</p>
      </div>
    </div>

    <!-- SECTION 1 -->
    <div style="margin-top:11px">
      ${sectionTitle('1. Equipment Details')}
      <table style="width:100%;border-collapse:collapse;font-size:8px;margin-top:5px">
        <thead><tr style="background:#0a1628;color:#fff">
          ${th('Equipment Type')}${th('Manufacturer')}${th('Model No.')}${th('Last Inspection Date')}
        </tr></thead>
        <tbody>
          <tr style="background:#fff">
            <td style="border:1px solid #e5e7eb;padding:7px 10px;font-weight:700;color:#0a1628">${cert.machineName}</td>
            <td style="border:1px solid #e5e7eb;padding:7px 10px;color:#374151">${cert.manufacturer || '—'}</td>
            <td style="border:1px solid #e5e7eb;padding:7px 10px;color:#374151">${cert.modelNumber || '—'}</td>
            <td style="border:1px solid #e5e7eb;padding:7px 10px;color:#374151">${inspFmt}</td>
          </tr>
          ${cert.machineSerial ? `<tr style="background:#f9fafb">
            <td style="border:1px solid #e5e7eb;padding:7px 10px;color:#6b7280;font-size:8px">Serial / Registration</td>
            <td colspan="2" style="border:1px solid #e5e7eb;padding:7px 10px;font-weight:700;color:#0a1628">${cert.machineSerial}</td>
            <td style="border:1px solid #e5e7eb;padding:7px 10px;color:#6b7280;font-size:8px">Site: <span style="font-weight:700;color:#0a1628">${cert.machineSite}</span></td>
          </tr>` : ''}
        </tbody>
      </table>
    </div>

    <!-- SECTION 2 -->
    <div style="margin-top:11px">
      ${sectionTitle('2. Certification Criteria')}
      <table style="width:100%;border-collapse:collapse;font-size:8px;margin-top:5px">
        <thead><tr style="background:#0a1628;color:#fff">
          <th style="border:1px solid #1e3a5f;padding:7px 10px;text-align:left;font-weight:700;text-transform:uppercase;font-size:7.5px;width:32%">Criteria</th>
          <th style="border:1px solid #1e3a5f;padding:7px 10px;text-align:left;font-weight:700;text-transform:uppercase;font-size:7.5px">Description</th>
          <th style="border:1px solid #1e3a5f;padding:7px 10px;text-align:center;font-weight:700;text-transform:uppercase;font-size:7.5px;width:14%">Compliance</th>
        </tr></thead>
        <tbody>${criteriaRows}</tbody>
      </table>
    </div>

    <!-- SECTION 3 -->
    <div style="margin-top:11px">
      ${sectionTitle('3. Certification Outcome')}
      <table style="width:100%;border-collapse:collapse;font-size:8px;margin-top:5px">
        <thead><tr style="background:#0a1628;color:#fff">
          ${th('Equipment Type')}${th('Certification Status', 'text-align:center')}${th('Certified Until', 'text-align:center')}${th('Remarks')}
        </tr></thead>
        <tbody><tr style="background:#fff">
          <td style="border:1px solid #e5e7eb;padding:9px 10px;font-weight:700;color:#0a1628">${cert.machineName}${cert.modelNumber ? ' ' + cert.modelNumber : ''}</td>
          <td style="border:1px solid #e5e7eb;padding:9px 10px;text-align:center">
            <span style="padding:3px 10px;border-radius:4px;font-weight:900;font-size:8px;text-transform:uppercase;background:${allCompliant ? '#d1fae5' : '#fee2e2'};color:${allCompliant ? '#065f46' : '#991b1b'};border:1px solid ${allCompliant ? '#6ee7b7' : '#fca5a5'}">${allCompliant ? '✓ Certified' : '✗ Not Certified'}</span>
          </td>
          <td style="border:1px solid #e5e7eb;padding:9px 10px;text-align:center;font-weight:700;color:#0a1628">${expiryFmt}</td>
          <td style="border:1px solid #e5e7eb;padding:9px 10px;color:#374151">${cert.outcomeRemarks || '—'}</td>
        </tr></tbody>
      </table>
    </div>

    <!-- SECTION 4 -->
    <div style="margin-top:11px">
      ${sectionTitle('4. Declaration')}
      <div style="margin-top:5px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:4px;padding:10px;font-size:8px;color:#374151;line-height:1.6;font-family:Georgia,serif;font-style:italic">
        I hereby certify that the above-mentioned equipment has been inspected according to the company&#39;s operational standards and procedures. The information provided in this form is accurate to the best of my knowledge and belief.
        ${cert.conditionsOfOperation ? `<p style="margin-top:5px;font-style:normal"><span style="font-weight:700;color:#0a1628">Operating Conditions:</span> ${cert.conditionsOfOperation}</p>` : ''}
        ${cert.complianceStandards ? `<p style="margin-top:3px;font-style:normal"><span style="font-weight:700;color:#0a1628">Standards Referenced:</span> ${cert.complianceStandards}</p>` : ''}
      </div>
    </div>

    <!-- FOOTER -->
    <div style="margin-top:auto;padding-top:14px;border-top:2px solid #0a1628;display:flex;align-items:flex-end;justify-content:space-between;gap:14px">
      <!-- Signature -->
      <div style="flex:1">
        <div style="height:36px;border-bottom:2px solid rgba(10,22,40,0.4);margin-bottom:5px"></div>
        <p style="font-size:8.5px;font-weight:900;color:#0a1628;text-transform:uppercase;letter-spacing:0.05em">${cert.issuedByName || '____________________________'}</p>
        <p style="font-size:7.5px;color:#6b7280;text-transform:uppercase;letter-spacing:0.1em;margin-top:2px">${cert.issuedByDesignation || ''}</p>
        <p style="font-size:7px;color:#9ca3af;margin-top:2px">Authorized Certification Officer</p>
      </div>
      <!-- Seal -->
      <div style="display:flex;flex-direction:column;align-items:center;margin-bottom:-2px">
        <p style="font-size:5px;font-weight:900;text-transform:uppercase;letter-spacing:0.18em;color:#c9a84c;white-space:nowrap;margin-bottom:3px">✦ OFFICIAL SEAL ✦</p>
        <div style="width:64px;height:64px;border-radius:50%;border:3px solid #c9a84c;display:flex;align-items:center;justify-content:center;background:#fff;position:relative">
          <div style="width:54px;height:54px;border-radius:50%;border:1px solid rgba(201,168,76,0.6);display:flex;align-items:center;justify-content:center;background:#fefdf8">
            <div style="text-align:center">${shieldSvg}<p style="font-size:4.5px;font-weight:900;color:#0a1628;text-transform:uppercase;letter-spacing:0.12em;margin-top:1px">DCEL</p></div>
          </div>
        </div>
      </div>
      <!-- Cert box -->
      <div style="flex:1;text-align:right">
        <div style="display:inline-block;background:#0a1628;color:#fff;padding:7px 11px;border-radius:4px;margin-bottom:3px">
          <p style="font-size:6.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#c9a84c">Certificate No.</p>
          <p style="font-size:8.5px;font-weight:900;letter-spacing:0.05em;font-family:monospace">${cert.certNumber}</p>
        </div>
        <p style="font-size:7px;color:#6b7280;font-weight:600">${company.email}</p>
        <p style="font-size:7px;color:#9ca3af">${company.phone}</p>
        <p style="font-size:6.5px;color:#9ca3af;margin-top:2px">Verified ✓ &nbsp;|&nbsp; Valid until: ${expiryFmt}</p>
      </div>
    </div>
  </div>
</div>
<script>window.onload=function(){setTimeout(function(){window.focus();window.print();},200)};<\/script>
</body></html>`;

    toast.dismiss();
    const win = window.open('', '_blank', 'width=950,height=750');
    if (!win) { toast.error('Pop-up blocked — please allow pop-ups and try again'); return; }
    win.document.write(html);
    win.document.close();
  };

  const handleExport = () => {
    const headers = ['Name', 'Category', 'Description', 'Status', 'Last Service Date', 'Next Service Date'];
    const rows = maintenanceAssets.map(a => [
      a.name, 
      a.category || '', 
      (a as any).description ? `"${String((a as any).description).replace(/"/g, '""')}"` : '',
      a.status || '', 
      a.lastServiceDate || '', 
      a.nextServiceDate || ''
    ].join(','));
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `maintenance_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Export downloaded successfully');
  };

  const isSubViewActive = !!selectedAssetId || !!logViewAssetId;

  useSetPageTitle(
    isSubViewActive ? '' : 'Equipment Maintenance',
    isSubViewActive ? '' : 'Track and manage heavy machinery and vehicle service schedules',
    !isSubViewActive && (
      <div className="flex items-center gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2 h-9 border-slate-200 hidden sm:flex"
          onClick={handleExport}
        >
          <FileDown className="h-4 w-4" /> Export
        </Button>
        {activeTab !== 'log' && (
          <Button 
            size="sm" 
            className="gap-2 h-9 bg-blue-600 hover:bg-blue-700 text-white shadow-sm" 
            onClick={() => { setPreviousTab(activeTab); setActiveTab('log'); }}
          >
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Log Service</span>
          </Button>
        )}
      </div>
    )
  );

  const tabs = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'machines', label: 'Machines', count: machinesCount, icon: Activity },
    { id: 'vehicles', label: 'Vehicles', count: vehiclesCount, icon: Truck },
    { id: 'certificates', label: 'Certificates', count: maintenanceCertificates.length || undefined, icon: Award },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10 px-4 sm:px-6 lg:px-8">
      {/* Tabs - Hidden if viewing details or log */}
      {!isSubViewActive && (
        <div className="flex border-b border-slate-200 dark:border-slate-800 gap-8 px-2 mx-1 mb-1 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as MaintenanceTab);
                setSelectedAssetId(null);
                setLogAssetId(null);
                setLogViewAssetId(null);
              }}
              className={cn(
                "pb-3 text-sm font-bold transition-all border-b-2 whitespace-nowrap flex items-center gap-2",
                activeTab === tab.id 
                  ? 'border-blue-600 text-blue-600' 
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              )}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={cn(
                  "px-1.5 py-0.5 rounded-lg text-[10px]",
                  activeTab === tab.id ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Tab Content */}
      <div className="flex-1">
        {activeTab === 'dashboard' && <MaintenanceDashboard />}
        {activeTab === 'machines' && (
          <MaintenanceAssetGrid 
            category="machine" 
            selectedAssetId={selectedAssetId}
            onSelectAsset={setSelectedAssetId}
            logViewAssetId={logViewAssetId}
            onSetLogViewAssetId={setLogViewAssetId}
            onLogAsset={handleLogAsset}
          />
        )}
        {activeTab === 'vehicles' && (
          <MaintenanceAssetGrid 
            category="vehicle" 
            selectedAssetId={selectedAssetId}
            onSelectAsset={setSelectedAssetId}
            logViewAssetId={logViewAssetId}
            onSetLogViewAssetId={setLogViewAssetId}
            onLogAsset={handleLogAsset}
          />
        )}
        {activeTab === 'log' && (
          <LogMaintenanceForm 
            initialAssetId={logAssetId} 
            onSuccess={() => setActiveTab(previousTab)} 
            onCancel={() => setActiveTab(previousTab)}
          />
        )}
        {activeTab === 'certificates' && (
          <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">Issued Certificates</h2>
                <p className="text-xs text-slate-400 mt-0.5">{maintenanceCertificates.length} certificate{maintenanceCertificates.length !== 1 ? 's' : ''} on record</p>
              </div>
            </div>

            {maintenanceCertificates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="h-16 w-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                  <Award className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                </div>
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400">No certificates issued yet</p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  Generate a certificate from a machine or vehicle's detail page to get started.
                </p>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                        <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Certificate No.</th>
                        <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Asset</th>
                        <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Issued By</th>
                        <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Issue Date</th>
                        <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Expiry Date</th>
                        <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Status</th>
                        <th className="px-5 py-3.5 text-[10px] font-black uppercase tracking-wider text-slate-400"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {maintenanceCertificates.map(cert => {
                        const isExpired = new Date(cert.expiryDate) < new Date();
                        const relatedAsset = maintenanceAssets.find(a => a.id === cert.machineId);
                        const relatedSessions = maintenanceSessions.filter(
                          s => s.assets.some(a => a.assetId === cert.machineId)
                        );
                        return (
                          <tr key={cert.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group">
                            <td className="px-5 py-3.5 font-mono text-xs font-bold text-blue-600 dark:text-blue-400">{cert.certNumber}</td>
                            <td className="px-5 py-3.5">
                              <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{cert.machineName}</p>
                              <p className="text-[10px] text-slate-400 capitalize">{cert.machineCategory} · {cert.machineSite}</p>
                            </td>
                            <td className="px-5 py-3.5">
                              <p className="font-medium text-slate-700 dark:text-slate-300 text-xs">{cert.issuedByName}</p>
                              {cert.issuedByDesignation && <p className="text-[10px] text-slate-400">{cert.issuedByDesignation}</p>}
                            </td>
                            <td className="px-5 py-3.5 text-xs text-slate-500">{formatDisplayDate(cert.issuedDate)}</td>
                            <td className="px-5 py-3.5 text-xs">
                              <span className={isExpired ? 'text-rose-500 font-bold' : 'text-slate-500'}>
                                {formatDisplayDate(cert.expiryDate)}
                              </span>
                            </td>
                            <td className="px-5 py-3.5">
                              <Badge
                                className={cn(
                                  'text-[10px] px-2 py-0.5 font-bold border rounded-full',
                                  isExpired
                                    ? 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400'
                                    : 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400'
                                )}
                              >
                                {isExpired ? 'Expired' : 'Valid'}
                              </Badge>
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 gap-1.5 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => {
                                    if (relatedAsset) {
                                      setRegenCert(cert);
                                    } else {
                                      toast.error('Asset not found for this certificate');
                                    }
                                  }}
                                >
                                  <RefreshCw className="h-3 w-3" /> Re-generate
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 gap-1.5 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => handleDirectPrint(cert)}
                                >
                                  <Printer className="h-3 w-3" /> Print
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Re-generate Certificate Modal */}
      {regenCert && (() => {
        const relatedAsset = maintenanceAssets.find(a => a.id === regenCert.machineId);
        const relatedSessions = maintenanceSessions.filter(
          s => s.assets.some(a => a.assetId === regenCert.machineId)
        );
        return relatedAsset ? (
          <MaintenanceCertificateModal
            asset={relatedAsset}
            sessions={relatedSessions}
            isOpen={!!regenCert}
            onClose={() => setRegenCert(null)}
            presetCertificate={regenCert}
          />
        ) : null;
      })()}
    </div>
  );
}

