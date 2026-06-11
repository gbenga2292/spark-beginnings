import React, { Suspense, lazy, useState } from 'react';
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
  Printer,
  Search
} from 'lucide-react';
import { Card, CardContent } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { cn } from '@/src/lib/utils';
import { MaintenanceDashboard } from '@/src/pages/MaintenanceDashboard';
import { MaintenanceAssetGrid } from '@/src/pages/MaintenanceAssetGrid';
import { LogMaintenanceForm } from '@/src/pages/LogMaintenanceForm';
import { toast } from '@/src/components/ui/toast';
import { Badge } from '@/src/components/ui/badge';
import { formatDisplayDate } from '@/src/lib/dateUtils';

const MaintenanceCertificateModal = lazy(() => import('@/src/components/maintenance/MaintenanceCertificateModal').then(m => ({ default: m.MaintenanceCertificateModal })));

type MaintenanceTab = 'dashboard' | 'machines' | 'vehicles' | 'log' | 'certificates';

import { useSetPageTitle } from '@/src/contexts/PageContext';

export function MaintenanceManager() {
  const [activeTab, setActiveTab] = useState<MaintenanceTab>('dashboard');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [logViewAssetId, setLogViewAssetId] = useState<string | null>(null);
  const [logAssetId, setLogAssetId] = useState<string | null>(null);
  const [previousTab, setPreviousTab] = useState<MaintenanceTab>('dashboard');
  const [regenCert, setRegenCert] = useState<MaintenanceCertificate | null>(null);
  const [generateCertAsset, setGenerateCertAsset] = useState<string | null>(null);
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [assetSearch, setAssetSearch] = useState('');
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
    toast.info('Opening print dialog...');

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
      { id: 'structural', label: 'Structural Integrity',       desc: 'Checks for any physical damage or wear that could compromise safety.' },
      { id: 'performance', label: 'Performance Testing',        desc: 'Assesses the functionality under simulated usage conditions.' },
      { id: 'standards',   label: 'Compliance with Standards',  desc: 'Verification against relevant health and safety standards.' },
      { id: 'training',    label: 'User Training Verification', desc: 'Confirmation of proper training provided to equipment users.' },
      { id: 'maintenance', label: 'Maintenance Review',         desc: 'Review of regular maintenance and repairs conducted.' },
    ];

    // SectionTitle: text LEFT, fading line RIGHT — matches modal SectionTitle component
    const sectionTitle = (t: string) =>
      `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <p style="font-size:11pt;font-weight:900;text-transform:uppercase;letter-spacing:0.2em;color:#0a1628;white-space:nowrap;flex-shrink:0">${t}</p>
        <div style="flex:1;height:1px;background:linear-gradient(to right,rgba(10,22,40,0.3),transparent)"></div>
      </div>`;

    const th = (label: string, extra = '') =>
      `<th style="padding:4px 8px;text-align:left;font-weight:700;text-transform:uppercase;font-size:8pt;border-right:1px solid rgba(10,22,40,0.1);${extra}">${label}</th>`;

    const td = (content: string, extra = '') =>
      `<td style="padding:6px 8px;font-size:9pt;color:#374151;border-right:1px solid rgba(10,22,40,0.1);${extra}">${content}</td>`;

    const tdBold = (content: string, extra = '') =>
      `<td style="padding:6px 8px;font-size:9pt;font-weight:700;color:#0a1628;border-right:1px solid rgba(10,22,40,0.1);${extra}">${content}</td>`;

    const criteriaRows = CRITERIA_LIST.map(c => {
      const ok = cert.criteriaCompliance?.[c.id] !== false;
      return `<tr style="border-bottom:1px solid rgba(10,22,40,0.1)">
        ${tdBold(c.label)}
        ${td(c.desc, 'line-height:1.5')}
        <td style="padding:6px 8px;text-align:center">
          <span style="display:inline-flex;align-items:center;gap:4px;padding:2px 6px;border-radius:4px;font-weight:700;font-size:8pt;text-transform:uppercase;background:${ok ? '#d1fae5' : '#fee2e2'};color:${ok ? '#065f46' : '#991b1b'}">${ok ? '✓ Pass' : '✗ Fail'}</span>
        </td>
      </tr>`;
    }).join('');

    const logoSrc = `${window.location.origin}/logo/logo-2.png`;
    const tHeadRow = `background:rgba(248,249,250,0.8);border-bottom:1px solid rgba(10,22,40,0.2);color:#0a1628`;

    const html = `<!DOCTYPE html><html><head>
  <meta charset="utf-8"/>
  <title>Equipment Certificate — ${cert.machineName}</title>
  <style>
    @page{size:A4 portrait;margin:0}
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#fff;font-family:Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    table{border-collapse:collapse;width:100%}
  </style>
</head><body>

<div style="width:210mm;min-height:297mm;background:#fff;position:relative;font-family:Arial,sans-serif">
  <!-- Navy outer border -->
  <div style="position:absolute;inset:0;border:10px solid #0a1628;pointer-events:none;z-index:10"></div>
  <!-- Gold inner line at 10mm -->
  <div style="position:absolute;inset:10mm;border:1.5px solid #c9a84c;pointer-events:none;z-index:10"></div>
  <!-- Thin inner navy line -->
  <div style="position:absolute;top:10mm;bottom:13mm;left:13mm;right:13mm;border:1px solid rgba(10,22,40,0.2);pointer-events:none;z-index:10"></div>

  <!-- Background watermark -->
  <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:1">
    <img src="${logoSrc}" style="width:70%;opacity:0.15;filter:grayscale(100%);object-fit:contain" onerror="this.style.display='none'"/>
  </div>

  <!-- Content: 0.5in top, 1in sides/bottom -->
  <div style="position:absolute;top:0.5in;bottom:1in;left:1in;right:1in;display:flex;flex-direction:column;gap:10px;z-index:5">

    <!-- HEADER -->
    <div style="display:flex;flex-direction:column;gap:8px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:12px;flex:1;padding-right:8px">
          <img src="${logoSrc}" style="height:70px;max-width:150px;object-fit:contain;flex-shrink:0;margin-left:-24px" onerror="this.style.display='none'"/>
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1">
            <h1 style="font-size:10pt;font-weight:900;color:#0a1628;text-transform:uppercase;line-height:1.2;white-space:nowrap;text-align:center">${company.name}</h1>
            <p style="font-size:8pt;color:#6b7280;margin-top:2px;text-align:center;max-width:400px;line-height:1.4">${company.address}</p>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;flex-shrink:0">
          <div style="background:#f8f5e4;border:1px solid rgba(201,168,76,0.4);padding:2px 8px;border-radius:3px;text-align:right">
            <p style="font-size:6.5pt;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#c9a84c">Certificate No.</p>
            <p style="font-family:monospace;font-weight:700;color:#0a1628;font-size:8.5pt;letter-spacing:0.05em;margin-top:2px;white-space:nowrap">${cert.certNumber}</p>
          </div>
          <p style="font-size:7.5pt;color:#6b7280;margin-top:4px;white-space:nowrap">Date Issued: <span style="font-weight:700;color:#0a1628">${issuedFmt}</span></p>
        </div>
      </div>
      <div style="text-align:center;margin-top:2px">
        <div style="height:2px;background:linear-gradient(to right,transparent,rgba(201,168,76,0.6),transparent);margin-bottom:8px"></div>
        <h2 style="font-size:16pt;font-weight:900;color:#0a1628;text-transform:uppercase;letter-spacing:0.15em">Equipment Certification</h2>
        <p style="font-size:10pt;color:#6b7280;margin-top:2px;font-style:italic;font-family:Georgia,serif">An official document for maintaining compliance with equipment operational and safety regulations</p>
      </div>
    </div>

    <!-- SECTION 1: Equipment Details -->
    <div>
      ${sectionTitle('Equipment Details')}
      <div style="border:1px solid rgba(10,22,40,0.2);border-radius:4px;overflow:hidden">
        <table>
          <thead><tr style="${tHeadRow}">${th('Equipment Type')}${th('Manufacturer')}${th('Model No.')}${th('Last Inspection Date','border-right:none')}</tr></thead>
          <tbody>
            <tr style="border-bottom:1px solid rgba(10,22,40,0.1)">
              ${tdBold(cert.machineName)}${td(cert.manufacturer||'—')}${td(cert.modelNumber||'—')}${td(inspFmt,'border-right:none')}
            </tr>
            ${cert.machineSerial?`<tr>${td('<span style="color:#6b7280;font-style:italic">Serial / Registration</span>')}
              <td colspan="2" style="padding:6px 8px;font-size:9pt;font-weight:700;color:#0a1628;border-right:1px solid rgba(10,22,40,0.1)">${cert.machineSerial}</td>
              ${td(`Site: <span style="font-weight:700;color:#0a1628">${cert.machineSite}</span>`,'border-right:none;color:#6b7280;font-style:italic')}</tr>`:''}
          </tbody>
        </table>
      </div>
    </div>

    <!-- SECTION 2: Certification Criteria -->
    <div>
      ${sectionTitle('Certification Criteria')}
      <div style="border:1px solid rgba(10,22,40,0.2);border-radius:4px;overflow:hidden">
        <table>
          <thead><tr style="${tHeadRow}">${th('Criteria','width:28%')}${th('Description')}${th('Compliance','width:14%;text-align:center;border-right:none')}</tr></thead>
          <tbody>${criteriaRows}</tbody>
        </table>
      </div>
    </div>

    <!-- SECTION 3: Certification Outcome -->
    <div>
      ${sectionTitle('Certification Outcome')}
      <div style="border:1px solid rgba(10,22,40,0.2);border-radius:4px;overflow:hidden">
        <table>
          <thead><tr style="${tHeadRow}">${th('Equipment Designation')}${th('Status','text-align:center')}${th('Certified Until','text-align:center')}${th('Remarks','border-right:none')}</tr></thead>
          <tbody><tr>
            ${tdBold(`${cert.machineName}${cert.modelNumber?' '+cert.modelNumber:''}`)}
            <td style="padding:6px 8px;text-align:center;border-right:1px solid rgba(10,22,40,0.1)">
              <span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:4px;font-weight:900;font-size:8pt;text-transform:uppercase;background:${allCompliant?'#d1fae5':'#fee2e2'};color:${allCompliant?'#065f46':'#991b1b'};border:1px solid ${allCompliant?'#6ee7b7':'#fca5a5'}">${allCompliant?'✓ Certified':'✗ Not Certified'}</span>
            </td>
            <td style="padding:6px 8px;text-align:center;font-weight:700;color:#0a1628;font-size:9pt;border-right:1px solid rgba(10,22,40,0.1)">${expiryFmt}</td>
            ${td(cert.outcomeRemarks||'—','border-right:none')}
          </tr></tbody>
        </table>
      </div>
    </div>

    <!-- SECTION 4: Declaration -->
    <div>
      ${sectionTitle('Declaration')}
      <div style="background:rgba(248,249,250,0.5);border:1px solid rgba(10,22,40,0.15);border-radius:4px;padding:10px;font-size:9pt;color:#374151;line-height:1.6;font-family:Georgia,serif;font-style:italic">
        I hereby certify that the above-mentioned equipment has been thoroughly inspected in accordance with the company&#39;s operational standards, safety protocols, and applicable industry regulations. The information provided in this document is accurate to the best of my knowledge and professional judgment.
        ${cert.conditionsOfOperation ? `<p style="margin-top:6px;font-style:normal"><span style="font-weight:700;color:#0a1628;text-transform:uppercase;font-size:8pt;letter-spacing:0.05em">Operating Conditions:</span> ${cert.conditionsOfOperation}</p>` : ''}
        ${cert.complianceStandards ? `<p style="margin-top:4px;font-style:normal"><span style="font-weight:700;color:#0a1628;text-transform:uppercase;font-size:8pt;letter-spacing:0.05em">Standards Referenced:</span> ${cert.complianceStandards}</p>` : ''}
      </div>
    </div>

    <!-- FOOTER: no top border — matches modal exactly -->
    <div style="margin-top:auto;padding-top:8px;display:flex;align-items:flex-end;justify-content:space-between">
      <!-- Signature block -->
      <div style="display:flex;align-items:center;gap:24px">
        <div style="width:240px">
          <div style="height:40px;border-bottom:1px solid rgba(10,22,40,0.4);position:relative;margin-bottom:6px">
            <span style="position:absolute;bottom:2px;right:0;font-size:7pt;color:rgba(10,22,40,0.3);font-style:italic;font-family:Georgia,serif">Sign Here</span>
          </div>
          <p style="font-size:10pt;font-weight:900;color:#0a1628;text-transform:uppercase;letter-spacing:0.05em;line-height:1.2">${cert.issuedByName || '____________________________'}</p>
          <p style="font-size:8pt;color:#6b7280;text-transform:uppercase;letter-spacing:0.1em;margin-top:2px">${cert.issuedByDesignation || ''}</p>
          <p style="font-size:8pt;color:#9ca3af;margin-top:2px">Authorized Certification Officer</p>
        </div>
      </div>
      <!-- Company info -->
      <div style="text-align:right;padding-bottom:4px">
        <p style="font-size:9pt;font-weight:700;color:#0a1628;line-height:1.3">${company.name}</p>
        <p style="font-size:8pt;color:#6b7280;margin-top:2px">${company.email}</p>
        <p style="font-size:8pt;color:#6b7280">${company.phone}</p>
        <span style="display:inline-flex;align-items:center;gap:4px;margin-top:6px;font-size:8pt;color:#065f46;font-weight:700;background:#d1fae5;border:1px solid #6ee7b7;padding:2px 8px;border-radius:999px">✓ Valid until: ${expiryFmt}</span>
      </div>
    </div>

  </div><!-- end content -->
</div><!-- end page -->
<script>window.onload=function(){setTimeout(function(){window.focus();window.print();},200)};</script>
</body></html>`;

    const win = window.open('', '_blank', 'width=950,height=750');
    if (!win) { toast.error('Pop-up blocked — please allow pop-ups and try again'); return; }
    win.document.write(html);
    win.document.close();
    toast.success('Print dialog opened');
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
              <Button
                size="sm"
                className="gap-2 h-9 bg-blue-600 hover:bg-blue-700 text-white shadow-sm font-bold"
                onClick={() => { setAssetSearch(''); setShowAssetPicker(true); }}
              >
                <Plus className="h-4 w-4" /> Generate Certificate
              </Button>
            </div>

            {maintenanceCertificates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="h-16 w-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                  <Award className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                </div>
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400">No certificates issued yet</p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  Click <span className="font-bold text-amber-600">Generate Certificate</span> above to issue your first one.
                </p>
                <Button
                  size="sm"
                  className="mt-4 gap-2 h-9 bg-blue-600 hover:bg-blue-700 text-white shadow-sm font-bold"
                  onClick={() => { setAssetSearch(''); setShowAssetPicker(true); }}
                >
                  <Plus className="h-4 w-4" /> Generate Certificate
                </Button>
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

      {/* Asset Picker Modal */}
      {showAssetPicker && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowAssetPicker(false)}>
          <div className="bg-white dark:bg-[#0d1117] rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
              <div>
                <p className="font-black text-slate-900 dark:text-white text-sm">Select Asset</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Choose a machine or vehicle to certify</p>
              </div>
              <button onClick={() => setShowAssetPicker(false)} className="h-7 w-7 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 flex items-center justify-center">
                <span className="text-slate-500 text-lg leading-none">&times;</span>
              </button>
            </div>
            {/* Search */}
            <div className="px-4 pt-3 pb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  autoFocus
                  value={assetSearch}
                  onChange={e => setAssetSearch(e.target.value)}
                  placeholder="Search machines & vehicles..."
                  className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-blue-500/60"
                />
              </div>
            </div>
            {/* Asset List */}
            <div className="overflow-y-auto max-h-72 px-2 pb-3">
              {maintenanceAssets
                .filter(a => a.name.toLowerCase().includes(assetSearch.toLowerCase()) || a.category.toLowerCase().includes(assetSearch.toLowerCase()))
                .map(asset => (
                  <button
                    key={asset.id}
                    onClick={() => { setGenerateCertAsset(asset.id); setShowAssetPicker(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/10 text-left transition-colors group"
                  >
                    <div className="h-9 w-9 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center shrink-0 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/20 transition-colors">
                      {asset.category === 'vehicle' ? <Truck className="h-4 w-4 text-slate-500 group-hover:text-blue-600" /> : <Activity className="h-4 w-4 text-slate-500 group-hover:text-blue-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-white truncate group-hover:text-blue-700 dark:group-hover:text-blue-400">{asset.name}</p>
                      <p className="text-[11px] text-slate-400 capitalize">{asset.category} · {asset.site}</p>
                    </div>
                    <Award className="h-4 w-4 text-slate-300 group-hover:text-blue-500 shrink-0" />
                  </button>
                ))}
              {maintenanceAssets.filter(a => a.name.toLowerCase().includes(assetSearch.toLowerCase())).length === 0 && (
                <p className="text-center text-sm text-slate-400 py-8">No assets found</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Generate Certificate Modal (from Certificates tab) */}
      {generateCertAsset && (() => {
        const asset = maintenanceAssets.find(a => a.id === generateCertAsset);
        const sessions = maintenanceSessions.filter(s => s.assets.some(a => a.assetId === generateCertAsset));
        return asset ? (
          <Suspense fallback={<div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40"><div className="rounded-full bg-slate-900/95 text-white px-4 py-2 text-sm">Loading certificate editor...</div></div>}>
            <MaintenanceCertificateModal
              asset={asset}
              sessions={sessions}
              isOpen={!!generateCertAsset}
              onClose={() => setGenerateCertAsset(null)}
            />
          </Suspense>
        ) : null;
      })()}

      {/* Re-generate Certificate Modal */}
      {regenCert && (() => {
        const relatedAsset = maintenanceAssets.find(a => a.id === regenCert.machineId);
        const relatedSessions = maintenanceSessions.filter(
          s => s.assets.some(a => a.assetId === regenCert.machineId)
        );
        return relatedAsset ? (
          <Suspense fallback={<div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40"><div className="rounded-full bg-slate-900/95 text-white px-4 py-2 text-sm">Loading certificate editor...</div></div>}>
            <MaintenanceCertificateModal
              asset={relatedAsset}
              sessions={relatedSessions}
              isOpen={!!regenCert}
              onClose={() => setRegenCert(null)}
              presetCertificate={regenCert}
            />
          </Suspense>
        ) : null;
      })()}
    </div>
  );
}

