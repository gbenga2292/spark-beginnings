import { useState, useMemo } from 'react';
import { useAppStore } from '@/src/store/appStore';
import { X, Loader2, ChevronDown, ClipboardList, MapPin, Building2, User, Calendar, Clock, Layers, Hash } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { cn } from '@/src/lib/utils';
import {
  SiteRequest,
  CreateSiteRequestPayload,
  SiteRequestCategory,
  SiteRequestUrgency,
  CATEGORY_LABELS,
  CATEGORY_ICONS,
  URGENCY_CONFIG,
  UNIT_OPTIONS,
} from '@/src/types/siteRequests';

interface Props {
  initialRequest?: SiteRequest;
  onClose: () => void;
  onCreate?: (payload: CreateSiteRequestPayload) => Promise<any>;
  onUpdate?: (id: string, payload: Partial<CreateSiteRequestPayload>) => Promise<any>;
}

const CATEGORIES: SiteRequestCategory[] = ['equipment', 'material', 'fuel', 'personnel', 'vehicle', 'other'];
const URGENCIES: SiteRequestUrgency[]   = ['low', 'normal', 'urgent', 'critical'];

export function NewRequestDialog({ initialRequest, onClose, onCreate, onUpdate }: Props) {
  const isEdit = !!initialRequest;
  const { employees, sites } = useAppStore();

  const [empSearch, setEmpSearch]   = useState('');
  const [empOpen, setEmpOpen]       = useState(false);
  const [customMode, setCustomMode] = useState(!initialRequest?.requestedById && !!initialRequest?.requestedByName);
  const [customName, setCustomName] = useState(initialRequest && !initialRequest.requestedById ? initialRequest.requestedByName : '');
  const [selectedEmp, setSelectedEmp] = useState<{ id: string; name: string; role?: string } | null>(
    initialRequest?.requestedById
      ? { id: initialRequest.requestedById, name: initialRequest.requestedByName, role: initialRequest.requestedByRole }
      : null
  );

  const [siteOpen, setSiteOpen]       = useState(false);
  const [siteSearch, setSiteSearch]   = useState('');
  const [selectedSite, setSelectedSite] = useState<{ id: string; name: string } | null>(
    initialRequest?.siteId ? { id: initialRequest.siteId, name: initialRequest.siteName || '' } : null
  );

  const [category, setCategory] = useState<SiteRequestCategory>(initialRequest?.category ?? 'equipment');
  const [item, setItem]         = useState(initialRequest?.item ?? '');
  const [quantity, setQuantity] = useState(initialRequest?.quantity ? String(initialRequest.quantity) : '');
  const [unit, setUnit]         = useState(initialRequest?.unit ?? 'units');
  const [urgency, setUrgency]   = useState<SiteRequestUrgency>(initialRequest?.urgency ?? 'normal');
  const [requestDate, setRequestDate] = useState(() => {
    if (initialRequest?.requestDate) return initialRequest.requestDate;
    if (initialRequest?.createdAt) return initialRequest.createdAt.split('T')[0];
    return new Date().toISOString().split('T')[0];
  });
  const [neededBy, setNeededBy] = useState(initialRequest?.neededByDate ?? '');
  const [saving, setSaving]     = useState(false);

  const activeEmployees = useMemo(() =>
    employees
      .filter(e => e.status === 'Active' || e.status === 'On Leave')
      .filter(e => {
        const q = empSearch.toLowerCase();
        return !q || `${e.firstname} ${e.surname}`.toLowerCase().includes(q) || (e.position && e.position.toLowerCase().includes(q));
      })
      .slice(0, 30),
  [employees, empSearch]);

  // Active sites with Office (DCEL) pinned at the top
  const activeSitesList = useMemo(() => {
    // 1. Locate the DCEL office site if it exists in the store
    const dcelSite = sites.find(s => 
      s.name.toLowerCase().trim() === 'office (dcel)' ||
      (s.client?.toLowerCase().trim() === 'dcel' && s.name.toLowerCase().trim().includes('office')) ||
      s.name.toLowerCase().trim() === 'office' ||
      s.name.toLowerCase().trim() === 'dcel office'
    );

    const officeOption = dcelSite 
      ? { id: dcelSite.id, name: 'Office (DCEL)', client: 'DCEL', isOffice: true }
      : { id: 'office-dcel', name: 'Office (DCEL)', client: 'DCEL', isOffice: true };

    // 2. Filter active operational sites only
    const operationalActive = sites
      .filter(s => {
        if (dcelSite && s.id === dcelSite.id) return false;
        const nameLower = s.name.toLowerCase().trim();
        if (nameLower === 'office' || nameLower === 'office (dcel)' || nameLower === 'dcel office') return false;
        const statusLow = (s.status || '').toLowerCase().trim();
        return statusLow === 'active';
      })
      .map(s => ({
        id: s.id,
        name: s.name,
        client: s.client,
        isOffice: false,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // 3. Office (DCEL) always at top
    return [officeOption, ...operationalActive];
  }, [sites]);

  const filteredSites = useMemo(() => {
    if (!siteSearch.trim()) return activeSitesList;
    const q = siteSearch.toLowerCase().trim();
    return activeSitesList.filter(s =>
      s.name.toLowerCase().includes(q) || (s.client && s.client.toLowerCase().includes(q))
    );
  }, [activeSitesList, siteSearch]);

  const requesterName = customMode ? customName.trim() : selectedEmp?.name ?? '';
  const canSubmit = requesterName && item.trim();

  const handleSubmit = async () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    const payload = {
      siteId:           selectedSite?.id,
      siteName:         selectedSite?.name,
      requestedById:    customMode ? undefined : selectedEmp?.id,
      requestedByName:  requesterName,
      requestedByRole:  customMode ? undefined : selectedEmp?.role,
      category,
      item:             item.trim(),
      quantity:         quantity ? Number(quantity) : undefined,
      unit:             quantity ? unit : undefined,
      urgency,
      requestDate:      requestDate || undefined,
      neededByDate:     neededBy || undefined,
    };

    if (isEdit && onUpdate && initialRequest) {
      await onUpdate(initialRequest.id, payload);
    } else if (onCreate) {
      await onCreate(payload as CreateSiteRequestPayload);
    }
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-6 animate-in fade-in-50 duration-150" onClick={onClose}>
      <div
        className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/60 shadow-xs">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                {isEdit ? 'Edit Site Request' : 'New Site Request'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Internal requisition for materials, equipment, fuel, and logistics.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Landscape Form Body (Two Columns on Desktop) */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* ── LEFT COLUMN: Context & Categorization ── */}
            <div className="space-y-4">
              <div className="flex items-center gap-1.5 pb-1 border-b border-slate-100 dark:border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-400">
                <Layers className="w-3.5 h-3.5 text-indigo-500" />
                <span>Request Context</span>
              </div>

              {/* Requested by */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" /> Requested By <span className="text-rose-500">*</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => { setCustomMode(v => !v); setSelectedEmp(null); setCustomName(''); }}
                    className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    {customMode ? 'Choose from team roster' : 'Enter name manually'}
                  </button>
                </label>

                {!customMode ? (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setEmpOpen(v => !v)}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2 rounded-xl border text-sm transition-colors text-left',
                        'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700',
                        'hover:border-slate-300 dark:hover:border-slate-600 shadow-xs',
                        selectedEmp ? 'text-slate-900 dark:text-white font-medium' : 'text-slate-400'
                      )}
                    >
                      <span className="truncate">{selectedEmp ? `${selectedEmp.name} ${selectedEmp.role ? `(${selectedEmp.role})` : ''}` : 'Select employee...'}</span>
                      <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />
                    </button>
                    {empOpen && (
                      <div className="absolute z-20 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in-50 duration-100">
                        <div className="p-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                          <Input
                            autoFocus
                            value={empSearch}
                            onChange={e => setEmpSearch(e.target.value)}
                            placeholder="Search employee or role..."
                            className="h-8 text-xs"
                          />
                        </div>
                        <ul className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/50">
                          {activeEmployees.map(e => (
                            <li key={e.id}>
                              <button
                                type="button"
                                className="w-full text-left px-3 py-2 text-xs hover:bg-indigo-50/60 dark:hover:bg-indigo-950/30 text-slate-900 dark:text-white flex items-center justify-between gap-2 transition-colors"
                                onClick={() => {
                                  setSelectedEmp({ id: e.id, name: `${e.firstname} ${e.surname}`, role: e.position ?? undefined });
                                  setEmpOpen(false);
                                  setEmpSearch('');
                                }}
                              >
                                <span className="font-semibold">{e.firstname} {e.surname}</span>
                                {e.position && (
                                  <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-700/80 px-2 py-0.5 rounded-full truncate max-w-[140px]">
                                    {e.position}
                                  </span>
                                )}
                              </button>
                            </li>
                          ))}
                          {activeEmployees.length === 0 && (
                            <li className="px-3 py-4 text-xs text-slate-400 text-center">No employee found</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <Input
                    autoFocus
                    value={customName}
                    onChange={e => setCustomName(e.target.value)}
                    placeholder="Enter requester's full name..."
                    className="text-sm rounded-xl"
                  />
                )}
              </div>

              {/* Site (Active sites only, Office (DCEL) at the top) */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" /> Target Site / Location
                  </span>
                  <span className="text-[11px] font-normal text-slate-400">Active sites only</span>
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setSiteOpen(v => !v)}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 rounded-xl border text-sm transition-colors text-left',
                      'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700',
                      'hover:border-slate-300 dark:hover:border-slate-600 shadow-xs',
                      selectedSite ? 'text-slate-900 dark:text-white font-medium' : 'text-slate-400'
                    )}
                  >
                    <span className="truncate flex items-center gap-1.5">
                      {selectedSite?.name === 'Office (DCEL)' && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                          HQ
                        </span>
                      )}
                      {selectedSite?.name ?? 'Select site...'}
                    </span>
                    {selectedSite ? (
                      <X
                        className="h-4 w-4 text-slate-400 hover:text-slate-600 flex-shrink-0"
                        onClick={e => { e.stopPropagation(); setSelectedSite(null); }}
                      />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />
                    )}
                  </button>

                  {siteOpen && (
                    <div className="absolute z-20 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in-50 duration-100">
                      <div className="p-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                        <Input
                          autoFocus
                          value={siteSearch}
                          onChange={e => setSiteSearch(e.target.value)}
                          placeholder="Filter active sites or office..."
                          className="h-8 text-xs"
                        />
                      </div>
                      <ul className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/50">
                        {filteredSites.map(s => {
                          const isTopOffice = s.isOffice || s.name === 'Office (DCEL)';
                          return (
                            <li key={s.id}>
                              <button
                                type="button"
                                className={cn(
                                  "w-full text-left px-3 py-2 text-xs flex items-center justify-between gap-2 transition-colors",
                                  isTopOffice 
                                    ? "bg-indigo-50/40 dark:bg-indigo-950/20 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 font-bold text-indigo-900 dark:text-indigo-300"
                                    : "hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-900 dark:text-white"
                                )}
                                onClick={() => {
                                  setSelectedSite({ id: s.id, name: s.name });
                                  setSiteOpen(false);
                                  setSiteSearch('');
                                }}
                              >
                                <span className="flex items-center gap-1.5 truncate">
                                  {isTopOffice && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-indigo-500 text-white shadow-xs">
                                      OFFICE
                                    </span>
                                  )}
                                  <span className="truncate">{s.name}</span>
                                </span>
                                {s.client && s.client !== 'DCEL' && (
                                  <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-700/80 px-2 py-0.5 rounded-full shrink-0">
                                    {s.client}
                                  </span>
                                )}
                              </button>
                            </li>
                          );
                        })}
                        {filteredSites.length === 0 && (
                          <li className="px-3 py-4 text-xs text-slate-400 text-center">No active sites found</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                  Category <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORIES.map(c => {
                    const isSelected = category === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCategory(c)}
                        className={cn(
                          'flex flex-col items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl border text-xs font-semibold transition-all shadow-xs cursor-pointer',
                          isSelected
                            ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-600 text-white shadow-indigo-500/20'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                        )}
                      >
                        <span className="text-xl leading-none">{CATEGORY_ICONS[c]}</span>
                        <span className="capitalize">{CATEGORY_LABELS[c]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── RIGHT COLUMN: Item Details & Priority ── */}
            <div className="space-y-4">
              <div className="flex items-center gap-1.5 pb-1 border-b border-slate-100 dark:border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-400">
                <Hash className="w-3.5 h-3.5 text-indigo-500" />
                <span>Requisition Details</span>
              </div>

              {/* What do you need */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                  What do you need? <span className="text-rose-500">*</span>
                </label>
                <Input
                  value={item}
                  onChange={e => setItem(e.target.value)}
                  placeholder={
                    category === 'fuel' ? 'e.g. 500L diesel for site generator' :
                    category === 'equipment' ? 'e.g. 4-inch Submersible dewatering pump' :
                    category === 'material' ? 'e.g. 50 bags of Dangote cement' :
                    category === 'vehicle' ? 'e.g. Hilux pickup for site inspection' :
                    category === 'personnel' ? 'e.g. 2 pump mechanics for night shift' :
                    'Describe the item or service requested...'
                  }
                  className="text-sm rounded-xl h-10"
                />
              </div>

              {/* Quantity + Unit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                    Quantity <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={quantity}
                    onChange={e => setQuantity(e.target.value)}
                    placeholder="0"
                    className="text-sm rounded-xl h-10"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                    Unit of Measure
                  </label>
                  <select
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                    className="w-full h-10 text-sm px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                  >
                    {UNIT_OPTIONS.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Urgency */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 block">
                  Priority / Urgency
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {URGENCIES.map(u => {
                    const cfg = URGENCY_CONFIG[u];
                    const isSelected = urgency === u;
                    return (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setUrgency(u)}
                        className={cn(
                          'flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl border text-xs font-semibold transition-all shadow-xs cursor-pointer',
                          isSelected
                            ? 'border-slate-900 dark:border-white bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                        )}
                      >
                        <span className={cn('h-2 w-2 rounded-full', cfg.dot)} />
                        <span>{cfg.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dates: Request Date & Needed by */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" /> Request Date
                  </label>
                  <Input
                    type="date"
                    value={requestDate}
                    onChange={e => setRequestDate(e.target.value)}
                    className="text-sm rounded-xl h-10"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" /> Needed By <span className="text-slate-400 font-normal">(optional)</span>
                  </label>
                  <Input
                    type="date"
                    value={neededBy}
                    onChange={e => setNeededBy(e.target.value)}
                    className="text-sm rounded-xl h-10"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70">
          <p className="text-[11px] text-slate-400 hidden sm:block">
            {canSubmit ? 'Ready to submit requisition.' : 'Please enter requester name and what is needed.'}
          </p>
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              className="flex-1 sm:flex-none px-5 rounded-xl cursor-pointer"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="flex-1 sm:flex-none px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm cursor-pointer"
              disabled={!canSubmit || saving}
              onClick={handleSubmit}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : isEdit ? (
                'Save Changes'
              ) : (
                'Submit Request'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
