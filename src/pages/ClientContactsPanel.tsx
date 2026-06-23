import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import type { ClientContact } from '../store/appStore';
import { cn, generateId } from '../lib/utils';
import { useTheme } from '../hooks/useTheme';
import { X, Plus, Pencil, Save, Trash2, UserCheck, Phone, Mail, Briefcase, MapPin, FileText, CheckCircle2, XCircle, Star } from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from '../components/ui/toast';

interface Props {
  clientName: string;
  onClose: () => void;
  inline?: boolean;
  /** When provided, only contacts linked to this site (or marked Principal) are shown */
  siteId?: string;
}

const EMPTY_CONTACT = (): Omit<ClientContact, 'id' | 'createdAt' | 'updatedAt'> => ({
  name: '',
  phone: '',
  email: '',
  position: '',
  note: '',
  clientName: '',
  siteIds: [],
  siteNames: [],
  isActive: true,
  isPrincipal: false,
});

const CardRow = ({ icon, value }: { icon: React.ReactNode; value?: string }) =>
  value ? (
    <div className="flex items-center gap-1.5 text-xs text-slate-500 truncate">
      {icon}
      <span className="truncate">{value}</span>
    </div>
  ) : null;

interface ContactFormProps {
  draft: ReturnType<typeof EMPTY_CONTACT>;
  setDraft: React.Dispatch<React.SetStateAction<ReturnType<typeof EMPTY_CONTACT>>>;
  isDark: boolean;
  clientSites: any[];
  onSave: () => void;
  onCancel: () => void;
  toggleSite: (site: { id: string; name: string }, currentIds: string[], currentNames: string[]) => void;
}

