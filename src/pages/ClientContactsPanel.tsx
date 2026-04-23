import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import type { ClientContact } from '../store/appStore';
import { cn, generateId } from '../lib/utils';
import { useTheme } from '../hooks/useTheme';
import { X, Plus, Pencil, Save, Trash2, UserCheck, Phone, Mail, Briefcase, MapPin, FileText, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from '../components/ui/toast';

interface Props {
  clientName: string;
  onClose: () => void;
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
});

export function ClientContactsPanel({ clientName, onClose }: Props) {
  const { isDark } = useTheme();
  const contacts = useAppStore(s => s.clientContacts);
  const sites = useAppStore(s => s.sites);
  const addClientContact = useAppStore(s => s.addClientContact);
  const updateClientContact = useAppStore(s => s.updateClientContact);
  const deleteClientContact = useAppStore(s => s.deleteClientContact);

  const clientContacts = contacts.filter(c => c.clientName === clientName);
  const clientSites = sites.filter(s => s.client === clientName);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState(EMPTY_CONTACT());

  const inputCls = cn(
    'flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500',
    isDark ? 'bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
  );
  const labelCls = cn('text-xs font-semibold mb-1', isDark ? 'text-slate-400' : 'text-slate-500');

  const handleAdd = () => {
    if (!draft.name.trim()) { toast.error('Name is required'); return; }
    addClientContact({ ...draft, id: generateId(), clientName, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    setDraft(EMPTY_CONTACT());
    setShowAdd(false);
    toast.success('Contact added');
  };

  const startEdit = (c: ClientContact) => {
    setEditingId(c.id);
    setDraft({ name: c.name, phone: c.phone || '', email: c.email || '', position: c.position || '', note: c.note || '', clientName: c.clientName, siteIds: c.siteIds || [], siteNames: c.siteNames || [], isActive: c.isActive });
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

  const CardRow = ({ icon, value }: { icon: React.ReactNode; value?: string }) =>
    value ? (
      <div className="flex items-center gap-1.5 text-xs text-slate-500 truncate">
        {icon}
        <span className="truncate">{value}</span>
      </div>
    ) : null;

  const overlayBg = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4';
  const cardCls = cn('relative w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]', isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200');

  const ContactForm = ({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) => (
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
      {clientSites.length > 0 && (
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

  return (
    <div className={overlayBg} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={cardCls}>
        {/* Header */}
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 style-scroll">
          {/* Add new */}
          {!showAdd && editingId === null && (
            <Button onClick={() => { setShowAdd(true); setDraft(EMPTY_CONTACT()); }} variant="outline" className={cn('w-full gap-2 h-9 text-xs border-dashed', isDark ? 'border-slate-600 text-slate-400 hover:bg-slate-800' : 'border-slate-300 text-slate-500 hover:bg-slate-50')}>
              <Plus className="w-3.5 h-3.5" /> Add Contact
            </Button>
          )}
          {showAdd && <ContactForm onSave={handleAdd} onCancel={() => setShowAdd(false)} />}

          {/* Contact list */}
          {clientContacts.length === 0 && !showAdd && (
            <div className="py-10 text-center">
              <UserCheck className="w-10 h-10 mx-auto text-slate-300 mb-3" />
              <p className={cn('text-sm', isDark ? 'text-slate-400' : 'text-slate-500')}>No contacts yet.</p>
              <p className={cn('text-xs mt-1', isDark ? 'text-slate-500' : 'text-slate-400')}>They'll appear here when you log External Communications with a Contact Person.</p>
            </div>
          )}

          {clientContacts.map(contact => (
            <div key={contact.id}>
              {editingId === contact.id ? (
                <ContactForm onSave={saveEdit} onCancel={() => setEditingId(null)} />
              ) : (
                <div className={cn('rounded-xl border p-4 transition-all', isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200', !contact.isActive && 'opacity-60')}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn('font-semibold text-sm', isDark ? 'text-slate-100' : 'text-slate-800')}>{contact.name}</span>
                        <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-bold border', contact.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200')}>
                          {contact.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <CardRow icon={<Briefcase className="w-3 h-3 shrink-0" />} value={contact.position} />
                      <CardRow icon={<Phone className="w-3 h-3 shrink-0" />} value={contact.phone} />
                      <CardRow icon={<Mail className="w-3 h-3 shrink-0" />} value={contact.email} />
                      <CardRow icon={<FileText className="w-3 h-3 shrink-0" />} value={contact.note} />
                      {(contact.siteNames?.length ?? 0) > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {contact.siteNames!.map((s, i) => (
                            <span key={i} className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', isDark ? 'bg-indigo-900/40 text-indigo-300' : 'bg-indigo-50 text-indigo-700')}>
                              📍 {s}
                            </span>
                          ))}
                        </div>
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
                        onClick={async () => { deleteClientContact(contact.id); toast.success('Contact removed'); }}
                        className={cn('p-1.5 rounded-lg transition-colors', isDark ? 'text-slate-400 hover:bg-red-900/30 hover:text-red-400' : 'text-slate-400 hover:bg-red-50 hover:text-red-600')}
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
