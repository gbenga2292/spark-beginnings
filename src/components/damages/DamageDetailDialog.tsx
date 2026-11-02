import React, { useState } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { useUserStore } from '../../store/userStore';
import {
  DamageLog,
  DamageStatus,
  DamageSeverity,
  DamageFaultAttribution,
} from '../../types/damage';
import {
  DamageStatusBadge,
  DamageSeverityBadge,
} from './DamageStatusBadge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { toast } from 'sonner';
import {
  Calendar,
  MapPin,
  Wrench,
  User,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Printer,
  ShieldCheck,
  Building2,
  Clock,
  Loader2,
  X,
  FileText,
  ChevronDown,
} from 'lucide-react';
import { NairaSign } from '../ui/naira-sign';

interface DamageDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  damage: DamageLog | null;
  onUpdate: (updated: DamageLog) => void;
}

export function DamageDetailDialog({
  open,
  onOpenChange,
  damage,
  onUpdate,
}: DamageDetailDialogProps) {
  if (!damage) return null;

  const currentUser = useUserStore((state) => state.getCurrentUser());
  const canAssess = currentUser?.privileges?.opsDamages?.canAssess ?? false;
  const canSignOff = currentUser?.privileges?.opsDamages?.canSignOff ?? false;

  // Status & Assessment Edit State
  const [status, setStatus] = useState<DamageStatus>(damage.status);
  const [actualCost, setActualCost] = useState<string>(
    damage.actual_repair_cost ? damage.actual_repair_cost.toString() : ''
  );
  const [resolutionNotes, setResolutionNotes] = useState<string>(
    damage.resolution_notes || ''
  );
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [activePhoto, setActivePhoto] = useState<string | null>(null);

  // Sync state if damage record changes
  React.useEffect(() => {
    setStatus(damage.status);
    setActualCost(damage.actual_repair_cost ? damage.actual_repair_cost.toString() : '');
    setResolutionNotes(damage.resolution_notes || '');
  }, [damage]);

  const handleSaveAssessment = async () => {
    setIsUpdating(true);
    try {
      const updates: any = {
        status,
        actual_repair_cost: parseFloat(actualCost) || 0,
        resolution_notes: resolutionNotes.trim() || null,
        updated_at: new Date().toISOString(),
      };

      // If transition to resolved/repaired/written_off and canSignOff
      if (
        (status === 'resolved' || status === 'repaired' || status === 'written_off') &&
        !damage.signed_off_at &&
        canSignOff
      ) {
        updates.signed_off_by = currentUser?.id || null;
        updates.signed_off_by_name = currentUser?.name || 'Authorized Manager';
        updates.signed_off_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('damage_logs')
        .update(updates)
        .eq('id', damage.id)
        .select()
        .single();

      if (error) throw error;

      toast.success('Damage incident updated successfully');
      onUpdate(data);
    } catch (err: any) {
      console.error('Failed to update incident:', err);
      toast.error(err.message || 'Failed to update record');
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] p-0 flex flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
          <DialogHeader className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/60 shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 border border-red-100 dark:border-red-900/50 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100 font-mono">
                      {damage.incident_number}
                    </DialogTitle>
                    <DamageStatusBadge status={damage.status} />
                    <DamageSeverityBadge severity={damage.severity} />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Logged on {new Date(damage.incident_date).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrint}
                  className="h-8.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 shadow-2xs gap-1.5 px-3"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-400" />
                  Print Report
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3.5 text-xs">
            {/* Top Grid: Location & Item */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Location Card */}
              <div className="p-3.5 bg-slate-50/60 dark:bg-slate-800/40 rounded-xl border border-slate-200/70 dark:border-slate-700/60 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px] text-slate-500 dark:text-slate-400">
                  <MapPin className="w-3.5 h-3.5 text-blue-500" />
                  <span>Location</span>
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {damage.location_type === 'active_site'
                    ? damage.site_name || 'Active Site'
                    : damage.location_type === 'old_site'
                    ? damage.site_name || 'Old Site'
                    : damage.location_type === 'office'
                    ? 'Office'
                    : damage.location_type === 'warehouse'
                    ? 'Warehouse'
                    : damage.location_type === 'transit'
                    ? 'In-Transit'
                    : 'Other Location'}
                </div>
                {damage.specific_location && (
                  <p className="text-slate-500 dark:text-slate-400 text-xs">{damage.specific_location}</p>
                )}
              </div>

              {/* Damaged Item Card */}
              <div className="p-3.5 bg-slate-50/60 dark:bg-slate-800/40 rounded-xl border border-slate-200/70 dark:border-slate-700/60 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px] text-slate-500 dark:text-slate-400">
                  <Wrench className="w-3.5 h-3.5 text-blue-500" />
                  <span>Damaged Item / Entity</span>
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {damage.item_name}
                </div>
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 capitalize text-xs">
                  <span>Category: {damage.item_type.replace(/_/g, ' ')}</span>
                  {(damage as any).quantity_damaged && (damage as any).quantity_damaged > 1 && (
                    <span>• Qty: {(damage as any).quantity_damaged}</span>
                  )}
                  {damage.asset_code && <span>• Code: {damage.asset_code}</span>}
                  {damage.vehicle_plate && <span>• Plate: {damage.vehicle_plate}</span>}
                </div>
              </div>
            </div>

            {/* Narrative Description & Root Cause */}
            <div className="p-3.5 bg-slate-50/60 dark:bg-slate-800/40 rounded-xl border border-slate-200/70 dark:border-slate-700/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-500" />
                  Incident Narrative & Description
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Cause: <strong className="capitalize text-slate-700 dark:text-slate-300">{damage.cause_category.replace('_', ' ')}</strong>
                </span>
              </div>
              <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs">
                {damage.description}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
                <div>
                  <strong>Reported By:</strong> {damage.reported_by_name || 'Staff Member'}
                </div>
                <div>
                  <strong>Personnel Involved:</strong> {damage.personnel_involved || 'None recorded'}
                </div>
              </div>
            </div>

            {/* Photo / Evidence Gallery */}
            <div className="p-3.5 bg-slate-50/60 dark:bg-slate-800/40 rounded-xl border border-slate-200/70 dark:border-slate-700/60 space-y-2.5">
              <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200">
                <span>Inspection Photos ({damage.photos?.length || 0})</span>
                <span className="text-[11px] text-slate-400 font-normal">
                  Hosted on DCEL Media Storage
                </span>
              </div>

              {damage.photos && damage.photos.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {damage.photos.map((photo, i) => (
                    <div
                      key={i}
                      onClick={() => setActivePhoto(photo.url)}
                      className="group relative h-28 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-black/5 hover:border-blue-500 cursor-pointer transition-colors shadow-2xs"
                    >
                      <img
                        src={photo.url}
                        alt={photo.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <ExternalLink className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-slate-400 bg-white dark:bg-slate-900">
                  No inspection photos were attached to this incident.
                </div>
              )}
            </div>

            {/* Financial & Fault Assessment Card */}
            <div className="p-3.5 bg-slate-50/60 dark:bg-slate-800/40 rounded-xl border border-slate-200/70 dark:border-slate-700/60 space-y-3">
              <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200">
                <span className="flex items-center gap-1.5">
                  <NairaSign className="w-3.5 h-3.5 text-blue-500" />
                  Financial Impact & Fault Attribution
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium">
                  {damage.fault_attribution === 'client' ? 'Client'
                    : damage.fault_attribution === 'dcel_personnel' ? 'DCEL Personnel'
                    : damage.fault_attribution === 'act_of_god' ? 'Act of God'
                    : (damage.fault_attribution as string).replace(/_/g, ' ')}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs">
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Estimated Repair Cost</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                    ₦{(damage.estimated_repair_cost || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                  </p>
                </div>

                <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs">
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Actual Repair / Incurred Cost</p>
                  {canAssess ? (
                    <div className="relative mt-1">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">₦</span>
                      <Input
                        type="number"
                        value={actualCost}
                        onChange={(e) => setActualCost(e.target.value)}
                        placeholder="0.00"
                        className="h-8 pl-6 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-2xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  ) : (
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                      ₦{(damage.actual_repair_cost || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Review, Sign-off & Resolution Status */}
            {(canAssess || canSignOff) && (
              <div className="p-3.5 bg-slate-50/60 dark:bg-slate-800/40 rounded-xl border border-slate-200/70 dark:border-slate-700/60 space-y-3">
                <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Lifecycle Status & Manager Sign-off</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Current Status</Label>
                    <div className="relative mt-1">
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as DamageStatus)}
                        className="w-full h-9 pl-3 pr-8 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-sm appearance-none cursor-pointer focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                      >
                        <option value="reported">Reported</option>
                        <option value="under_assessment">Under Assessment</option>
                        <option value="in_repair">In Repair</option>
                        <option value="repaired">Repaired</option>
                        <option value="written_off">Written Off</option>
                        <option value="resolved">Resolved / Closed</option>
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <Label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Sign-off Authority</Label>
                    <div className="mt-1 h-9 px-3 text-xs bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-1.5 shadow-2xs">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>{damage.signed_off_by_name || currentUser?.name || 'Pending Review'}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Resolution / Inspection Notes</Label>
                  <Textarea
                    placeholder="Enter technician findings, parts replaced, or sign-off remarks..."
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    className="mt-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-sm min-h-[60px] resize-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="flex justify-end pt-1">
                  <Button
                    size="sm"
                    onClick={handleSaveAssessment}
                    disabled={isUpdating}
                    className="h-9 px-4.5 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all gap-2 flex items-center"
                  >
                    {isUpdating ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving changes...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Update Incident & Status</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Read-only sign-off details if already signed off */}
            {damage.signed_off_at && (
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <div className="text-xs">
                  <p className="font-semibold text-emerald-800 dark:text-emerald-300">
                    Signed Off by {damage.signed_off_by_name} on{' '}
                    {new Date(damage.signed_off_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                  {damage.resolution_notes && (
                    <p className="text-emerald-700 dark:text-emerald-400 mt-0.5">
                      "{damage.resolution_notes}"
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Lightbox Modal for Full Image View */}
      {activePhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setActivePhoto(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={activePhoto}
              alt="Enlarged inspection"
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            />
            <button
              onClick={() => setActivePhoto(null)}
              className="absolute -top-3 -right-3 bg-white text-black p-1.5 rounded-full shadow-lg hover:bg-neutral-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
