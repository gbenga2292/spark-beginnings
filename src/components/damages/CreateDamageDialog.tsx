import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { useAppStore } from '../../store/appStore';
import { useUserStore } from '../../store/userStore';
import { useOperations } from '../../contexts/OperationsContext';
import {
  DamageLocationType,
  DamageItemType,
  DamageSeverity,
  DamageCauseCategory,
  DamageFaultAttribution,
  DamagePhoto,
  DamageLog,
} from '../../types/damage';
import { Waybill } from '../../types/operations';
import { uploadMultipleDamagePhotos } from '../../utils/damageMediaUpload';
import { fetchEmployeesData } from '../../lib/supabaseService';
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
  Camera,
  Upload,
  X,
  Loader2,
  AlertTriangle,
  Search,
  ChevronDown,
  MapPin,
  Calendar,
  UserCheck,
  FileText,
  Wrench,
} from 'lucide-react';
import { NairaSign } from '../ui/naira-sign';

interface CreateDamageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (newLog: DamageLog) => void;
}

const CAUSE_LABELS: Record<DamageCauseCategory, string> = {
  operator_error: 'Operator / Handling Error',
  wear_tear: 'Wear & Tear / Age',
  accident: 'Accidental Collision / Impact',
  weather: 'Severe Weather / Flood',
  malfunction: 'Mechanical / Electrical Malfunction',
  third_party: 'Third-Party Vandalism or Damage',
  other: 'Other / Unspecified',
};

const LOCATION_OPTIONS: { value: DamageLocationType; label: string }[] = [
  { value: 'active_site', label: 'Active Site' },
  { value: 'old_site',    label: 'Old Site' },
  { value: 'office',      label: 'Office' },
  { value: 'warehouse',   label: 'Warehouse' },
  { value: 'transit',     label: 'In Transit' },
  { value: 'other',       label: 'Others' },
];

