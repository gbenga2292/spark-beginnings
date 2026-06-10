import React, { useState, useEffect, useRef } from 'react';
import {
  X, Download, ShieldCheck, Settings,
  CheckCircle2, XCircle, ClipboardList, Printer
} from 'lucide-react';
import { MaintenanceAsset, MaintenanceSession, MaintenanceCertificate } from '../../types/operations';
import { useOperations } from '../../contexts/OperationsContext';
import { useUserStore } from '../../store/userStore';
import { supabase } from '@/src/integrations/supabase/client';
import { formatDisplayDate } from '@/src/lib/dateUtils';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import logo2 from '@/logo/logo-2.png';

// Inject a single CSS override into the html2canvas cloned document to
// neutralise Tailwind v4 oklch/oklab color values — zero per-element work.
function sanitizeCloneForHtml2Canvas(clonedDoc: Document): void {
  const s = clonedDoc.createElement('style');
  s.textContent = [
    // Zero out every Tailwind v4 CSS variable that resolves to oklch/oklab.
    // Custom properties don't support !important, so we use :root + high-specificity
    // selectors to win the cascade inside the clone.
    ':root,html,body,*{',
    '  --tw-shadow:0 0 #0000;',
    '  --tw-shadow-color:transparent;',
    '  --tw-shadow-alpha:100%;',
    '  --tw-ring-shadow:0 0 #0000;',
    '  --tw-ring-color:transparent;',
    '  --tw-ring-offset-shadow:0 0 #0000;',
    '  --tw-inset-shadow:0 0 #0000;',
    '  --tw-inset-shadow-color:transparent;',
    '  --tw-inset-ring-shadow:0 0 #0000;',
    '  --tw-inset-ring-color:transparent;',
    '  --tw-border-color:transparent;',
    '  --tw-outline-color:transparent;',
    '}',
    // Force-remove shadows and outlines — the primary html2canvas crash source.
    '*{box-shadow:none!important;outline:none!important;text-shadow:none!important;}',
    // Ensure body/html don't pass an oklch inherited color into the certificate.
    'html,body{color:#000!important;background-color:#fff!important;}',
  ].join('\n');
  clonedDoc.head.appendChild(s);
}

interface MaintenanceCertificateModalProps {
  asset: MaintenanceAsset;
  sessions: MaintenanceSession[];
  isOpen: boolean;
  onClose: () => void;
  presetCertificate?: MaintenanceCertificate;
}

const CRITERIA = [
  {
    id: 'structural',
    label: 'Structural Integrity',
    description: 'Checks for any physical damage or wear that could compromise safety.',
  },
  {
    id: 'performance',
    label: 'Performance Testing',
    description: 'Assesses the functionality under simulated usage conditions.',
  },
  {
    id: 'standards',
    label: 'Compliance with Standards',
    description: 'Verification against relevant health and safety standards.',
  },
  {
    id: 'training',
    label: 'User Training Verification',
    description: 'Confirmation of proper training provided to equipment users.',
  },
  {
    id: 'maintenance',
    label: 'Maintenance Review',
    description: 'Review of regular maintenance and repairs conducted.',
  },
];

