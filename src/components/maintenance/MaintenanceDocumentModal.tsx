import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Download, Eye, FileText, Check, Settings, 
  Wrench, DollarSign, Calendar, Clock, AlertTriangle, ShieldCheck
} from 'lucide-react';
import { MaintenanceAsset, MaintenanceSession } from '../../types/operations';
import { supabase } from '@/src/integrations/supabase/client';
import { formatDisplayDate } from '@/src/lib/dateUtils';
import { Button } from '@/src/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/src/components/ui/dialog';
import { toast } from 'sonner';

interface MaintenanceDocumentModalProps {
  asset: MaintenanceAsset;
  sessions: MaintenanceSession[];
  isOpen: boolean;
  onClose: () => void;
}

interface SectionToggle {
  id: string;
  label: string;
  enabled: boolean;
}

export function MaintenanceDocumentModal({ asset, sessions, isOpen, onClose }: MaintenanceDocumentModalProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [companyInfo, setCompanyInfo] = useState({
    name: 'Dewatering Construction Etc Limited',
    regNumber: 'RC-1245678',
    email: 'hr@dcel.com',
    phone: '+234 801 234 5678',
    address: 'Victoria Island, Lagos, Nigeria',
  });

  const [sections, setSections] = useState<SectionToggle[]>([
    { id: 'header', label: 'Company Header', enabled: true },
    { id: 'identity', label: 'Machine Identity', enabled: true },
    { id: 'schedule', label: 'Service Schedule', enabled: true },
    { id: 'stats', label: 'Cost & Downtime Summary', enabled: true },
    { id: 'history', label: 'Service History Table', enabled: true },
    { id: 'parts', label: 'Parts Replaced Log', enabled: true },
    { id: 'remarks', label: 'Notes & Remarks', enabled: true },
    { id: 'signatures', label: 'Signature Block', enabled: true },
  ]);

  // Fetch company settings from Supabase
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

  const toggleSection = (id: string) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  };

  const isEnabled = (id: string) => sections.find(s => s.id === id)?.enabled ?? false;

  // Process data for the asset
  const logs = sessions.map(s => {
    const assetLog = s.assets.find(a => a.assetId === asset.id);
    return { 
      ...assetLog!, 
      date: s.date, 
      technician: s.technician, 
      type: s.type,
      generalRemark: s.generalRemark
    };
  }).filter(l => !!l.assetId);

  const totalCost = logs.reduce((acc, log) => acc + (Number(log.cost) || 0), 0);
  const avgCost = logs.length > 0 ? totalCost / logs.length : 0;
  const partsList = logs.flatMap(log => (log.parts || []).map(p => ({
    ...p,
    date: log.date,
    technician: log.technician
  })));
  const totalPartsCost = partsList.reduce((acc, part) => acc + (Number(part.cost) * (part.quantity || 1)), 0);
  const totalShutdowns = logs.filter(log => log.shutdown).length;

  const handleGeneratePdf = async () => {
    if (!printRef.current) return;
    setIsGenerating(true);
    toast.info('Generating report PDF...');

    try {
      // Create PDF
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      const element = printRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210; // A4 size width
      const pageHeight = 297; // A4 size height
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const fileName = `${asset.name.replace(/\s+/g, '_')}_Maintenance_Report.pdf`;
      pdf.save(fileName);
      toast.success('Report downloaded successfully');
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      toast.error('Failed to generate report PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl h-[92vh] flex flex-col p-0 overflow-hidden bg-slate-900 border-slate-800 rounded-2xl text-slate-100">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900 shrink-0">
          <div>
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-500" />
              Maintenance Document Builder
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400 mt-0.5">
              Configure and export a service history report for <strong>{asset.name}</strong>.
            </DialogDescription>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Section Config Pills */}
        <div className="px-6 py-4 bg-slate-800/40 border-b border-slate-800/80 shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
            <Settings className="h-3 w-3" /> Toggle Report Sections
          </p>
          <div className="flex flex-wrap gap-2">
            {sections.map(s => (
              <button
                key={s.id}
                onClick={() => toggleSection(s.id)}
                className={`h-8 px-3 rounded-full text-xs font-semibold flex items-center gap-1.5 border transition-all duration-200 cursor-pointer ${
                  s.enabled 
                    ? 'bg-blue-600/10 border-blue-500/30 text-blue-400 shadow-sm shadow-blue-500/5 hover:bg-blue-600/20' 
                    : 'bg-slate-800/50 border-slate-700/80 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <div className={`h-1.5 w-1.5 rounded-full ${s.enabled ? 'bg-blue-400 animate-pulse' : 'bg-slate-500'}`} />
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Workspace Layout - Stacked view with scrollable container */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-950 flex flex-col items-center gap-6">
          
          {/* Export Action Card */}
          <div className="w-[210mm] max-w-full bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between shadow-sm shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400">
                <Eye className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-200">Print Preview Mode</p>
                <p className="text-[10px] text-slate-400">Review layout below. The output will be formatted into A4 pages.</p>
              </div>
            </div>
            <Button
              disabled={isGenerating}
              onClick={handleGeneratePdf}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2 rounded-lg gap-2"
            >
              <Download className="h-4 w-4" />
              {isGenerating ? 'Generating PDF...' : 'Download PDF Report'}
            </Button>
          </div>

          {/* Printable Page Sheet */}
          <div className="overflow-x-auto w-full flex justify-center pb-12">
            <div 
              ref={printRef}
              id="report-preview-container"
              className="w-[210mm] min-h-[297mm] bg-white text-slate-800 p-12 shadow-2xl rounded-sm font-serif relative shrink-0 border border-slate-200"
              style={{ contentVisibility: 'auto' }}
            >
              {/* Company Header */}
              {isEnabled('header') && (
                <div className="flex justify-between items-start border-b-2 border-slate-900 pb-5 mb-6 font-sans">
                  <div>
                    <h1 className="text-xl font-black text-slate-900 tracking-tight">{companyInfo.name}</h1>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Registration No: {companyInfo.regNumber}</p>
                    <p className="text-xs text-slate-600 mt-2 max-w-sm leading-relaxed">{companyInfo.address}</p>
                  </div>
                  <div className="text-right text-xs text-slate-600 space-y-0.5">
                    <p className="font-bold text-slate-800">Operational Services</p>
                    <p>Phone: {companyInfo.phone}</p>
                    <p>Email: {companyInfo.email}</p>
                    <p>Date Generated: {new Date().toLocaleDateString()}</p>
                  </div>
                </div>
              )}

              {/* Document Title */}
              <div className="text-center mb-8">
                <h2 className="text-2xl font-black text-slate-900 tracking-wide uppercase border-b border-slate-200 pb-2">
                  Machine Maintenance & Service Report
                </h2>
                <p className="text-xs font-mono text-slate-500 mt-1">Report Ref: DCEL-MR-{asset.id.substring(0, 8).toUpperCase()}</p>
              </div>

              {/* Asset Identity Details */}
              {isEnabled('identity') && (
                <div className="mb-6 font-sans">
                  <h3 className="text-sm font-bold bg-slate-100 text-slate-800 px-3 py-1.5 rounded uppercase tracking-wider mb-3">
                    I. Asset Description
                  </h3>
                  <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm px-3">
                    <div className="flex border-b border-slate-100 pb-1.5">
                      <span className="w-32 text-slate-400 font-medium">Asset Name:</span>
                      <span className="font-bold text-slate-800">{asset.name}</span>
                    </div>
                    <div className="flex border-b border-slate-100 pb-1.5">
                      <span className="w-32 text-slate-400 font-medium">Serial / Registration:</span>
                      <span className="font-bold text-slate-800">{asset.serialNumber || 'N/A'}</span>
                    </div>
                    <div className="flex border-b border-slate-100 pb-1.5">
                      <span className="w-32 text-slate-400 font-medium">Category:</span>
                      <span className="font-bold text-slate-800 capitalize">{asset.category}</span>
                    </div>
                    <div className="flex border-b border-slate-100 pb-1.5">
                      <span className="w-32 text-slate-400 font-medium">Current Site:</span>
                      <span className="font-bold text-slate-800">{asset.site}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Service Schedule */}
              {isEnabled('schedule') && (
                <div className="mb-6 font-sans">
                  <h3 className="text-sm font-bold bg-slate-100 text-slate-800 px-3 py-1.5 rounded uppercase tracking-wider mb-3">
                    II. Inspection & Schedule Status
                  </h3>
                  <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm px-3">
                    <div className="flex border-b border-slate-100 pb-1.5">
                      <span className="w-32 text-slate-400 font-medium">Service Interval:</span>
                      <span className="font-bold text-slate-800">{asset.serviceIntervalMonths} Months</span>
                    </div>
                    <div className="flex border-b border-slate-100 pb-1.5">
                      <span className="w-32 text-slate-400 font-medium">Last Service Date:</span>
                      <span className="font-bold text-slate-800">{formatDisplayDate(asset.lastServiceDate) || 'No prior service recorded'}</span>
                    </div>
                    <div className="flex border-b border-slate-100 pb-1.5">
                      <span className="w-32 text-slate-400 font-medium">Next Due Date:</span>
                      <span className="font-bold text-slate-800">{formatDisplayDate(asset.nextServiceDate)}</span>
                    </div>
                    <div className="flex border-b border-slate-100 pb-1.5">
                      <span className="w-32 text-slate-400 font-medium">Service Status:</span>
                      <span className={`font-bold capitalize ${
                        asset.status === 'ok' ? 'text-emerald-600' : asset.status === 'due_soon' ? 'text-amber-500' : 'text-rose-600'
                      }`}>{asset.status.replace('_', ' ')}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Summary Statistics */}
              {isEnabled('stats') && (
                <div className="mb-6 font-sans">
                  <h3 className="text-sm font-bold bg-slate-100 text-slate-800 px-3 py-1.5 rounded uppercase tracking-wider mb-3">
                    III. Cost & Downtime Metrics
                  </h3>
                  <div className="grid grid-cols-3 gap-4 px-1">
                    <div className="p-3 border border-slate-200 rounded text-center">
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Services</p>
                      <p className="text-xl font-black text-slate-800 mt-1">{logs.length}</p>
                    </div>
                    <div className="p-3 border border-slate-200 rounded text-center">
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Servicing Cost</p>
                      <p className="text-xl font-black text-slate-800 mt-1">₦{totalCost.toLocaleString()}</p>
                    </div>
                    <div className="p-3 border border-slate-200 rounded text-center">
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Critical Shutdowns</p>
                      <p className="text-xl font-black text-slate-800 mt-1">{totalShutdowns}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Service Logs Table */}
              {isEnabled('history') && (
                <div className="mb-6 font-sans">
                  <h3 className="text-sm font-bold bg-slate-100 text-slate-800 px-3 py-1.5 rounded uppercase tracking-wider mb-3">
                    IV. Detailed Servicing Records
                  </h3>
                  {logs.length === 0 ? (
                    <p className="text-xs text-slate-500 italic px-3">No maintenance sessions logged for this asset.</p>
                  ) : (
                    <div className="border border-slate-200 rounded overflow-hidden">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase">
                            <th className="px-3 py-2 border-r border-slate-200 w-24">Date</th>
                            <th className="px-3 py-2 border-r border-slate-200 w-20">Type</th>
                            <th className="px-3 py-2 border-r border-slate-200 w-28">Technician</th>
                            <th className="px-3 py-2 border-r border-slate-200">Work Done & Remarks</th>
                            <th className="px-3 py-2 w-20 text-right">Cost</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {logs.map((log, i) => (
                            <tr key={i} className="align-top">
                              <td className="px-3 py-2.5 border-r border-slate-200 font-medium whitespace-nowrap">
                                {formatDisplayDate(log.date)}
                              </td>
                              <td className="px-3 py-2.5 border-r border-slate-200 capitalize font-semibold text-slate-700">
                                {log.type}
                              </td>
                              <td className="px-3 py-2.5 border-r border-slate-200 text-slate-700 font-medium">
                                {log.technician}
                              </td>
                              <td className="px-3 py-2.5 border-r border-slate-200 text-slate-600 leading-relaxed">
                                <p className="font-semibold text-slate-800">{log.workDone || 'General maintenance'}</p>
                                {log.remark && <p className="text-[11px] text-slate-500 mt-0.5">Asset Remark: {log.remark}</p>}
                                {log.generalRemark && <p className="text-[11px] text-slate-400 mt-0.5 italic">Session Note: {log.generalRemark}</p>}
                                {log.shutdown && (
                                  <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 bg-rose-50 text-rose-700 font-bold text-[9px] border border-rose-100 rounded">
                                    <Clock className="h-2.5 w-2.5" /> Caused Machine Shutdown
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-right font-semibold text-slate-800">
                                ₦{(Number(log.cost) || 0).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Parts Replaced History */}
              {isEnabled('parts') && (
                <div className="mb-6 font-sans">
                  <h3 className="text-sm font-bold bg-slate-100 text-slate-800 px-3 py-1.5 rounded uppercase tracking-wider mb-3">
                    V. Parts & Consumables Replaced
                  </h3>
                  {partsList.length === 0 ? (
                    <p className="text-xs text-slate-500 italic px-3">No parts replacements logged.</p>
                  ) : (
                    <div className="border border-slate-200 rounded overflow-hidden">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase">
                            <th className="px-3 py-2 border-r border-slate-200 w-24">Date</th>
                            <th className="px-3 py-2 border-r border-slate-200">Part Description</th>
                            <th className="px-3 py-2 border-r border-slate-200 w-16 text-center">Qty</th>
                            <th className="px-3 py-2 border-r border-slate-200 w-24 text-right">Unit Price</th>
                            <th className="px-3 py-2 w-24 text-right">Total Price</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {partsList.map((part, i) => (
                            <tr key={i}>
                              <td className="px-3 py-2 border-r border-slate-200 text-slate-500">{formatDisplayDate(part.date)}</td>
                              <td className="px-3 py-2 border-r border-slate-200 font-semibold text-slate-700">{part.name}</td>
                              <td className="px-3 py-2 border-r border-slate-200 text-center font-medium">{part.quantity}</td>
                              <td className="px-3 py-2 border-r border-slate-200 text-right">₦{(Number(part.cost) || 0).toLocaleString()}</td>
                              <td className="px-3 py-2 text-right font-bold text-slate-800">
                                ₦{((Number(part.cost) || 0) * (part.quantity || 1)).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-slate-50 font-bold border-t border-slate-200">
                            <td colSpan={4} className="px-3 py-2 text-right border-r border-slate-200 text-slate-600">Total Parts Expenses:</td>
                            <td className="px-3 py-2 text-right text-slate-900">₦{totalPartsCost.toLocaleString()}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* General Remarks / Notes */}
              {isEnabled('remarks') && (
                <div className="mb-10 font-sans">
                  <h3 className="text-sm font-bold bg-slate-100 text-slate-800 px-3 py-1.5 rounded uppercase tracking-wider mb-3">
                    VI. Engineering Remarks & Notes
                  </h3>
                  <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600 leading-relaxed min-h-[60px]">
                    <p className="font-semibold text-slate-800">Overall Asset Status Summary:</p>
                    <p className="mt-1">
                      The asset <strong>{asset.name}</strong> was inspected, serviced, and found to be in{' '}
                      <span className="font-bold text-slate-800 capitalize">{asset.status === 'ok' ? 'satisfactory' : 'due'}</span> condition. 
                      All required fluids, filters, and scheduled replacement parts have been updated as detailed above. 
                      Next scheduled servicing is slated on or before <strong>{formatDisplayDate(asset.nextServiceDate)}</strong> to prevent premature failure.
                    </p>
                  </div>
                </div>
              )}

              {/* Signatures Block */}
              {isEnabled('signatures') && (
                <div className="mt-16 pt-8 border-t border-slate-200 font-sans flex justify-between">
                  <div className="w-56 text-center">
                    <div className="h-10 border-b border-slate-400" />
                    <p className="text-xs font-bold text-slate-800 mt-2">Lead Maintenance Technician</p>
                    <p className="text-[10px] text-slate-500">Date: ____ / ____ / ________</p>
                  </div>
                  <div className="w-56 text-center">
                    <div className="h-10 border-b border-slate-400" />
                    <p className="text-xs font-bold text-slate-800 mt-2">Operations / Fleet Director</p>
                    <p className="text-[10px] text-slate-500">Date: ____ / ____ / ________</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