export function CreateDamageDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateDamageDialogProps) {
  const sites = useAppStore((state) => state.sites) || [];
  const employees = useAppStore((state) => state.employees) || [];
  const currentUser = useUserStore((state) => state.getCurrentUser());
  const { assets: opsAssets, waybills } = useOperations();

  // Active sites = status 'Active'; old sites = Inactive / Ended
  const activeSites = useMemo(() => sites.filter((s) => s.status === 'Active'), [sites]);
  const oldSites = useMemo(() => sites.filter((s) => s.status !== 'Active'), [sites]);

  // Form State
  const [incidentDate, setIncidentDate] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );
  const [locationType, setLocationType] = useState<DamageLocationType>('active_site');
  const [siteId, setSiteId] = useState<string>('');
  const [specificLocation, setSpecificLocation] = useState<string>('');

  const [itemType, setItemType] = useState<DamageItemType>('asset');
  const [assetId, setAssetId] = useState<string>('');
  const [vehicleId, setVehicleId] = useState<string>('');
  const [itemName, setItemName] = useState<string>('');
  const [inventorySearch, setInventorySearch] = useState<string>('');
  const [showInventoryFallback, setShowInventoryFallback] = useState<boolean>(false);
  const [quantityDamaged, setQuantityDamaged] = useState<string>('1');

  const [severity, setSeverity] = useState<DamageSeverity>('minor');
  const [causeCategory, setCauseCategory] = useState<DamageCauseCategory>('operator_error');
  const [causeNotes, setCauseNotes] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [personnelInvolved, setPersonnelInvolved] = useState<string>('');

  const [estimatedCost, setEstimatedCost] = useState<string>('');
  const [faultAttribution, setFaultAttribution] = useState<DamageFaultAttribution>('dcel_personnel');
  const [faultPersonnelId, setFaultPersonnelId] = useState<string>('');

  // File Upload State
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<{ name: string; url: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');

  // Vehicles from store and direct Supabase fetch
  const storeVehicles = useAppStore((state) => (state as any).vehicles) || [];
  const [dbVehicles, setDbVehicles] = useState<{ id: string; plateNumber: string; makeModel?: string }[]>([]);

  const vehicles = useMemo(() => {
    if (dbVehicles.length > 0) return dbVehicles;
    return (storeVehicles || []).map((v: any) => ({
      id: v.id,
      plateNumber: v.registration_number || v.name || '',
      makeModel: v.name !== v.registration_number ? v.name : (v.type || ''),
    }));
  }, [dbVehicles, storeVehicles]);

  useEffect(() => {
    if (!open) return;
    if (!employees || employees.length === 0) {
      fetchEmployeesData()
        .then((data) => useAppStore.setState({ employees: data }))
        .catch(console.error);
    }
    supabase
      .from('vehicles')
      .select('id, name, registration_number, type, status')
      .order('name')
      .limit(500)
      .then(({ data, error }) => {
        if (data && data.length > 0) {
          setDbVehicles(
            data.map((v: any) => ({
              id: v.id,
              plateNumber: v.registration_number || v.name || '',
              makeModel: v.name !== v.registration_number ? v.name : (v.type || ''),
            }))
          );
        }
      });
  }, [open, employees]);

  // All DCEL staff from employees (only OFFICE and FIELD staff types)
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
          position: e.position || '',
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [employees]);

  // Inventory items from OperationsContext
  const allInventoryItems = useMemo(() => {
    return (opsAssets || []).map((a: any) => ({
      id: a.id,
      name: a.name,
      code: a.code || '',
    }));
  }, [opsAssets]);

  // Filtered inventory by search
  const filteredInventory = useMemo(() => {
    if (!inventorySearch.trim()) return allInventoryItems;
    const q = inventorySearch.toLowerCase();
    return allInventoryItems.filter(
      (a) => a.name.toLowerCase().includes(q) || a.code?.toLowerCase().includes(q)
    );
  }, [allInventoryItems, inventorySearch]);

  // Site items from waybills (for selected active site)
  const siteItems = useMemo(() => {
    if (!siteId || locationType !== 'active_site') return [];
    const itemMap = new Map<string, { id: string; name: string; code?: string }>();
    (waybills as Waybill[] || []).forEach((wb) => {
      if (wb.siteId !== siteId) return;
      if (wb.type === 'return') return;
      wb.items.forEach((item) => {
        if (!itemMap.has(item.assetId)) {
          itemMap.set(item.assetId, {
            id: item.assetId,
            name: item.assetName,
          });
        }
      });
    });
    return Array.from(itemMap.values());
  }, [siteId, locationType, waybills]);

  const needsSiteSelect = locationType === 'active_site' || locationType === 'old_site';
  const currentSiteList = locationType === 'active_site' ? activeSites : oldSites;
  const showSiteItems = locationType === 'active_site' && siteId && siteItems.length > 0;

  // Handle local file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const filesArray = Array.from(e.target.files);
    setSelectedFiles((prev) => [...prev, ...filesArray]);
    const newPreviews = filesArray.map((file) => ({
      name: file.name,
      url: URL.createObjectURL(file),
    }));
    setFilePreviews((prev) => [...prev, ...newPreviews]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setFilePreviews((prev) => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSiteItemSelect = (id: string) => {
    if (id === '__other__') {
      setAssetId('');
      setItemName('');
      setShowInventoryFallback(true);
      return;
    }
    setShowInventoryFallback(false);
    setAssetId(id);
    const found = siteItems.find((a) => a.id === id);
    if (found) setItemName(found.name);
  };

  const handleInventorySelect = (id: string) => {
    setAssetId(id);
    const found = allInventoryItems.find((a) => a.id === id);
    if (found) setItemName(found.code ? `[${found.code}] ${found.name}` : found.name);
  };

  const vehicleLabel = (v: { plateNumber?: string; makeModel?: string }) => {
    if (v.plateNumber && v.makeModel && v.plateNumber !== v.makeModel) {
      return `${v.plateNumber} (${v.makeModel})`;
    }
    return v.plateNumber || v.makeModel || 'Unnamed Vehicle';
  };

  const handleVehicleSelect = (id: string) => {
    setVehicleId(id);
    const found = vehicles.find((v) => v.id === id);
    if (found) setItemName(vehicleLabel(found));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) {
      toast.error('Please specify the damaged item');
      return;
    }
    if (!description.trim()) {
      toast.error('Please provide a description of the damage');
      return;
    }
    if (needsSiteSelect && !siteId) {
      toast.error('Please select the site where damage occurred');
      return;
    }

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

      setUploadProgress('Saving record...');

      const year = new Date().getFullYear();
      const randNum = Math.floor(1000 + Math.random() * 9000);
      const incidentNumber = `DMG-${year}-${randNum}`;

      // Resolve fault personnel name if DCEL personnel selected
      let personnelNote = personnelInvolved.trim() || null;
      if (faultAttribution === 'dcel_personnel' && faultPersonnelId) {
        const staff = staffList.find((s) => s.id === faultPersonnelId);
        if (staff) {
          personnelNote = staff.name + (personnelNote ? `, ${personnelNote}` : '');
        }
      }

      const insertPayload = {
        incident_number: incidentNumber,
        incident_date: new Date(incidentDate).toISOString(),
        location_type: locationType,
        site_id: needsSiteSelect && siteId ? siteId : null,
        specific_location: specificLocation.trim() || null,
        item_type: itemType,
        asset_id: itemType === 'asset' && assetId ? assetId : null,
        vehicle_id: itemType === 'vehicle' && vehicleId ? vehicleId : null,
        item_name: itemName.trim(),
        quantity_damaged: parseInt(quantityDamaged) || 1,
        severity,
        status: 'reported',
        reported_by: currentUser?.id || null,
        reported_by_name: currentUser?.name || 'Staff Member',
        personnel_involved: personnelNote,
        cause_category: causeCategory,
        cause_notes: causeNotes.trim() || null,
        description: description.trim(),
        estimated_repair_cost: parseFloat(estimatedCost) || 0,
        actual_repair_cost: 0,
        fault_attribution: faultAttribution,
        photos: uploadedPhotos,
      };

      const { data, error } = await supabase
        .from('damage_logs')
        .insert(insertPayload)
        .select()
        .single();

      if (error) throw error;

      toast.success(`Damage incident ${incidentNumber} logged`);
      onSuccess(data);
      onOpenChange(false);
      resetForm();
    } catch (err: any) {
      console.error('Failed to log damage:', err);
      toast.error(err.message || 'Failed to save damage record');
    } finally {
      setIsSubmitting(false);
      setUploadProgress('');
    }
  };

  const resetForm = () => {
    setItemName('');
    setDescription('');
    setSpecificLocation('');
    setPersonnelInvolved('');
    setEstimatedCost('');
    setSiteId('');
    setAssetId('');
    setVehicleId('');
    setQuantityDamaged('1');
    setCauseNotes('');
    setInventorySearch('');
    setFaultPersonnelId('');
    setSelectedFiles([]);
    filePreviews.forEach((p) => URL.revokeObjectURL(p.url));
    setFilePreviews([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] p-0 flex flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
        <DialogHeader className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 border border-red-100 dark:border-red-900/50 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-slate-900 dark:text-slate-100">Log Damage Incident</DialogTitle>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Record damages with location, item, photos, and attribution.</p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3.5">

            {/* Row 1: Date & Severity */}
            <div className="p-3.5 bg-slate-50/60 dark:bg-slate-800/40 rounded-xl border border-slate-200/70 dark:border-slate-700/60 space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Incident Date & Time *</Label>
                  <div className="relative mt-1">
                    <Input
                      type="datetime-local"
                      value={incidentDate}
                      onChange={(e) => setIncidentDate(e.target.value)}
                      className="h-9 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Severity Level *</Label>
                  <div className="relative mt-1">
                    <select
                      value={severity}
                      onChange={(e) => setSeverity(e.target.value as DamageSeverity)}
                      className="w-full h-9 pl-3 pr-8 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-sm appearance-none cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    >
                      <option value="minor">Minor (Cosmetic / Light wear)</option>
                      <option value="moderate">Moderate (Functional impairment)</option>
                      <option value="severe">Severe (Heavy damage / Inoperable)</option>
                      <option value="critical">Critical / Total Loss</option>
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* Section: Where */}
            <div className="p-3.5 bg-slate-50/60 dark:bg-slate-800/40 rounded-xl border border-slate-200/70 dark:border-slate-700/60 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-blue-500" />
                  Where did this happen? *
                </Label>
                <span className="text-[10px] text-slate-400 font-medium">Select primary location</span>
              </div>

              {/* Segmented Pill Selector (Daily Register Style) */}
              <div className="bg-slate-200/60 dark:bg-slate-800/90 p-1 rounded-xl grid grid-cols-3 sm:grid-cols-6 gap-1 border border-slate-200/60 dark:border-slate-700/60">
                {LOCATION_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setLocationType(value);
                      setSiteId('');
                      setSpecificLocation('');
                      setAssetId('');
                      setItemName('');
                    }}
                    className={`h-7.5 px-1.5 rounded-lg text-xs font-semibold transition-all ${
                      locationType === value
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/60 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {needsSiteSelect && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
                  <div>
                    <Label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                      {locationType === 'active_site' ? 'Active Site *' : 'Previous Site *'}
                    </Label>
                    <div className="relative mt-1">
                      <select
                        value={siteId}
                        onChange={(e) => {
                          setSiteId(e.target.value);
                          setAssetId('');
                          setItemName('');
                        }}
                        className="w-full h-9 pl-3 pr-8 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-sm appearance-none cursor-pointer focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        required
                      >
                        <option value="">
                          {locationType === 'active_site' ? 'Select active site...' : 'Select previous site...'}
                        </option>
                        {currentSiteList.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}{s.client ? ` · ${s.client}` : ''}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Exact Spot (Optional)</Label>
                    <Input
                      placeholder="e.g. Pit #2, Pump Station, Workshop..."
                      value={specificLocation}
                      onChange={(e) => setSpecificLocation(e.target.value)}
                      className="mt-1 h-9 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              {!needsSiteSelect && (
                <div>
                  <Label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Specific Location / Spot (Optional)</Label>
                  <Input
                    placeholder={
                      locationType === 'office' ? 'e.g. Conference Room, Reception, Main Office...' :
                      locationType === 'warehouse' ? 'e.g. Bay 3, Racking Section A...' :
                      locationType === 'transit' ? 'e.g. Lagos-Ibadan expressway, haulage route...' :
                      'e.g. Location details...'
                    }
                    value={specificLocation}
                    onChange={(e) => setSpecificLocation(e.target.value)}
                    className="mt-1 h-9 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>

            {/* Section: Damaged Item */}
            <div className="p-3.5 bg-slate-50/60 dark:bg-slate-800/40 rounded-xl border border-slate-200/70 dark:border-slate-700/60 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-blue-500" />
                  Damaged Item Identification
                </Label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <Label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Item Category *</Label>
                  <div className="relative mt-1">
                    <select
                      value={itemType}
                      onChange={(e) => {
                        setItemType(e.target.value as DamageItemType);
                        setAssetId('');
                        setVehicleId('');
                        setItemName('');
                        setInventorySearch('');
                      }}
                      className="w-full h-9 pl-3 pr-8 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-sm appearance-none cursor-pointer focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    >
                      <option value="asset">Machinery & Plant</option>
                      <option value="vehicle">Fleet Vehicle</option>
                      <option value="office_fixture">Office Fixture / Building</option>
                      <option value="tool_equipment">Tool / Site Equipment</option>
                      <option value="property">Client / Third-Party Property</option>
                      <option value="other">Other</option>
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <Label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Quantity Damaged</Label>
                  <Input
                    type="number"
                    min="1"
                    value={quantityDamaged}
                    onChange={(e) => setQuantityDamaged(e.target.value)}
                    className="mt-1 h-9 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Asset: site items first (if active site selected), then searchable inventory */}
              {itemType === 'asset' && (
                <div className="space-y-2.5 pt-0.5">
                  {/* Site items picker */}
                  {showSiteItems && (
                    <div>
                      <Label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        Items currently deployed on site
                        <span className="ml-1 text-blue-600 font-semibold">({siteItems.length})</span>
                      </Label>
                      <div className="relative mt-1">
                        <select
                          value={showInventoryFallback ? '__other__' : (assetId || '')}
                          onChange={(e) => handleSiteItemSelect(e.target.value)}
                          className="w-full h-9 pl-3 pr-8 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-sm appearance-none cursor-pointer focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        >
                          <option value="">— Select item on site —</option>
                          {siteItems.map((a) => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                          ))}
                          <option value="__other__">Other (not on site list)</option>
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                  )}

                  {/* Searchable full inventory */}
                  {(!showSiteItems || showInventoryFallback) && (
                    <div>
                      <Label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        {showInventoryFallback ? 'Search full central inventory' : 'Search inventory'}
                      </Label>
                      <div className="relative mt-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                        <Input
                          placeholder="Type to search machinery and equipment..."
                          value={inventorySearch}
                          onChange={(e) => setInventorySearch(e.target.value)}
                          className="h-9 text-xs pl-8 pr-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      {inventorySearch && (
                        <div className="mt-1.5 max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 shadow-lg divide-y divide-slate-100 dark:divide-slate-800">
                          {filteredInventory.length === 0 ? (
                            <div className="px-3.5 py-2.5 text-xs text-slate-400">No items found matching "{inventorySearch}"</div>
                          ) : (
                            filteredInventory.slice(0, 30).map((a) => (
                              <button
                                key={a.id}
                                type="button"
                                onClick={() => {
                                  handleInventorySelect(a.id);
                                  setInventorySearch('');
                                }}
                                className={`w-full text-left px-3.5 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors ${
                                  assetId === a.id ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 font-semibold' : 'text-slate-700 dark:text-slate-200'
                                }`}
                              >
                                {a.code ? <span className="text-slate-400 font-mono mr-1.5">[{a.code}]</span> : null}
                                {a.name}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Vehicle picker */}
              {itemType === 'vehicle' && (
                <div>
                  <Label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Fleet Vehicle</Label>
                  <div className="relative mt-1">
                    <select
                      value={vehicleId}
                      onChange={(e) => handleVehicleSelect(e.target.value)}
                      className="w-full h-9 pl-3 pr-8 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-sm appearance-none cursor-pointer focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    >
                      <option value="">— Select fleet vehicle —</option>
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {vehicleLabel(v)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              )}

              {/* Item name */}
              <div>
                <Label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                  {itemType === 'asset' || itemType === 'vehicle' ? 'Confirm / Edit Item Name *' : 'Item Name *'}
                </Label>
                <Input
                  placeholder={
                    itemType === 'asset' ? 'e.g. Dewatering Pump 736, Water Pump...' :
                    itemType === 'vehicle' ? 'e.g. ABC-123XY (Toyota Land Cruiser)...' :
                    'e.g. Glass Door, Scaffold Pipe, Generator...'
                  }
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="mt-1 h-9 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            {/* Section: Incident Details */}
            <div className="p-3.5 bg-slate-50/60 dark:bg-slate-800/40 rounded-xl border border-slate-200/70 dark:border-slate-700/60 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-500" />
                  Incident Details & Description
                </Label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Probable Cause</Label>
                  <div className="relative mt-1">
                    <select
                      value={causeCategory}
                      onChange={(e) => setCauseCategory(e.target.value as DamageCauseCategory)}
                      className="w-full h-9 pl-3 pr-8 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-sm appearance-none cursor-pointer focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    >
                      {Object.entries(CAUSE_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <Label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Personnel Involved / Witness</Label>
                  <Input
                    placeholder="e.g. Operator name, Driver, Site Engineer..."
                    value={personnelInvolved}
                    onChange={(e) => setPersonnelInvolved(e.target.value)}
                    className="mt-1 h-9 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <Label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Specific Circumstance (Optional)</Label>
                <Input
                  placeholder="Brief note on what triggered or contributed to the damage..."
                  value={causeNotes}
                  onChange={(e) => setCauseNotes(e.target.value)}
                  className="mt-1 h-9 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <Label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Description of Damage *</Label>
                <Textarea
                  placeholder="Describe visible damage, functional issues, and immediate containment measures..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-sm min-h-[64px] resize-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            {/* Section: Financial & Fault */}
            <div className="p-3.5 bg-slate-50/60 dark:bg-slate-800/40 rounded-xl border border-slate-200/70 dark:border-slate-700/60 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <NairaSign className="w-3.5 h-3.5 text-blue-500" />
                  Financial & Responsibility Attribution
                </Label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1">
                    Estimated Repair Cost
                  </Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">₦</span>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={estimatedCost}
                      onChange={(e) => setEstimatedCost(e.target.value)}
                      className="h-9 pl-7 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Fault Attribution</Label>
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

              {/* DCEL Personnel picker */}
              {faultAttribution === 'dcel_personnel' && (
                <div>
                  <Label className="text-[11px] font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                    Responsible DCEL Personnel (Office / Field Staff)
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
            </div>

            {/* Photos */}
            <div className="p-3.5 bg-slate-50/60 dark:bg-slate-800/40 rounded-xl border border-slate-200/70 dark:border-slate-700/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-blue-500" />
                  Incident Evidence & Photos
                </Label>
                {selectedFiles.length > 0 && (
                  <span className="text-[11px] text-blue-600 font-semibold">{selectedFiles.length} photo(s) selected</span>
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
                <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300">Click or drag incident photos here</p>
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
                        disabled={isSubmitting}
                        className="absolute top-1 right-1 bg-slate-900/80 text-white p-1 rounded-full hover:bg-red-600 transition-colors shadow-xs"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {uploadProgress && (
                <div className="flex items-center gap-2 text-xs text-blue-600 font-medium">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{uploadProgress}</span>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/60 shrink-0 flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="h-9 px-4 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="h-9 px-4.5 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all gap-2 flex items-center"
            >
              {isSubmitting ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>Logging incident...</span></>
              ) : (
                <><AlertTriangle className="w-3.5 h-3.5" /><span>Submit Damage Log</span></>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