export function MaintenanceCertificateModal({ asset, sessions, isOpen, onClose, presetCertificate }: MaintenanceCertificateModalProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const { issueCertificate } = useOperations();
  const users = useUserStore(s => s.users);

  const [isGenerating, setIsGenerating] = useState(false);
  const [companyInfo, setCompanyInfo] = useState({
    name: 'Dewatering Construction Etc Limited',
    regNumber: 'RC-1245678',
    email: 'hr@dcel.com',
    phone: '+234 801 234 5678',
    address: 'Victoria Island, Lagos, Nigeria',
  });

  // Core cert fields
  const [certNumber, setCertNumber] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [approverName, setApproverName] = useState('');
  const [approverDesignation, setApproverDesignation] = useState('Operations Director');
  const [expiryDate, setExpiryDate] = useState('');
  const [complianceStandards, setComplianceStandards] = useState('ISO 9001 / OSHA 1910');
  const [conditions, setConditions] = useState('Subject to routine daily checks and standard operating load limits.');

  // New H&S form fields
  const [manufacturer, setManufacturer] = useState('');
  const [modelNumber, setModelNumber] = useState('');
  const [outcomeRemarks, setOutcomeRemarks] = useState('Fully Compliant');
  const [lastInspectionDateOverride, setLastInspectionDateOverride] = useState('');
  const [issuedDateOverride, setIssuedDateOverride] = useState('');
  const [criteriaCompliance, setCriteriaCompliance] = useState<Record<string, boolean>>(
    Object.fromEntries(CRITERIA.map(c => [c.id, true]))
  );

  useEffect(() => {
    if (isOpen) {
      if (presetCertificate) {
        setCertNumber(presetCertificate.certNumber);
        setIssuedDateOverride(presetCertificate.issuedDateOverride || (presetCertificate.issuedDate ? new Date(presetCertificate.issuedDate).toISOString().split('T')[0] : ''));
        setExpiryDate(presetCertificate.expiryDate ? new Date(presetCertificate.expiryDate).toISOString().split('T')[0] : '');
        setSelectedUserId(presetCertificate.issuedByEmployeeId || '');
        setApproverName(presetCertificate.issuedByName || '');
        setApproverDesignation(presetCertificate.issuedByDesignation || 'Operations Director');
        setComplianceStandards(presetCertificate.complianceStandards || '');
        setConditions(presetCertificate.conditionsOfOperation || '');
        setManufacturer(presetCertificate.manufacturer || '');
        setModelNumber(presetCertificate.modelNumber || '');
        setOutcomeRemarks(presetCertificate.outcomeRemarks || 'Fully Compliant');
        setLastInspectionDateOverride(presetCertificate.lastInspectionDateOverride || '');
        if (presetCertificate.criteriaCompliance) {
          setCriteriaCompliance(presetCertificate.criteriaCompliance);
        }
      } else {
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randStr = Math.random().toString(36).substring(2, 6).toUpperCase();
        setCertNumber(`CERT-${dateStr}-${randStr}`);
        const exp = new Date();
        exp.setMonth(exp.getMonth() + 6);
        setExpiryDate(exp.toISOString().split('T')[0]);
        setIssuedDateOverride(new Date().toISOString().split('T')[0]);
        // Seed inspection date from asset, user can override
        if (asset.lastServiceDate) {
          setLastInspectionDateOverride(new Date(asset.lastServiceDate).toISOString().split('T')[0]);
        }
        if (users.length > 0) {
          const adminUser = users.find(u => u.role?.toLowerCase().includes('admin') || u.role?.toLowerCase().includes('director'));
          const defaultUser = adminUser || users[0];
          setSelectedUserId(defaultUser.id);
          setApproverName(defaultUser.name);
          setApproverDesignation(defaultUser.role || 'Operations Lead');
        }
      }
    }
  }, [isOpen, users, presetCertificate]);

  useEffect(() => {
    if (isOpen) {
      (async () => {
        try {
          const { data, error } = await supabase
            .from('app_settings')
            .select('company_name, company_reg_number, company_email, company_phone, company_address')
            .limit(1)
            .single();
          if (!error && data) {
            setCompanyInfo({
              name: data.company_name || 'Dewatering Construction Etc Limited',
              regNumber: data.company_reg_number || 'RC-1245678',
              email: data.company_email || 'hr@dcel.com',
              phone: data.company_phone || '+234 801 234 5678',
              address: data.company_address || 'Victoria Island, Lagos, Nigeria',
            });
          }
        } catch (err) {
          console.error('Failed to load company settings:', err);
        }
      })();
    }
  }, [isOpen]);

  const handleApproverChange = (userId: string) => {
    setSelectedUserId(userId);
    const u = users.find(x => x.id === userId);
    if (u) {
      setApproverName(u.name);
      setApproverDesignation(u.role || 'Authorized Signatory');
    }
  };

  const toggleCriteria = (id: string) => {
    setCriteriaCompliance(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const allCompliant = Object.values(criteriaCompliance).every(Boolean);
  const logs = sessions.map(s => s.assets.find(a => a.assetId === asset.id)).filter(Boolean);

  const handleIssueAndDownload = async () => {
    if (!printRef.current) return;
    if (!approverName) { toast.error('Please select or specify an authorized approver'); return; }
    if (!expiryDate) { toast.error('Please select certificate expiry date'); return; }

    setIsGenerating(true);
    toast.loading('Issuing certificate & generating PDF...');

    try {
      const certificateMetadata: Omit<MaintenanceCertificate, 'id'> = {
        certNumber,
        machineId: asset.id,
        machineName: asset.name,
        machineCategory: asset.category,
        machineSite: asset.site,
        machineSerial: asset.serialNumber,
        issuedDate: issuedDateOverride ? new Date(issuedDateOverride).toISOString() : new Date().toISOString(),
        issuedDateOverride,
        expiryDate: new Date(expiryDate).toISOString(),
        issuedByEmployeeId: selectedUserId,
        issuedByName: approverName,
        issuedByDesignation: approverDesignation,
        lastServiceDate: asset.lastServiceDate || undefined,
        nextServiceDate: asset.nextServiceDate || undefined,
        totalServices: logs.length,
        complianceStandards,
        conditionsOfOperation: conditions,
        manufacturer,
        modelNumber,
        outcomeRemarks,
        lastInspectionDateOverride,
        criteriaCompliance,
      };

      if (!presetCertificate) {
        await issueCertificate(certificateMetadata);
      }

      const element = printRef.current;
      const canvas = await html2canvas(element, {
        scale: 2.5,          // high DPI needed for PDF print quality
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: (clonedDoc) => sanitizeCloneForHtml2Canvas(clonedDoc),
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= 297;
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= 297;
      }

      const fileName = `Eq_Cert_${asset.name.replace(/\s+/g, '_')}_${certNumber}.pdf`;
      pdf.save(fileName);
      toast.dismiss();
      toast.success('Equipment Certificate issued and downloaded successfully');
      onClose();
    } catch (error) {
      console.error('Failed to issue certificate:', error);
      toast.dismiss();
      toast.error('Failed to generate certificate PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = async () => {
    if (!printRef.current) return;
    setIsGenerating(true);
    toast.loading('Preparing print view...');
    try {
      const canvas = await html2canvas(printRef.current, {
        scale: 1.8,          // browser print dialog doesn't need PDF-grade density
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: (clonedDoc) => sanitizeCloneForHtml2Canvas(clonedDoc),
      });
      const imgData = canvas.toDataURL('image/png');
      const printWindow = window.open('', '_blank', 'width=950,height=750');
      if (!printWindow) {
        toast.dismiss();
        toast.error('Pop-up blocked — please allow pop-ups and try again');
        return;
      }
      printWindow.document.write(`
        <!DOCTYPE html><html><head>
          <title>Equipment Certificate — ${asset.name}</title>
          <style>
            @page { size: A4 portrait; margin: 0; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { background: #fff; }
            img { width: 210mm; max-width: 100%; display: block; }
            @media print {
              body { background: #fff; }
              img { width: 210mm; }
            }
          </style>
        </head><body>
          <img src="${imgData}" />
          <script>
            window.onload = function() {
              setTimeout(function() { window.focus(); window.print(); }, 300);
            };
          <\/script>
        </body></html>
      `);
      printWindow.document.close();
      toast.dismiss();
      toast.success('Print dialog opened');
    } catch (err) {
      console.error('Print error:', err);
      toast.dismiss();
      toast.error('Failed to prepare print view');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;


  const formattedExpiry = expiryDate
    ? new Date(expiryDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : 'N/A';
  const formattedIssue = issuedDateOverride
    ? new Date(issuedDateOverride).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const formattedLastService = lastInspectionDateOverride
    ? new Date(lastInspectionDateOverride).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : asset.lastServiceDate
      ? new Date(asset.lastServiceDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : 'N/A';

  return (
    <div className="fixed inset-0 z-[200] flex bg-black/70 backdrop-blur-sm">

      {/* ── LEFT CONFIG PANEL ─────────────────────────────────────────── */}
      <div className="w-[320px] shrink-0 h-full bg-[#0d1117] border-r border-white/5 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between shrink-0">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
              <ClipboardList className="h-3.5 w-3.5 text-amber-500" /> Equipment Cert Config
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[200px]">{asset.name}</p>
          </div>
          <button
            onClick={onClose}
            className="h-7 w-7 rounded-md bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>

        {/* Scrollable form */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Equipment Details */}
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-500/80">Equipment Details</p>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Manufacturer</Label>
              <Input value={manufacturer} onChange={e => setManufacturer(e.target.value)}
                placeholder="e.g. Clasal Pump Technology"
                className="h-9 text-xs rounded-lg border-white/10 bg-white/5 text-white" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Model Number</Label>
              <Input value={modelNumber} onChange={e => setModelNumber(e.target.value)}
                placeholder="e.g. ZD900"
                className="h-9 text-xs rounded-lg border-white/10 bg-white/5 text-white" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Last Inspection Date</Label>
              <Input
                type="date"
                value={lastInspectionDateOverride}
                onChange={e => setLastInspectionDateOverride(e.target.value)}
                className="h-9 text-xs rounded-lg border-white/10 bg-white/5 text-white"
              />
              <p className="text-[10px] text-slate-500">Pre-filled from last service date — editable</p>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-white/5" />

          {/* Certification Fields */}
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-500/80">Certification</p>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Authorized Approver</Label>
              {users.length > 0 ? (
                <select value={selectedUserId} onChange={e => handleApproverChange(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-white/10 bg-white/5 text-xs font-medium focus:border-amber-500/50 outline-none text-white cursor-pointer">
                  <option value="" disabled>Select Approver...</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role || 'No Role'})</option>)}
                </select>
              ) : (
                <Input value={approverName} onChange={e => setApproverName(e.target.value)}
                  placeholder="Enter Approver Name"
                  className="h-9 text-xs rounded-lg border-white/10 bg-white/5 text-white" />
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Designation</Label>
              <Input value={approverDesignation} onChange={e => setApproverDesignation(e.target.value)}
                className="h-9 text-xs rounded-lg border-white/10 bg-white/5 text-white" />
            </div>

            <div className="flex gap-3 w-full">
              <div className="space-y-1.5 flex-1">
                <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Date of Issue</Label>
                <Input type="date" value={issuedDateOverride} onChange={e => setIssuedDateOverride(e.target.value)}
                  className="h-9 w-full text-xs rounded-lg border-white/10 bg-white/5 text-white" />
              </div>
              <div className="space-y-1.5 flex-1">
                <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Expiry Date</Label>
                <Input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)}
                  className="h-9 w-full text-xs rounded-lg border-white/10 bg-white/5 text-white" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Compliance Standards</Label>
              <Input value={complianceStandards} onChange={e => setComplianceStandards(e.target.value)}
                placeholder="e.g. ISO 9001 / OSHA 1910"
                className="h-9 text-xs rounded-lg border-white/10 bg-white/5 text-white" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Outcome Remarks</Label>
              <Input value={outcomeRemarks} onChange={e => setOutcomeRemarks(e.target.value)}
                placeholder="e.g. Fully Compliant"
                className="h-9 text-xs rounded-lg border-white/10 bg-white/5 text-white" />
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-white/5" />

          {/* Criteria Compliance Toggles */}
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-500/80">Criteria Compliance</p>
            <div className="space-y-2.5">
              {CRITERIA.map(c => (
                <button key={c.id} onClick={() => toggleCriteria(c.id)}
                  className="flex items-center justify-between w-full text-left gap-3 group">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-slate-300 group-hover:text-white transition-colors truncate">{c.label}</p>
                  </div>
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black shrink-0 transition-all ${criteriaCompliance[c.id] ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                    {criteriaCompliance[c.id] ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    {criteriaCompliance[c.id] ? 'YES' : 'NO'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Operating Conditions */}
          <div className="border-t border-white/5 pt-4 space-y-1.5">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Operating Conditions</Label>
            <textarea value={conditions} onChange={e => setConditions(e.target.value)} rows={3}
              className="w-full p-2.5 rounded-lg border border-white/10 bg-white/5 text-xs font-medium focus:border-amber-500/50 outline-none text-white leading-relaxed resize-none" />
          </div>
        </div>

        {/* Issue / Print buttons */}
        <div className="p-4 border-t border-white/5 shrink-0 space-y-2">
          <Button disabled={isGenerating} onClick={handleIssueAndDownload}
            className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs py-2.5 rounded-xl gap-2 transition-all shadow-lg shadow-amber-900/30">
            <Download className="h-4 w-4" />
            {isGenerating ? 'Generating...' : 'Issue & Download PDF'}
          </Button>
          <Button disabled={isGenerating} onClick={handlePrint} variant="outline"
            className="w-full border-white/10 bg-white/5 hover:bg-white/10 text-white font-bold text-xs py-2.5 rounded-xl gap-2 transition-all">
            <Printer className="h-4 w-4" />
            Print Certificate
          </Button>
          <p className="text-[10px] text-slate-500 text-center pt-1">PDF saved to Certificates tab automatically</p>
        </div>
      </div>

      {/* ── RIGHT PREVIEW PANEL ───────────────────────────────────────── */}
      <div className="flex-1 h-full bg-[#070b0f] overflow-y-auto flex flex-col items-center py-8 px-6 gap-6">

        {/* Top bar */}
        <div className="w-full max-w-[780px] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-amber-600/10 border border-amber-600/20 flex items-center justify-center">
              <ShieldCheck className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Equipment Certification Form</p>
              <p className="text-[10px] text-slate-500">Portrait A4 · Print-ready · Official format</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono bg-white/5 border border-white/5 rounded-lg px-3 py-1.5">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            {certNumber}
          </div>
        </div>

        {/* ── CERTIFICATE / FORM SHEET ── */}
        <div className="overflow-x-auto w-full flex justify-center pb-10">
          <div className="shadow-2xl">
            <div
              ref={printRef}
              className="bg-white relative"
              style={{ width: '210mm', minHeight: '297mm', fontFamily: "'Arial', sans-serif" }}
            >
            {/* Navy border frame */}
            <div className="absolute inset-0 border-[10px] border-[#0a1628] pointer-events-none" style={{ zIndex: 10 }} />
            {/* Gold inner line */}
            <div className="absolute inset-[14px] border-[1.5px] border-[#c9a84c] pointer-events-none" style={{ zIndex: 10 }} />
            {/* Thin inner navy line */}
            <div className="absolute inset-[19px] border border-[#0a1628]/20 pointer-events-none" style={{ zIndex: 10 }} />

            {/* Logo-2 faded watermark */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none" style={{ zIndex: 1 }}>
              <img src={logo2} alt="" className="w-[60%] object-contain" style={{ opacity: 0.08 }} />
            </div>

            {/* Content */}
            <div className="absolute inset-[24px] flex flex-col gap-0" style={{ zIndex: 5 }}>

              {/* ── HEADER ── */}
              <div className="flex items-center justify-between pb-3 border-b-2 border-[#0a1628]">
                <img src={logo2} alt="DCEL Logo" className="h-16 object-contain"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                <div className="text-center flex-1 px-4">
                  <h1 className="text-[15px] font-black text-[#0a1628] uppercase tracking-wide leading-tight">
                    {companyInfo.name}
                  </h1>
                  <p className="text-[8.5px] text-[#6b7280] font-bold uppercase tracking-widest mt-0.5">
                    RC No: {companyInfo.regNumber} &nbsp;·&nbsp; {companyInfo.address}
                  </p>
                  <div className="h-[2px] bg-gradient-to-r from-transparent via-[#c9a84c] to-transparent my-1.5" />
                  <h2 className="text-[13px] font-black text-[#0a1628] uppercase tracking-[0.12em]">
                    Equipment Certification Form
                  </h2>
                  <p className="text-[8px] text-[#6b7280] mt-0.5"
                    style={{ fontFamily: "'Georgia', serif", fontStyle: 'italic' }}>
                    An official document for maintaining compliance with equipment operational and safety regulations
                  </p>
                </div>
                <div className="text-right text-[8px] text-[#6b7280] space-y-0.5 min-w-[100px]">
                  <p className="font-bold text-[#0a1628] text-[9px]">Cert Reference</p>
                  <p className="font-mono font-bold text-[#0a1628] bg-[#f8f5e4] border border-[#c9a84c]/50 px-2 py-0.5 rounded">{certNumber}</p>
                  <p className="mt-1">Date Issued:</p>
                  <p className="font-bold text-[#0a1628]">{formattedIssue}</p>
                </div>
              </div>

              {/* ── SECTION 1: EQUIPMENT DETAILS ── */}
              <div className="mt-3">
                <SectionTitle>1. Equipment Details</SectionTitle>
                <table className="w-full border-collapse text-[8.5px] mt-1.5">
                  <thead>
                    <tr className="bg-[#0a1628] text-white">
                      <Th>Equipment Type</Th>
                      <Th>Manufacturer</Th>
                      <Th>Model No.</Th>
                      <Th>Last Inspection Date</Th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-white">
                      <Td bold>{asset.name}</Td>
                      <Td>{manufacturer || '—'}</Td>
                      <Td>{modelNumber || '—'}</Td>
                      <Td>{formattedLastService}</Td>
                    </tr>
                    {asset.serialNumber && (
                      <tr className="bg-[#f9fafb]">
                        <Td className="text-[#6b7280]">Serial / Registration</Td>
                        <Td bold colSpan={2}>{asset.serialNumber}</Td>
                        <Td className="text-[#6b7280]">Site: <span className="font-bold text-[#0a1628]">{asset.site}</span></Td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* ── SECTION 2: CERTIFICATION CRITERIA ── */}
              <div className="mt-3">
                <SectionTitle>2. Certification Criteria</SectionTitle>
                <table className="w-full border-collapse text-[8.5px] mt-1.5">
                  <thead>
                    <tr className="bg-[#0a1628] text-white">
                      <Th className="w-[32%]">Criteria</Th>
                      <Th>Description</Th>
                      <Th className="w-[14%] text-center">Compliance</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {CRITERIA.map((c, i) => (
                      <tr key={c.id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#f9fafb]'}>
                        <td className="border border-[#e5e7eb] px-2.5 py-2 font-bold text-[#0a1628]">{c.label}</td>
                        <td className="border border-[#e5e7eb] px-2.5 py-2 text-[#374151] leading-relaxed">{c.description}</td>
                        <td className="border border-[#e5e7eb] px-2.5 py-2 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-black text-[8px] uppercase ${criteriaCompliance[c.id] ? 'bg-[#d1fae5] text-[#065f46]' : 'bg-[#fee2e2] text-[#991b1b]'}`}>
                            {criteriaCompliance[c.id] ? '✓ Yes' : '✗ No'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── SECTION 3: CERTIFICATION OUTCOME ── */}
              <div className="mt-3">
                <SectionTitle>3. Certification Outcome</SectionTitle>
                <table className="w-full border-collapse text-[8.5px] mt-1.5">
                  <thead>
                    <tr className="bg-[#0a1628] text-white">
                      <Th>Equipment Type</Th>
                      <Th className="text-center">Certification Status</Th>
                      <Th className="text-center">Certified Until</Th>
                      <Th>Remarks (If any)</Th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-white">
                      <td className="border border-[#e5e7eb] px-2.5 py-2.5 font-bold text-[#0a1628]">
                        {asset.name}{modelNumber ? ` ${modelNumber}` : ''}
                      </td>
                      <td className="border border-[#e5e7eb] px-2.5 py-2.5 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded font-black text-[8.5px] uppercase tracking-wide ${allCompliant ? 'bg-[#d1fae5] text-[#065f46] border border-[#6ee7b7]' : 'bg-[#fee2e2] text-[#991b1b] border border-[#fca5a5]'}`}>
                          {allCompliant ? '✓ Certified' : '✗ Not Certified'}
                        </span>
                      </td>
                      <td className="border border-[#e5e7eb] px-2.5 py-2.5 text-center font-bold text-[#0a1628]">
                        {formattedExpiry}
                      </td>
                      <td className="border border-[#e5e7eb] px-2.5 py-2.5 text-[#374151]">
                        {outcomeRemarks || '—'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ── SECTION 4: DECLARATION ── */}
              <div className="mt-3">
                <SectionTitle>4. Declaration</SectionTitle>
                <div className="mt-1.5 bg-[#f9fafb] border border-[#e5e7eb] rounded p-3 text-[8.5px] text-[#374151] leading-relaxed"
                  style={{ fontFamily: "'Georgia', serif", fontStyle: 'italic' }}>
                  I hereby certify that the above-mentioned equipment has been inspected according to the company's operational
                  standards and procedures. The information provided in this form is accurate to the best of my knowledge and belief.
                  {conditions && (
                    <p className="mt-1.5 not-italic" style={{ fontStyle: 'normal' }}>
                      <span className="font-bold not-italic text-[#0a1628]">Operating Conditions:</span> {conditions}
                    </p>
                  )}
                  {complianceStandards && (
                    <p className="mt-1 not-italic" style={{ fontStyle: 'normal' }}>
                      <span className="font-bold not-italic text-[#0a1628]">Standards Referenced:</span> {complianceStandards}
                    </p>
                  )}
                </div>
              </div>

              {/* ── FOOTER: SIGNATURE + SEAL + CERT BOX ── */}
              <div className="mt-auto pt-4 border-t-2 border-[#0a1628] flex items-end justify-between gap-4">

                {/* Signature block */}
                <div className="flex-1">
                  <div className="h-10 border-b-2 border-[#0a1628]/40 mb-1.5" />
                  <p className="text-[9px] font-black text-[#0a1628] uppercase tracking-wide">{approverName || '____________________________'}</p>
                  <p className="text-[8px] text-[#6b7280] uppercase tracking-widest mt-0.5">{approverDesignation}</p>
                  <p className="text-[7.5px] text-[#9ca3af] mt-0.5">Authorized Certification Officer</p>
                </div>

                {/* Official Seal */}
                <div className="flex flex-col items-center shrink-0" style={{ marginBottom: '-2px' }}>
                  <div className="relative h-[68px] w-[68px] rounded-full border-[3px] border-[#c9a84c] flex items-center justify-center bg-white">
                    <div className="absolute inset-[5px] rounded-full border border-[#c9a84c]/60 flex items-center justify-center bg-[#fefdf8]">
                      <div className="text-center">
                        <ShieldCheck className="h-6 w-6 text-[#0a1628] mx-auto" strokeWidth={1.5} />
                        <p className="text-[5px] font-black text-[#0a1628] uppercase tracking-[0.12em] mt-0.5 leading-none">DCEL</p>
                      </div>
                    </div>
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[5.5px] font-black uppercase tracking-[0.18em] text-[#c9a84c]">
                      ✦ OFFICIAL SEAL ✦
                    </div>
                  </div>
                  <div className="flex gap-1 -mt-1">
                    <div className="w-3 h-5 bg-[#c9a84c]" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 70%, 50% 100%, 0 70%)' }} />
                    <div className="w-3 h-5 bg-[#c9a84c]" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 70%, 50% 100%, 0 70%)' }} />
                  </div>
                </div>

                {/* Cert number + date block */}
                <div className="flex-1 text-right">
                  <div className="inline-block bg-[#0a1628] text-white px-3 py-2 rounded mb-1">
                    <p className="text-[7px] font-bold uppercase tracking-widest text-[#c9a84c]">Certificate No.</p>
                    <p className="text-[9px] font-black tracking-wider font-mono">{certNumber}</p>
                  </div>
                  <p className="text-[7.5px] text-[#6b7280] font-semibold">{companyInfo.email}</p>
                  <p className="text-[7.5px] text-[#9ca3af]">{companyInfo.phone}</p>
                  <p className="text-[7px] text-[#9ca3af] mt-0.5">Verified ✓ &nbsp;|&nbsp; Valid until: {formattedExpiry}</p>
                </div>
              </div>

            </div>{/* end content */}
          </div>{/* end printRef */}
          </div>{/* shadow wrapper */}
        </div>
      </div>
    </div>
  );
}

// ── Small helper components ──────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-[1.5px] bg-[#0a1628]/15" />
      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#0a1628] px-1 shrink-0">{children}</p>
      <div className="flex-1 h-[1.5px] bg-[#c9a84c]" />
    </div>
  );
}

function Th({ children, className = '', ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={`border border-[#1e3a5f] px-2.5 py-2 text-left font-bold uppercase tracking-wide text-[8px] ${className}`} {...props}>
      {children}
    </th>
  );
}

function Td({ children, className = '', bold = false, colSpan, ...props }: React.TdHTMLAttributes<HTMLTableCellElement> & { bold?: boolean }) {
  return (
    <td
      colSpan={colSpan}
      className={`border border-[#e5e7eb] px-2.5 py-2 ${bold ? 'font-bold text-[#0a1628]' : 'text-[#374151]'} ${className}`}
      {...props}
    >
      {children}
    </td>
  );
}