const ContactForm = ({ draft, setDraft, isDark, clientSites, onSave, onCancel, toggleSite }: ContactFormProps) => {
  const inputCls = cn(
    'flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500',
    isDark ? 'bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
  );
  const labelCls = cn('text-xs font-semibold mb-1', isDark ? 'text-slate-400' : 'text-slate-500');

  return (
    <div className={cn('rounded-xl border p-4 space-y-3', isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200')}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className={labelCls}>Name *</div>
          <input className={inputCls} placeholder="Full name" value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} />
        </div>
        <div>
          <div className={labelCls}>Position / Title</div>
          <input className={inputCls} placeholder="e.g. Site Manager" value={draft.position} onChange={e => setDraft(d => ({ ...d, position: e.target.value }))} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className={labelCls}>Phone</div>
          <input className={inputCls} placeholder="+234 …" value={draft.phone} onChange={e => setDraft(d => ({ ...d, phone: e.target.value }))} />
        </div>
        <div>
          <div className={labelCls}>Email</div>
          <input className={inputCls} placeholder="email@example.com" value={draft.email} onChange={e => setDraft(d => ({ ...d, email: e.target.value }))} />
        </div>
      </div>
      <div>
        <div className={labelCls}>Note</div>
        <input className={inputCls} placeholder="Any relevant info…" value={draft.note} onChange={e => setDraft(d => ({ ...d, note: e.target.value }))} />
      </div>

      {/* ── Principal Toggle ─────────────────────────────────────────── */}
      <div className={cn('rounded-lg border p-3 flex items-start gap-3', isDark ? 'bg-slate-700/50 border-slate-600' : 'bg-amber-50 border-amber-200')}>
        <button
          type="button"
          onClick={() => setDraft(d => ({ ...d, isPrincipal: !d.isPrincipal }))}
          className={cn(
            'flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all shrink-0',
            draft.isPrincipal
              ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
              : isDark
                ? 'bg-slate-700 border-slate-500 text-slate-300 hover:border-amber-400'
                : 'bg-white border-amber-300 text-amber-700 hover:bg-amber-50'
          )}
        >
          <Star className={cn('w-3 h-3', draft.isPrincipal && 'fill-white')} />
          {draft.isPrincipal ? 'Principal Contact' : 'Mark as Principal'}
        </button>
        <p className={cn('text-xs leading-relaxed', isDark ? 'text-slate-400' : 'text-amber-700')}>
          <strong>Principal contacts</strong> appear on <em>all sites</em> for this client — current and future — regardless of linked sites below.
        </p>
      </div>

      {/* ── Linked Sites (only relevant when not Principal) ──────────── */}
      {!draft.isPrincipal && clientSites.length > 0 && (
        <div>
          <div className={labelCls}>Linked Sites</div>
          <div className="flex flex-wrap gap-1.5">
            {clientSites.map(s => {
              const selected = (draft.siteIds || []).includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleSite(s, draft.siteIds || [], draft.siteNames || [])}
                  className={cn('text-xs px-2.5 py-1 rounded-full border font-medium transition-all', selected ? 'bg-indigo-600 text-white border-indigo-600' : isDark ? 'bg-slate-700 border-slate-600 text-slate-300 hover:border-indigo-500' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-400')}
                >
                  📍 {s.name}
                </button>
              );
            })}
          </div>
          <p className={cn('text-[10px] mt-1.5', isDark ? 'text-slate-500' : 'text-slate-400')}>
            Select which sites this contact is associated with. Leave blank to link later.
          </p>
        </div>
      )}

      {draft.isPrincipal && (
        <div className={cn('text-xs px-3 py-1.5 rounded-lg', isDark ? 'bg-amber-900/20 text-amber-300' : 'bg-amber-50 text-amber-700')}>
          ⭐ This contact will automatically appear on all sites for <strong>{draft.clientName || 'this client'}</strong>.
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className={labelCls}>Status:</div>
        <button
          type="button"
          onClick={() => setDraft(d => ({ ...d, isActive: !d.isActive }))}
          className={cn('flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-semibold border transition-all', draft.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-red-50 text-red-600 border-red-200')}
        >
          {draft.isActive ? <><CheckCircle2 className="w-3 h-3" /> Active</> : <><XCircle className="w-3 h-3" /> Inactive</>}
        </button>
      </div>
      <div className="flex gap-2 pt-1">
        <Button onClick={onSave} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 flex-1 h-9 text-xs">
          <Save className="w-3.5 h-3.5" /> Save Contact
        </Button>
        <Button variant="outline" onClick={onCancel} className="h-9 text-xs px-4"><X className="w-3.5 h-3.5" /></Button>
      </div>
    </div>
  );
};

export function ClientContactsPanel({ clientName, onClose, inline = false, siteId }: Props) {
  const { isDark } = useTheme();
  const contacts = useAppStore(s => s.clientContacts);
  const sites = useAppStore(s => s.sites);
  const pendingSites = useAppStore(s => s.pendingSites);
  const addClientContact = useAppStore(s => s.addClientContact);
  const updateClientContact = useAppStore(s => s.updateClientContact);
  const deleteClientContact = useAppStore(s => s.deleteClientContact);

  // All contacts for this client
  const allClientContacts = contacts.filter(c => c.clientName.trim().toLowerCase() === clientName.trim().toLowerCase());

  // When siteId is provided (viewed from Site360): show only contacts for this site OR principal contacts
  const clientContacts = siteId
    ? allClientContacts.filter(c => c.isPrincipal || (c.siteIds || []).includes(siteId))
    : allClientContacts;

  const clientSites = [
    ...sites.filter(s => s.client.trim().toLowerCase() === clientName.trim().toLowerCase()).map(s => ({
      id: s.id,
      name: s.name,
      isPending: false,
    })),
    ...pendingSites.filter(ps => ps.clientName.trim().toLowerCase() === clientName.trim().toLowerCase() && ps.status === 'Pending').map(ps => ({
      id: ps.id,
      name: `${ps.siteName} (Pending)`,
      isPending: true,
    }))
  ];

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState(EMPTY_CONTACT());

  const handleAdd = () => {
    if (!draft.name.trim()) { toast.error('Name is required'); return; }
    addClientContact({ ...draft, id: generateId(), clientName, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    setDraft(EMPTY_CONTACT());
    setShowAdd(false);
    toast.success('Contact added');
  };

  const startEdit = (c: ClientContact) => {
    setEditingId(c.id);
    setDraft({ name: c.name, phone: c.phone || '', email: c.email || '', position: c.position || '', note: c.note || '', clientName: c.clientName, siteIds: c.siteIds || [], siteNames: c.siteNames || [], isActive: c.isActive, isPrincipal: c.isPrincipal || false });
    setShowAdd(false);
  };

  const saveEdit = () => {
    if (!draft.name.trim()) { toast.error('Name is required'); return; }
    updateClientContact(editingId!, draft);
    setEditingId(null);
    toast.success('Contact updated');
  };

  const toggleSite = (site: { id: string; name: string }, currentIds: string[], currentNames: string[]) => {
    if (currentIds.includes(site.id)) {
      setDraft(d => ({ ...d, siteIds: currentIds.filter(id => id !== site.id), siteNames: currentNames.filter(n => n !== site.name) }));
    } else {
      setDraft(d => ({ ...d, siteIds: [...currentIds, site.id], siteNames: [...currentNames, site.name] }));
    }
  };

  const cardCls = cn(
    'relative w-full rounded-2xl border overflow-hidden flex flex-col',
    inline ? 'shadow-none border-0 max-h-full' : 'max-w-2xl shadow-2xl max-h-[90vh]',
    isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
  );

  const renderContactCard = (contact: ClientContact) => (
    <div className={cn('rounded-xl border p-4 transition-all', isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200', !contact.isActive && 'opacity-60')}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('font-semibold text-sm', isDark ? 'text-slate-100' : 'text-slate-800')}>{contact.name}</span>
            {contact.isPrincipal && (
              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold border bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700">
                <Star className="w-2.5 h-2.5 fill-amber-500 dark:fill-amber-400" /> Principal
              </span>
            )}
            <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-bold border', contact.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200')}>
              {contact.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          <CardRow icon={<Briefcase className="w-3 h-3 shrink-0" />} value={contact.position} />
          <CardRow icon={<Phone className="w-3 h-3 shrink-0" />} value={contact.phone} />
          <CardRow icon={<Mail className="w-3 h-3 shrink-0" />} value={contact.email} />
          <CardRow icon={<FileText className="w-3 h-3 shrink-0" />} value={contact.note} />
          {!contact.isPrincipal && (contact.siteNames?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {contact.siteNames!.map((s, i) => (
                <span key={i} className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', isDark ? 'bg-indigo-900/40 text-indigo-300' : 'bg-indigo-50 text-indigo-700')}>
                  📍 {s}
                </span>
              ))}
            </div>
          )}
          {contact.isPrincipal && (
            <span className={cn('text-[10px]', isDark ? 'text-amber-400' : 'text-amber-600')}>Visible on all sites for this client</span>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={() => startEdit(contact)} className={cn('p-1.5 rounded-lg transition-colors', isDark ? 'text-slate-400 hover:bg-slate-700 hover:text-indigo-400' : 'text-slate-400 hover:bg-slate-100 hover:text-indigo-600')} title="Edit">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { updateClientContact(contact.id, { isActive: !contact.isActive }); toast.success(contact.isActive ? 'Marked inactive' : 'Marked active'); }}
            className={cn('p-1.5 rounded-lg transition-colors', isDark ? 'text-slate-400 hover:bg-slate-700' : 'text-slate-400 hover:bg-slate-100')}
            title={contact.isActive ? 'Mark inactive' : 'Mark active'}
          >
            {contact.isActive ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
          </button>
          <button
            onClick={() => { deleteClientContact(contact.id); toast.success('Contact removed'); }}
            className={cn('p-1.5 rounded-lg transition-colors', isDark ? 'text-slate-400 hover:bg-red-900/30 hover:text-red-400' : 'text-slate-400 hover:bg-red-50 hover:text-red-600')}
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  const bodyContent = (
    <>
      {/* Add new */}
      {!showAdd && editingId === null && (
        <Button onClick={() => { setShowAdd(true); setDraft({ ...EMPTY_CONTACT(), clientName }); }} variant="outline" className={cn('w-full gap-2 h-9 text-xs border-dashed', isDark ? 'border-slate-600 text-slate-400 hover:bg-slate-800' : 'border-slate-300 text-slate-500 hover:bg-slate-50')}>
          <Plus className="w-3.5 h-3.5" /> Add Contact
        </Button>
      )}
      {showAdd && <ContactForm draft={draft} setDraft={setDraft} isDark={isDark} clientSites={clientSites} onSave={handleAdd} onCancel={() => setShowAdd(false)} toggleSite={toggleSite} />}

      {/* Site-scoped notice */}
      {siteId && !showAdd && editingId === null && (
        <div className={cn('flex items-center gap-2 text-xs px-3 py-2 rounded-lg border', isDark ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-blue-50 border-blue-100 text-blue-600')}>
          <MapPin className="w-3 h-3 shrink-0" />
          Showing contacts linked to this site + all Principal contacts.
          {allClientContacts.length > clientContacts.length && (
            <span className="ml-auto font-semibold">{allClientContacts.length - clientContacts.length} hidden (other sites)</span>
          )}
        </div>
      )}

      {/* Empty state */}
      {clientContacts.length === 0 && !showAdd && (
        <div className="py-10 text-center">
          <UserCheck className="w-10 h-10 mx-auto text-slate-300 mb-3" />
          <p className={cn('text-sm', isDark ? 'text-slate-400' : 'text-slate-500')}>
            {siteId ? 'No contacts linked to this site.' : 'No contacts yet.'}
          </p>
          <p className={cn('text-xs mt-1', isDark ? 'text-slate-500' : 'text-slate-400')}>
            {siteId
              ? 'Add a contact and link it to this site, or mark one as Principal to appear everywhere.'
              : "They'll appear here when you log External Communications with a Contact Person."}
          </p>
        </div>
      )}

      {/* Principal contacts first, then site-specific */}
      {clientContacts.length > 0 && (() => {
        const principals = clientContacts.filter(c => c.isPrincipal);
        const siteSpecific = clientContacts.filter(c => !c.isPrincipal);
        return (
          <>
            {principals.length > 0 && (
              <div className="space-y-2">
                {siteId && <p className={cn('text-[10px] font-bold uppercase tracking-wider', isDark ? 'text-amber-400' : 'text-amber-600')}>⭐ Principal Contacts</p>}
                {principals.map(contact => (
                  <div key={contact.id}>
                    {editingId === contact.id
                      ? <ContactForm draft={draft} setDraft={setDraft} isDark={isDark} clientSites={clientSites} onSave={saveEdit} onCancel={() => setEditingId(null)} toggleSite={toggleSite} />
                      : renderContactCard(contact)}
                  </div>
                ))}
              </div>
            )}
            {siteSpecific.length > 0 && (
              <div className="space-y-2">
                {siteId && principals.length > 0 && <p className={cn('text-[10px] font-bold uppercase tracking-wider', isDark ? 'text-slate-400' : 'text-slate-500')}>📍 Site Contacts</p>}
                {siteSpecific.map(contact => (
                  <div key={contact.id}>
                    {editingId === contact.id
                      ? <ContactForm draft={draft} setDraft={setDraft} isDark={isDark} clientSites={clientSites} onSave={saveEdit} onCancel={() => setEditingId(null)} toggleSite={toggleSite} />
                      : renderContactCard(contact)}
                  </div>
                ))}
              </div>
            )}
          </>
        );
      })()}
    </>
  );

  const headerContent = (
    <div className={cn('flex items-center justify-between px-5 py-4 border-b flex-shrink-0', isDark ? 'border-slate-700' : 'border-slate-100')}>
      <div>
        <h2 className={cn('text-base font-semibold flex items-center gap-2', isDark ? 'text-slate-100' : 'text-slate-900')}>
          <UserCheck className="w-4 h-4 text-indigo-500" />
          Client Contacts — {clientName}
        </h2>
        <p className={cn('text-xs mt-0.5', isDark ? 'text-slate-400' : 'text-slate-500')}>
          Contacts auto-saved from External Comm Logs. Edit details here; changes update all logs.
        </p>
      </div>
      <button onClick={onClose} className={cn('p-1.5 rounded-lg transition-colors', isDark ? 'text-slate-500 hover:bg-slate-800' : 'text-slate-400 hover:bg-slate-100')}>
        <X className="w-4 h-4" />
      </button>
    </div>
  );

  if (inline) {
    return (
      <div className={cardCls}>
        {headerContent}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 style-scroll">
          {bodyContent}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={cardCls}>
        {headerContent}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 style-scroll">
          {bodyContent}
        </div>
      </div>
    </div>
  );
}
