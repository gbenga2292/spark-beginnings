import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { useAppStore } from '../../store/appStore';
import { useUserStore } from '../../store/userStore';
import { fetchEmployeesData } from '../../lib/supabaseService';
import {
  DamageSeverity,
  DamageCauseCategory,
  DamageFaultAttribution,
  DamagePhoto,
} from '../../types/damage';
import { uploadMultipleDamagePhotos } from '../../utils/damageMediaUpload';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Camera,
  Upload,
  X,
  Loader2,
  FileText,
  UserCheck,
  ChevronDown,
} from 'lucide-react';

export interface DamagedWaybillItem {
  assetId: string;
  assetName: string;
  quantity: number;
}

export interface ReturnWaybillDamageInfo {
  waybillId: string;
  waybillRef: string;
  siteId?: string | null;
  siteName?: string;
  date: string;
  damagedItems: DamagedWaybillItem[];
}

interface ReturnDamageBatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  info: ReturnWaybillDamageInfo | null;
  onSuccess?: () => void;
}

const CAUSE_OPTIONS: { value: DamageCauseCategory; label: string }[] = [
  { value: 'operator_error', label: 'Operator / Handling Error' },
  { value: 'wear_tear', label: 'Wear & Tear / Site Demob' },
  { value: 'accident', label: 'Transit Accident / Impact' },
  { value: 'weather', label: 'Severe Weather / Site Conditions' },
  { value: 'malfunction', label: 'Mechanical / Electrical Breakdown' },
  { value: 'third_party', label: 'Third-Party / Subcontractor Action' },
  { value: 'other', label: 'Other / Unspecified' },
];

