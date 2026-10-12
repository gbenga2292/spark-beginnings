import React, { useState, useEffect } from 'react';
import {
  X, Plus, Trash2, Sparkles, Building2, User, Briefcase, Mail,
  Phone, MapPin, FileText, Tag, Image as ImageIcon, Check, Star, AlertCircle
} from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { toast } from '@/src/components/ui/toast';
import { cn } from '@/src/lib/utils';
import { useTheme } from '@/src/hooks/useTheme';
import { BusinessCardScannerModal } from './BusinessCardScannerModal';
import { ExtractedBusinessCardData } from '@/src/lib/businessCardAiService';

export interface PhonebookContact {
  id?: string;
  name: string;
  position?: string;
  company?: string;
  category: 'Client' | 'Vendor' | 'Partner' | 'Contractor' | 'Government' | 'Other';
  phone?: string;
  phones: string[];
  email?: string;
  emails: string[];
  address?: string;
  addresses: string[];
  note?: string;
  card_image_url?: string;
  tags: string[];
  is_favorite?: boolean;
  created_at?: string;
  updated_at?: string;
}

interface ContactFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (contact: PhonebookContact) => Promise<void>;
  initialData?: PhonebookContact | null;
  existingCompanies?: string[];
}

const CATEGORIES = ['Client', 'Vendor', 'Partner', 'Contractor', 'Government', 'Other'] as const;

