import React, { useState } from 'react';
import {
  X, Pencil, Trash2, Star, Phone, Mail, MapPin, Building2,
  Briefcase, FileText, Tag, Copy, Check, ExternalLink, Image as ImageIcon,
  User, Calendar, Sparkles
} from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { toast } from '@/src/components/ui/toast';
import { cn } from '@/src/lib/utils';
import { useTheme } from '@/src/hooks/useTheme';
import type { PhonebookContact } from './ContactFormModal';

export interface ContactDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact: PhonebookContact | null;
  onEdit: (contact: PhonebookContact) => void;
  onDelete: (contact: PhonebookContact) => void;
  onToggleFavorite: (contact: PhonebookContact) => void;
}

export function ContactDetailModal({
  isOpen,
  onClose,
  contact,
  onEdit,
  onDelete,
  onToggleFavorite,
}: ContactDetailModalProps) {
  const { isDark } = useTheme();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showCardLightbox, setShowCardLightbox] = useState(false);

  if (!isOpen || !contact) return null;

  // Initials generator
  const initials = contact.name
    ? contact.name
        .split(' ')
        .map((p) => p[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '??';

  const copyText = (text: string, key: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`Copied ${label} to clipboard!`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Compile all phone numbers (primary + multiple)
  const allPhones: string[] = [];
  if (contact.phone && !contact.phones?.includes(contact.phone)) {
    allPhones.push(contact.phone);
  }
  if (contact.phones?.length) {
    contact.phones.forEach((p) => {
      const trimmed = p.trim();
      if (trimmed && !allPhones.includes(trimmed)) allPhones.push(trimmed);
    });
  }

  // Compile all emails
  const allEmails: string[] = [];
  if (contact.email && !contact.emails?.includes(contact.email)) {
    allEmails.push(contact.email);
  }
  if (contact.emails?.length) {
    contact.emails.forEach((e) => {
      const trimmed = e.trim();
      if (trimmed && !allEmails.includes(trimmed)) allEmails.push(trimmed);
    });
  }

  // Compile all addresses
  const allAddresses: string[] = [];
  if (contact.address && !contact.addresses?.includes(contact.address)) {
    allAddresses.push(contact.address);
  }
  if (contact.addresses?.length) {
    contact.addresses.forEach((a) => {
      const trimmed = a.trim();
      if (trimmed && !allAddresses.includes(trimmed)) allAddresses.push(trimmed);
    });
  }

  const categoryBadgeColors = {
    Client: isDark ? 'bg-blue-500/15 border-blue-500/30 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-700',
    Vendor: isDark ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700',
    Partner: isDark ? 'bg-purple-500/15 border-purple-500/30 text-purple-300' : 'bg-purple-50 border-purple-200 text-purple-700',
    Contractor: isDark ? 'bg-amber-500/15 border-amber-500/30 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-700',
    Government: isDark ? 'bg-rose-500/15 border-rose-500/30 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-700',
    Other: isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700',
  }[contact.category] || (isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700');

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
        <div
          className={cn(
            'relative w-full max-w-2xl rounded-2xl shadow-2xl border flex flex-col max-h-[92vh] overflow-hidden transition-all',
            isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          )}
        >
          {/* ── Modal Header Banner ─────────────────────────────────── */}
          <div
            className={cn(
              'p-6 border-b shrink-0 flex items-start justify-between gap-4 relative overflow-hidden',
              isDark
                ? 'bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border-slate-800'
                : 'bg-gradient-to-r from-blue-50/70 via-slate-50 to-indigo-50/60 border-slate-200'
            )}
          >
            <div className="flex items-start gap-4 min-w-0">
              {/* Avatar Initials */}
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-md shrink-0 border-2 border-white/20">
                {initials}
              </div>

              {/* Title & Metadata */}
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg sm:text-xl font-extrabold text-foreground tracking-tight truncate">
                    {contact.name}
                  </h2>
                  <span className={cn('text-[10px] font-bold tracking-wider px-2.5 py-0.5 rounded-full border uppercase', categoryBadgeColors)}>
                    {contact.category}
                  </span>
                </div>

                {(contact.position || contact.company) && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap font-medium">
                    {contact.position && (
                      <span className={cn('font-semibold', isDark ? 'text-slate-200' : 'text-slate-800')}>
                        {contact.position}
                      </span>
                    )}
                    {contact.position && contact.company && <span>•</span>}
                    {contact.company && (
                      <span className="inline-flex items-center gap-1 font-medium">
                        <Building2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span className={cn(isDark ? 'text-slate-300' : 'text-slate-700')}>{contact.company}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Actions: Star toggle + Close */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => onToggleFavorite(contact)}
                title={contact.is_favorite ? 'Starred Favorite' : 'Mark as Favorite'}
                className={cn(
                  'p-2 rounded-xl border transition-all',
                  contact.is_favorite
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-500'
                    : isDark
                    ? 'border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    : 'border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                )}
              >
                <Star className={cn('w-4 h-4', contact.is_favorite && 'fill-amber-400 text-amber-500')} />
              </button>
              <button
                type="button"
                onClick={onClose}
                className={cn(
                  'p-2 rounded-xl transition-colors',
                  isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-slate-200' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-700'
                )}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* ── Scrollable Body Content ─────────────────────────────── */}
          <div className="p-6 overflow-y-auto space-y-5 flex-1">
            {/* Scanned Business Card Banner (if attached) */}
            {contact.card_image_url && (
              <div
                className={cn(
                  'p-3.5 rounded-xl border flex items-center justify-between gap-3 shadow-2xs',
                  isDark ? 'bg-slate-800/40 border-slate-700/80' : 'bg-blue-50/50 border-blue-100'
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={contact.card_image_url}
                    alt="Business Card"
                    onClick={() => setShowCardLightbox(true)}
                    className="w-16 h-10 object-cover rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer shadow-xs hover:opacity-90 transition-opacity"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-blue-500" />
                      <span>Physical Business Card Attached</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      Extracted using AI Camera Scanner
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCardLightbox(true)}
                  className="text-xs h-7 gap-1 border-slate-300 dark:border-slate-700 shrink-0"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>View Card</span>
                </Button>
              </div>
            )}

            {/* Contact Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Phone Numbers Card */}
              <div
                className={cn(
                  'p-4 rounded-xl border space-y-2.5',
                  isDark ? 'bg-slate-850/60 border-slate-800' : 'bg-slate-50/70 border-slate-200'
                )}
              >
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <Phone className="w-3.5 h-3.5 text-blue-500" />
                  <span>Phone Numbers ({allPhones.length})</span>
                </div>
                {allPhones.length > 0 ? (
                  <div className="space-y-2">
                    {allPhones.map((phone, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          'flex items-center justify-between gap-2 p-2 rounded-lg border transition-colors',
                          isDark ? 'bg-slate-900/80 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-slate-300'
                        )}
                      >
                        <div className="min-w-0">
                          {idx === 0 && (
                            <span className="text-[9px] uppercase font-bold text-blue-600 dark:text-blue-400 block">
                              Primary
                            </span>
                          )}
                          <a
                            href={`tel:${phone}`}
                            className="font-mono text-xs font-semibold text-foreground hover:text-blue-500 hover:underline"
                          >
                            {phone}
                          </a>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyText(phone, `phone-${idx}`, 'Phone')}
                          title="Copy phone"
                          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                          {copiedKey === `phone-${idx}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No phone numbers recorded.</p>
                )}
              </div>

              {/* Email Addresses Card */}
              <div
                className={cn(
                  'p-4 rounded-xl border space-y-2.5',
                  isDark ? 'bg-slate-850/60 border-slate-800' : 'bg-slate-50/70 border-slate-200'
                )}
              >
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <Mail className="w-3.5 h-3.5 text-blue-500" />
                  <span>Email Addresses ({allEmails.length})</span>
                </div>
                {allEmails.length > 0 ? (
                  <div className="space-y-2">
                    {allEmails.map((email, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          'flex items-center justify-between gap-2 p-2 rounded-lg border transition-colors',
                          isDark ? 'bg-slate-900/80 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-slate-300'
                        )}
                      >
                        <div className="min-w-0">
                          {idx === 0 && (
                            <span className="text-[9px] uppercase font-bold text-blue-600 dark:text-blue-400 block">
                              Primary
                            </span>
                          )}
                          <a
                            href={`mailto:${email}`}
                            className="text-xs font-semibold text-foreground hover:text-blue-500 hover:underline truncate block"
                          >
                            {email}
                          </a>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyText(email, `email-${idx}`, 'Email')}
                          title="Copy email"
                          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                          {copiedKey === `email-${idx}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No email addresses recorded.</p>
                )}
              </div>
            </div>

            {/* Physical / Office Addresses */}
            <div
              className={cn(
                'p-4 rounded-xl border space-y-2.5',
                isDark ? 'bg-slate-850/60 border-slate-800' : 'bg-slate-50/70 border-slate-200'
              )}
            >
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <MapPin className="w-3.5 h-3.5 text-blue-500" />
                <span>Physical & Branch Addresses ({allAddresses.length})</span>
              </div>
              {allAddresses.length > 0 ? (
                <div className="space-y-2">
                  {allAddresses.map((addr, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'flex items-start justify-between gap-3 p-2.5 rounded-lg border',
                        isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
                      )}
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        <MapPin className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                        <span className="text-xs text-foreground font-medium leading-relaxed">
                          {addr}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyText(addr, `addr-${idx}`, 'Address')}
                        title="Copy address"
                        className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
                      >
                        {copiedKey === `addr-${idx}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No physical addresses specified.</p>
              )}
            </div>

            {/* Notes & Memo Section */}
            {contact.note && (
              <div
                className={cn(
                  'p-4 rounded-xl border space-y-2',
                  isDark ? 'bg-slate-850/60 border-slate-800' : 'bg-slate-50/70 border-slate-200'
                )}
              >
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <FileText className="w-3.5 h-3.5 text-blue-500" />
                  <span>Notes & Comments</span>
                </div>
                <p className="text-xs text-foreground leading-relaxed whitespace-pre-line bg-card p-3 rounded-lg border border-border/60">
                  {contact.note}
                </p>
              </div>
            )}

            {/* Tags & Badges */}
            {contact.tags && contact.tags.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <Tag className="w-3.5 h-3.5 text-blue-500" />
                  <span>Tags ({contact.tags.length})</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {contact.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className={cn(
                        'text-xs font-semibold px-2.5 py-1 rounded-lg border',
                        isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                      )}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata Timestamps */}
            {(contact.created_at || contact.updated_at) && (
              <div className="text-[11px] text-muted-foreground pt-2 flex items-center justify-between gap-4 flex-wrap border-t border-border/40">
                {contact.created_at && (
                  <span>
                    Created: <strong className="font-semibold text-foreground">{new Date(contact.created_at).toLocaleDateString()}</strong>
                  </span>
                )}
                {contact.updated_at && (
                  <span>
                    Last Updated: <strong className="font-semibold text-foreground">{new Date(contact.updated_at).toLocaleDateString()}</strong>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* ── Modal Footer Controls ───────────────────────────────── */}
          <div
            className={cn(
              'px-6 py-3.5 border-t shrink-0 flex items-center justify-between gap-3',
              isDark ? 'border-slate-800 bg-slate-900/80' : 'border-slate-200 bg-slate-50/80'
            )}
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onClose();
                onDelete(contact);
              }}
              className="text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-200 dark:border-rose-900 gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                className="text-xs border-border/80"
              >
                Close
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onClose();
                  onEdit(contact);
                }}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-1.5 shadow-xs"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Edit Contact</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox for Scanned Card */}
      {showCardLightbox && contact.card_image_url && (
        <div
          onClick={() => setShowCardLightbox(false)}
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md cursor-pointer animate-in fade-in"
        >
          <div
            className="relative max-w-3xl w-full rounded-2xl overflow-hidden shadow-2xl border border-white/20 bg-black/90 p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 text-white">
              <span className="text-xs font-semibold">{contact.name} — Business Card</span>
              <button
                type="button"
                onClick={() => setShowCardLightbox(false)}
                className="p-1 rounded-lg hover:bg-white/20 text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <img
              src={contact.card_image_url}
              alt="Business Card"
              className="w-full max-h-[75vh] object-contain rounded-xl"
            />
          </div>
        </div>
      )}
    </>
  );
}