export function ReturnDamageBatchDialog({
  open,
  onOpenChange,
  info,
  onSuccess,
}: ReturnDamageBatchDialogProps) {
  const employees = useAppStore((state) => state.employees) || [];
  const currentUser = useUserStore((state) => state.getCurrentUser());

  // Incident state
  const [causeCategory, setCauseCategory] = useState<DamageCauseCategory>('operator_error');
  const [causeNotes, setCauseNotes] = useState<string>('');
  const [faultAttribution, setFaultAttribution] = useState<DamageFaultAttribution>('dcel_personnel');
  const [faultPersonnelId, setFaultPersonnelId] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  // Per-item overrides (severity and optional estimated cost)
  const [itemSettings, setItemSettings] = useState<
    Record<string, { severity: DamageSeverity; estimatedCost: string }>
  >({});

  // Photos
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<{ name: string; url: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');

  // Pre-fill narrative when info changes
  useEffect(() => {
    if (!info) return;
    const defaultDesc = `Damaged items returned from ${info.siteName || 'Site'} on waybill ${info.waybillRef}.`;
    setDescription(defaultDesc);

    // Initialize item settings
    const initSettings: Record<string, { severity: DamageSeverity; estimatedCost: string }> = {};
    info.damagedItems.forEach((item) => {
      initSettings[item.assetId] = {
        severity: 'moderate',
        estimatedCost: '',
      };
    });
    setItemSettings(initSettings);

    // Make sure employees are loaded
    if (!employees || employees.length === 0) {
      fetchEmployeesData()
        .then((data) => useAppStore.setState({ employees: data }))
        .catch(console.error);
    }
  }, [info]);

  // DCEL Staff: Office and Field staff
  const staffList = useMemo(() => {
    return (employees || [])
      .filter((e) => {
        const type = (e.staffType || '').toUpperCase().trim();
        const isOfficeOrField = type === 'OFFICE' || type === 'FIELD';
        const isNotTerminated = !e.status || e.status !== 'Terminated';
        return isOfficeOrField && isNotTerminated;
      })
      .map((e) => {
        const nameParts = [e.surname, e.firstname].filter(Boolean);
        const fullName = nameParts.length > 0 ? nameParts.join(' ').trim() : 'Unnamed Staff';
        return {
          id: e.id,
          name: fullName,
          department: e.department || '',
          staffType: (e.staffType || '').toUpperCase(),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [employees]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files);
    setSelectedFiles((prev) => [...prev, ...newFiles]);
    const newPreviews = newFiles.map((file) => ({
      name: file.name,
      url: URL.createObjectURL(file),
    }));
    setFilePreviews((prev) => [...prev, ...newPreviews]);
  };

  const removeFile = (idx: number) => {
    URL.revokeObjectURL(filePreviews[idx].url);
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
    setFilePreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSkip = () => {
    onOpenChange(false);
    toast.info('Damage incident report skipped. You can record it anytime in the Damage Manager.');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!info || info.damagedItems.length === 0) return;

    setIsSubmitting(true);
    setUploadProgress('Uploading photos...');

    try {
      let uploadedPhotos: DamagePhoto[] = [];
      if (selectedFiles.length > 0) {
        uploadedPhotos = await uploadMultipleDamagePhotos(
          selectedFiles,
          currentUser?.id || 'unknown',
          (completed, total) => setUploadProgress(`Uploaded ${completed} of ${total} photos...`)
        );
      }

      setUploadProgress('Creating damage records...');

      const year = new Date().getFullYear();
      const randNum = Math.floor(1000 + Math.random() * 9000);
      const baseIncidentNumber = `DMG-${year}-${randNum}`;

      // Resolve fault staff name
      let responsiblePersonnel = '';
      if (faultAttribution === 'dcel_personnel' && faultPersonnelId) {
        const staff = staffList.find((s) => s.id === faultPersonnelId);
        if (staff) responsiblePersonnel = staff.name;
      }

      const recordsToInsert = info.damagedItems.map((item, idx) => {
        const settings = itemSettings[item.assetId] || { severity: 'moderate', estimatedCost: '' };
        const incidentNumber =
          info.damagedItems.length > 1
            ? `${baseIncidentNumber}-${idx + 1}`
            : baseIncidentNumber;

        return {
          incident_number: incidentNumber,
          incident_date: info.date
            ? new Date(info.date).toISOString()
            : new Date().toISOString(),
          location_type: (info.siteId ? 'active_site' : 'other') as any,
          site_id: info.siteId || null,
          specific_location: `Return Waybill ${info.waybillRef}`,
          item_type: 'asset' as const,
          asset_id: item.assetId,
          vehicle_id: null,
          item_name: item.assetName,
          quantity_damaged: item.quantity,
          severity: settings.severity,
          status: 'reported' as const,
          reported_by: currentUser?.id || null,
          reported_by_name: currentUser?.name || 'Staff Member',
          personnel_involved: responsiblePersonnel || null,
          cause_category: causeCategory,
          cause_notes: causeNotes.trim() || null,
          description: description.trim(),
          estimated_repair_cost: parseFloat(settings.estimatedCost) || 0,
          actual_repair_cost: 0,
          fault_attribution: faultAttribution,
          photos: uploadedPhotos,
        };
      });

      const { error } = await supabase.from('damage_logs').insert(recordsToInsert);

      if (error) {
        console.error('Failed to insert damage logs:', error);
        toast.error(`Database error: ${error.message}`);
        return;
      }

      toast.success(
        `Damage Incident Report ${baseIncidentNumber} filed for ${info.damagedItems.length} item(s)`
      );

      // Clean up files
      filePreviews.forEach((p) => URL.revokeObjectURL(p.url));
      setSelectedFiles([]);
      setFilePreviews([]);
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Error logging return damage:', err);
      toast.error(err.message || 'Failed to submit damage report');
    } finally {
      setIsSubmitting(false);
      setUploadProgress('');
    }
  };

  if (!info || info.damagedItems.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] p-0 flex flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
        <DialogHeader className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Log Return Damage Incident
              </DialogTitle>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {info.waybillRef} • {info.siteName || 'Site Return'} • {info.damagedItems.length} damaged item(s) detected
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3.5">

            {/* Damaged Items Breakdown */}
            <div className="p-3.5 bg-slate-50/60 dark:bg-slate-800/40 rounded-xl border border-slate-200/70 dark:border-slate-700/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-500" />
                  Damaged Items on Return
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  Pre-filled from waybill counts
                </span>
              </div>

              <div className="space-y-2">
                {info.damagedItems.map((item) => {
                  const currentSetting = itemSettings[item.assetId] || {
                    severity: 'moderate',
                    estimatedCost: '',
                  };
                  return (
                    <div
                      key={item.assetId}
                      className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {item.assetName}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400 font-bold border border-red-100 dark:border-red-900/30">
                            Qty: {item.quantity}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Severity select */}
                        <div className="relative">
                          <select
                            value={currentSetting.severity}
                            onChange={(e) => {
                              const val = e.target.value as DamageSeverity;
                              setItemSettings((prev) => ({
                                ...prev,
                                [item.assetId]: { ...prev[item.assetId], severity: val },
                              }));
                            }}
                            className="h-8 pl-2.5 pr-7 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-2xs appearance-none cursor-pointer focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                          >
                            <option value="minor">Minor</option>
                            <option value="moderate">Moderate</option>
                            <option value="severe">Severe</option>
                            <option value="critical">Critical</option>
                          </select>
                          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                        </div>

                        {/* Estimated Cost */}
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-400 pointer-events-none">₦</span>
                          <Input
                            type="number"
                            min="0"
                            placeholder="0.00"
                            value={currentSetting.estimatedCost}
                            onChange={(e) => {
                              const val = e.target.value;
                              setItemSettings((prev) => ({
                                ...prev,
                                [item.assetId]: { ...prev[item.assetId], estimatedCost: val },
                              }));
                            }}
                            className="h-8 pl-6 pr-2 w-24 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-2xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Root Cause & Fault Attribution */}
            <div className="p-3.5 bg-slate-50/60 dark:bg-slate-800/40 rounded-xl border border-slate-200/70 dark:border-slate-700/60 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                    Probable Root Cause
                  </Label>
                  <div className="relative mt-1">
                    <select
                      value={causeCategory}
                      onChange={(e) => setCauseCategory(e.target.value as DamageCauseCategory)}
                      className="w-full h-9 pl-3 pr-8 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-sm appearance-none cursor-pointer focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    >
                      {CAUSE_OPTIONS.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <Label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                    Fault Attribution
                  </Label>
                  <div className="relative mt-1">
                    <select
                      value={faultAttribution}
                      onChange={(e) => {
                        setFaultAttribution(e.target.value as DamageFaultAttribution);
                        setFaultPersonnelId('');
                      }}
                      className="w-full h-9 pl-3 pr-8 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-sm appearance-none cursor-pointer focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    >
                      <option value="client">Client</option>
                      <option value="dcel_personnel">DCEL Personnel</option>
                      <option value="act_of_god">Act of God</option>
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* DCEL Staff Picker if DCEL Personnel selected */}
              {faultAttribution === 'dcel_personnel' && (
                <div>
                  <Label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                    Select Responsible DCEL Personnel
                  </Label>
                  <div className="relative mt-1">
                    <select
                      value={faultPersonnelId}
                      onChange={(e) => setFaultPersonnelId(e.target.value)}
                      className="w-full h-9 pl-3 pr-8 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-sm appearance-none cursor-pointer focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    >
                      <option value="">— Select staff member —</option>
                      {staffList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}{s.staffType ? ` (${s.staffType})` : ''}{s.department ? ` · ${s.department}` : ''}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              )}

              {/* Cause Notes / Remarks */}
              <div>
                <Label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                  Cause Notes / Specific Circumstances
                </Label>
                <Input
                  value={causeNotes}
                  onChange={(e) => setCauseNotes(e.target.value)}
                  placeholder="e.g. Broken casing during transit on haulage truck"
                  className="mt-1 h-9 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Narrative Description */}
              <div>
                <Label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                  Incident Description & Inspection Notes
                </Label>
                <Textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detail the condition of the items when received at the warehouse..."
                  className="mt-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-sm min-h-[64px] resize-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Photos (Optional) */}
            <div className="p-3.5 bg-slate-50/60 dark:bg-slate-800/40 rounded-xl border border-slate-200/70 dark:border-slate-700/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-blue-500" />
                  Damage Photos (Optional)
                </Label>
                {selectedFiles.length > 0 && (
                  <span className="text-[11px] text-blue-600 font-semibold">
                    {selectedFiles.length} photo(s) selected
                  </span>
                )}
              </div>

              <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-xl p-4 text-center bg-white dark:bg-slate-900 hover:bg-blue-50/20 dark:hover:bg-blue-950/20 transition-all cursor-pointer relative shadow-2xs">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={isSubmitting}
                />
                <Upload className="w-4 h-4 mx-auto text-slate-400 mb-1" />
                <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                  Click or drag damage photos here
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">PNG, JPG, WebP up to 10MB each</p>
              </div>

              {filePreviews.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto py-1">
                  {filePreviews.map((preview, idx) => (
                    <div
                      key={idx}
                      className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-xs shrink-0 group"
                    >
                      <img src={preview.url} alt={preview.name} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="absolute top-1 right-1 p-1 bg-slate-900/80 rounded-full text-white hover:bg-red-600 transition-colors shadow-xs"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/60 shrink-0 flex items-center justify-between sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              disabled={isSubmitting}
              className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              Skip / Log Later
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="h-9 px-4.5 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all gap-2 flex items-center"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    <span>{uploadProgress || 'Saving...'}</span>
                  </>
                ) : (
                  `File Incident Report (${info.damagedItems.length})`
                )}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