export function ContactFormModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  existingCompanies = []
}: ContactFormModalProps) {
  const { isDark } = useTheme();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form Fields
  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [company, setCompany] = useState('');
  const [category, setCategory] = useState<PhonebookContact['category']>('Client');
  const [phones, setPhones] = useState<string[]>(['']);
  const [emails, setEmails] = useState<string[]>(['']);
  const [addresses, setAddresses] = useState<string[]>(['']);
  const [note, setNote] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [cardImageUrl, setCardImageUrl] = useState<string | undefined>(undefined);
  const [showCardPreview, setShowCardPreview] = useState(false);

  // Populate initial data when editing or opening
  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setPosition(initialData.position || '');
      setCompany(initialData.company || '');
      setCategory(initialData.category || 'Client');
      setPhones(initialData.phones?.length ? initialData.phones : initialData.phone ? [initialData.phone] : ['']);
      setEmails(initialData.emails?.length ? initialData.emails : initialData.email ? [initialData.email] : ['']);
      setAddresses(initialData.addresses?.length ? initialData.addresses : initialData.address ? [initialData.address] : ['']);
      setNote(initialData.note || '');
      setTags(initialData.tags || []);
      setIsFavorite(Boolean(initialData.is_favorite));
      setCardImageUrl(initialData.card_image_url);
    } else {
      resetForm();
    }
  }, [initialData, isOpen]);

  const resetForm = () => {
    setName('');
    setPosition('');
    setCompany('');
    setCategory('Client');
    setPhones(['']);
    setEmails(['']);
    setAddresses(['']);
    setNote('');
    setTagInput('');
    setTags([]);
    setIsFavorite(false);
    setCardImageUrl(undefined);
    setShowCardPreview(false);
  };

  // AI Scanner Callback: auto-fills the form
  const handleScanComplete = (extracted: ExtractedBusinessCardData) => {
    if (extracted.name) setName(extracted.name);
    if (extracted.position) setPosition(extracted.position);
    if (extracted.company) setCompany(extracted.company);
    if (extracted.category) setCategory(extracted.category);
    if (extracted.phones && extracted.phones.length > 0) {
      setPhones(extracted.phones);
    }
    if (extracted.emails && extracted.emails.length > 0) {
      setEmails(extracted.emails);
    }
    if (extracted.addresses && extracted.addresses.length > 0) {
      setAddresses(extracted.addresses);
    }
    if (extracted.note) {
      setNote(prev => prev ? `${prev}\n${extracted.note}` : extracted.note);
    }
    if (extracted.tags && extracted.tags.length > 0) {
      setTags(prev => Array.from(new Set([...prev, ...extracted.tags])));
    }
    if (extracted.cardImageUrl) {
      setCardImageUrl(extracted.cardImageUrl);
    }

    toast.success('Form auto-filled from business card! Please review and click Save.');
  };

  // Dynamic Array Handlers
  const addPhone = () => setPhones(prev => [...prev, '']);
  const updatePhone = (index: number, val: string) =>
    setPhones(prev => prev.map((p, i) => (i === index ? val : p)));
  const removePhone = (index: number) =>
    setPhones(prev => (prev.length > 1 ? prev.filter((_, i) => i !== index) : ['']));

  const addEmail = () => setEmails(prev => [...prev, '']);
  const updateEmail = (index: number, val: string) =>
    setEmails(prev => prev.map((e, i) => (i === index ? val : e)));
  const removeEmail = (index: number) =>
    setEmails(prev => (prev.length > 1 ? prev.filter((_, i) => i !== index) : ['']));

  const addAddress = () => setAddresses(prev => [...prev, '']);
  const updateAddress = (index: number, val: string) =>
    setAddresses(prev => prev.map((a, i) => (i === index ? val : a)));
  const removeAddress = (index: number) =>
    setAddresses(prev => (prev.length > 1 ? prev.filter((_, i) => i !== index) : ['']));

  // Tag Handlers
  const handleAddTag = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    e.preventDefault();
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags(prev => [...prev, trimmed]);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(prev => prev.filter(t => t !== tagToRemove));
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Contact name is required.');
      return;
    }

    const cleanPhones = phones.map(p => p.trim()).filter(Boolean);
    const cleanEmails = emails.map(e => e.trim()).filter(Boolean);
    const cleanAddresses = addresses.map(a => a.trim()).filter(Boolean);

    setIsSaving(true);
    try {
      await onSave({
        ...(initialData?.id ? { id: initialData.id } : {}),
        name: name.trim(),
        position: position.trim() || undefined,
        company: company.trim() || undefined,
        category,
        phone: cleanPhones[0] || undefined,
        phones: cleanPhones,
        email: cleanEmails[0] || undefined,
        emails: cleanEmails,
        address: cleanAddresses[0] || undefined,
        addresses: cleanAddresses,
        note: note.trim() || undefined,
        tags,
        is_favorite: isFavorite,
        card_image_url: cardImageUrl
      });

      toast.success(initialData?.id ? 'Contact updated successfully!' : 'Contact saved to phonebook!');
      onClose();
    } catch (err: any) {
      console.error('Failed to save contact:', err);
      toast.error(err.message || 'Failed to save contact.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const inputClass = cn(
    'flex h-9 w-full rounded-lg border px-3 py-1.5 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500',
    isDark
      ? 'bg-slate-800/80 border-slate-700 text-slate-100 placeholder:text-slate-500'
      : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
  );

  const labelClass = cn('text-xs font-semibold mb-1 flex items-center gap-1.5', isDark ? 'text-slate-300' : 'text-slate-700');

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
        <div
          className={cn(
            'relative w-full max-w-2xl rounded-2xl shadow-2xl border flex flex-col max-h-[92vh] overflow-hidden transition-all',
            isDark ? 'bg-slate-900 border-slate-700/80 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          )}
        >
          {/* Header */}
          <div className={cn(
            'flex items-center justify-between px-6 py-4 border-b shrink-0',
            isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-100 bg-slate-50/60'
          )}>
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center font-bold">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold leading-tight">
                  {initialData?.id ? 'Edit Contact' : 'Add New Contact'}
                </h2>
                <p className={cn('text-xs', isDark ? 'text-slate-400' : 'text-slate-500')}>
                  Directory of clients, vendors, and business cards
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsFavorite(!isFavorite)}
                title={isFavorite ? 'Starred Favorite' : 'Mark as Favorite'}
                className={cn(
                  'p-2 rounded-xl border transition-all',
                  isFavorite
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                    : isDark
                      ? 'border-slate-700 text-slate-400 hover:text-slate-200'
                      : 'border-slate-200 text-slate-400 hover:text-slate-600'
                )}
              >
                <Star className={cn('w-4 h-4', isFavorite && 'fill-amber-400')} />
              </button>
              <button
                type="button"
                onClick={onClose}
                className={cn(
                  'p-2 rounded-xl transition-colors',
                  isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
                )}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* AI Scanner Banner */}
          <div className={cn(
            'px-6 py-3 border-b flex items-center justify-between gap-3 shrink-0',
            isDark
              ? 'bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-blue-950/40 border-blue-800/30'
              : 'bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 border-blue-100'
          )}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-7 w-7 rounded-lg bg-blue-500/20 text-blue-500 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold truncate text-blue-700 dark:text-blue-300">
                  Have a Business Card?
                </div>
                <div className="text-[11px] truncate text-slate-500 dark:text-slate-400">
                  Take a photo or upload card — AI will fill out this form for you!
                </div>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => setScannerOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 text-xs shadow-xs shrink-0 font-medium"
            >
              <Sparkles className="w-3.5 h-3.5" /> Scan Business Card
            </Button>
          </div>

          {/* Business Card Photo Attachment Preview (if any) */}
          {cardImageUrl && (
            <div className={cn('px-6 py-2.5 border-b flex items-center justify-between', isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-100')}>
              <div className="flex items-center gap-3">
                <img
                  src={cardImageUrl}
                  alt="Card Preview"
                  className="w-12 h-8 object-cover rounded-md border border-slate-600 cursor-pointer shadow-xs"
                  onClick={() => setShowCardPreview(true)}
                />
                <div className="text-xs">
                  <div className="font-semibold text-blue-500 dark:text-blue-400 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Scanned Business Card Attached
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCardPreview(true)}
                    className="text-[11px] text-slate-400 hover:underline"
                  >
                    Click to view full card
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCardImageUrl(undefined)}
                title="Remove attached photo"
                className="text-xs text-rose-400 hover:underline flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" /> Remove Card Photo
              </button>
            </div>
          )}

          {/* Form Fields Body */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Primary Details: Name & Category */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className={labelClass}>
                  <User className="w-3.5 h-3.5 text-blue-500" />
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Engr. Babatunde Adeleke"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Category</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value as any)}
                  className={inputClass}
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Position & Company */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>
                  <Briefcase className="w-3.5 h-3.5 text-blue-500" />
                  Position / Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Project Director / Procurement Lead"
                  value={position}
                  onChange={e => setPosition(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>
                  <Building2 className="w-3.5 h-3.5 text-blue-500" />
                  Company / Organization
                </label>
                <input
                  type="text"
                  list="companies-list"
                  placeholder="e.g. Julius Berger Nigeria"
                  value={company}
                  onChange={e => setCompany(e.target.value)}
                  className={inputClass}
                />
                {existingCompanies.length > 0 && (
                  <datalist id="companies-list">
                    {existingCompanies.map(c => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                )}
              </div>
            </div>

            {/* Multiple Phone Numbers */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className={labelClass}>
                  <Phone className="w-3.5 h-3.5 text-blue-500" />
                  Phone Numbers (Multiple)
                </label>
                <button
                  type="button"
                  onClick={addPhone}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-500 font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add Phone
                </button>
              </div>
              {phones.map((phoneVal, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="tel"
                    placeholder={idx === 0 ? 'Primary Phone (e.g. +234 803 123 4567)' : `Additional Phone #${idx + 1}`}
                    value={phoneVal}
                    onChange={e => updatePhone(idx, e.target.value)}
                    className={inputClass}
                  />
                  {phones.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePhone(idx)}
                      className={cn(
                        'p-2 rounded-lg text-slate-400 hover:text-rose-400 transition-colors',
                        isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
                      )}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Multiple Email Addresses */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className={labelClass}>
                  <Mail className="w-3.5 h-3.5 text-blue-500" />
                  Email Addresses (Multiple)
                </label>
                <button
                  type="button"
                  onClick={addEmail}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-500 font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add Email
                </button>
              </div>
              {emails.map((emailVal, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="email"
                    placeholder={idx === 0 ? 'Primary Email (e.g. contact@client.com)' : `Additional Email #${idx + 1}`}
                    value={emailVal}
                    onChange={e => updateEmail(idx, e.target.value)}
                    className={inputClass}
                  />
                  {emails.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeEmail(idx)}
                      className={cn(
                        'p-2 rounded-lg text-slate-400 hover:text-rose-400 transition-colors',
                        isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
                      )}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Multiple Addresses */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className={labelClass}>
                  <MapPin className="w-3.5 h-3.5 text-blue-500" />
                  Physical / Branch Addresses (Multiple)
                </label>
                <button
                  type="button"
                  onClick={addAddress}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-500 font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add Address
                </button>
              </div>
              {addresses.map((addrVal, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder={idx === 0 ? 'Primary Address (e.g. 14 Marina Road, Lagos Island)' : `Branch / Site Address #${idx + 1}`}
                    value={addrVal}
                    onChange={e => updateAddress(idx, e.target.value)}
                    className={inputClass}
                  />
                  {addresses.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeAddress(idx)}
                      className={cn(
                        'p-2 rounded-lg text-slate-400 hover:text-rose-400 transition-colors',
                        isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
                      )}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Tags Input */}
            <div>
              <label className={labelClass}>
                <Tag className="w-3.5 h-3.5 text-blue-500" />
                Tags & Badges
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Type tag & press enter (e.g. VIP, Subcontractor, Lagos HQ)"
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={handleAddTag}
                  className={inputClass}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddTag}
                  className="text-xs shrink-0"
                >
                  Add Tag
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {tags.map(t => (
                    <span
                      key={t}
                      className={cn(
                        'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border',
                        isDark
                          ? 'bg-blue-500/15 border-blue-500/30 text-blue-300'
                          : 'bg-blue-50 border-blue-200 text-blue-700'
                      )}
                    >
                      {t}
                      <button
                        type="button"
                        onClick={() => removeTag(t)}
                        className="hover:text-rose-400 ml-0.5"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className={labelClass}>
                <FileText className="w-3.5 h-3.5 text-blue-500" />
                Notes & Additional Remarks
              </label>
              <textarea
                rows={3}
                placeholder="Any special notes, meeting background, RC number, or website..."
                value={note}
                onChange={e => setNote(e.target.value)}
                className={cn(inputClass, 'h-auto py-2 resize-none')}
              />
            </div>
          </form>

          {/* Footer Actions */}
          <div className={cn(
            'flex items-center justify-between px-6 py-4 border-t shrink-0',
            isDark ? 'border-slate-800 bg-slate-900/60' : 'border-slate-100 bg-slate-50/60'
          )}>
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isSaving}
              className="text-xs"
            >
              Cancel
            </Button>

            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-2 text-xs font-semibold shadow-xs"
            >
              {isSaving ? 'Saving...' : initialData?.id ? 'Update Contact' : 'Save Contact'}
            </Button>
          </div>
        </div>
      </div>

      {/* AI Business Card Scanner Modal */}
      <BusinessCardScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanComplete={handleScanComplete}
      />

      {/* Full-size Business Card Photo Lightbox */}
      {showCardPreview && cardImageUrl && (
        <div
          onClick={() => setShowCardPreview(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md cursor-pointer animate-in fade-in"
        >
          <div className="relative max-w-3xl max-h-[85vh] rounded-2xl overflow-hidden shadow-2xl border border-slate-700">
            <img src={cardImageUrl} alt="Business Card Full" className="w-full h-full object-contain" />
            <button
              onClick={() => setShowCardPreview(false)}
              className="absolute top-3 right-3 p-2 rounded-full bg-slate-900/80 text-white hover:bg-slate-800 shadow"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
