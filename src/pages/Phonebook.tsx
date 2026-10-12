import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, Plus, Sparkles, Phone, Mail, MapPin, Building2, User,
  Star, Trash2, Pencil, Copy, Check, Download, Filter, LayoutGrid,
  List, ExternalLink, Image as ImageIcon, Briefcase, Tag, RefreshCw, X,
  MoreVertical, Eye
} from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { toast, showConfirm } from '@/src/components/ui/toast';
import { cn } from '@/src/lib/utils';
import { useTheme } from '@/src/hooks/useTheme';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { supabase } from '@/src/integrations/supabase/client';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/src/components/ui/dropdown-menu';
import { ContactFormModal, PhonebookContact } from '@/src/components/phonebook/ContactFormModal';
import { ContactDetailModal } from '@/src/components/phonebook/ContactDetailModal';
import { BusinessCardScannerModal } from '@/src/components/phonebook/BusinessCardScannerModal';
import { ExtractedBusinessCardData } from '@/src/lib/businessCardAiService';

const CATEGORY_TABS = ['All', 'Favorites', 'Client', 'Vendor', 'Partner', 'Contractor', 'Government', 'Other'] as const;

export function Phonebook() {
  const { isDark } = useTheme();

  const [contacts, setContacts] = useState<PhonebookContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedCompany, setSelectedCompany] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  // Modals state
  const [viewingContact, setViewingContact] = useState<PhonebookContact | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<PhonebookContact | null>(null);
  const [previewCardImage, setPreviewCardImage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch contacts from Supabase
  const loadContacts = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('phonebook_contacts')
        .select('*')
        .order('is_favorite', { ascending: false })
        .order('name', { ascending: true });

      if (error) throw error;
      setContacts((data as PhonebookContact[]) || []);
    } catch (err: any) {
      console.error('Error fetching phonebook contacts:', err);
      // Fallback to local storage if available
      try {
        const cached = localStorage.getItem('dcel-phonebook-cache');
        if (cached) setContacts(JSON.parse(cached));
      } catch {}
      toast.error('Failed to load contacts from database.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContacts();

    // Setup Realtime listener
    const channel = supabase
      .channel('phonebook_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'phonebook_contacts' },
        () => {
          loadContacts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadContacts]);

  // Sync to local cache whenever contacts change
  useEffect(() => {
    if (contacts.length > 0) {
      try {
        localStorage.setItem('dcel-phonebook-cache', JSON.stringify(contacts));
      } catch {}
    }
  }, [contacts]);

  // Save (Create or Update) contact
  const handleSaveContact = async (contactData: PhonebookContact) => {
    if (contactData.id) {
      // Update
      const { error } = await supabase
        .from('phonebook_contacts')
        .update({
          name: contactData.name,
          position: contactData.position || null,
          company: contactData.company || null,
          category: contactData.category,
          phone: contactData.phone || null,
          phones: contactData.phones || [],
          email: contactData.email || null,
          emails: contactData.emails || [],
          address: contactData.address || null,
          addresses: contactData.addresses || [],
          note: contactData.note || null,
          tags: contactData.tags || [],
          is_favorite: contactData.is_favorite || false,
          card_image_url: contactData.card_image_url || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', contactData.id);

      if (error) throw error;
    } else {
      // Insert
      const { error } = await supabase
        .from('phonebook_contacts')
        .insert([{
          name: contactData.name,
          position: contactData.position || null,
          company: contactData.company || null,
          category: contactData.category,
          phone: contactData.phone || null,
          phones: contactData.phones || [],
          email: contactData.email || null,
          emails: contactData.emails || [],
          address: contactData.address || null,
          addresses: contactData.addresses || [],
          note: contactData.note || null,
          tags: contactData.tags || [],
          is_favorite: contactData.is_favorite || false,
          card_image_url: contactData.card_image_url || null
        }]);

      if (error) throw error;
    }

    await loadContacts();
  };

  // Toggle Favorite
  const toggleFavorite = async (contact: PhonebookContact, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!contact.id) return;
    const nextFav = !contact.is_favorite;

    // Optimistic update
    setContacts(prev =>
      prev.map(c => (c.id === contact.id ? { ...c, is_favorite: nextFav } : c))
    );
    setViewingContact(prev => (prev && prev.id === contact.id ? { ...prev, is_favorite: nextFav } : prev));

    try {
      const { error } = await supabase
        .from('phonebook_contacts')
        .update({ is_favorite: nextFav })
        .eq('id', contact.id);

      if (error) throw error;
    } catch (err: any) {
      toast.error('Failed to update favorite status.');
      loadContacts();
    }
  };

  // Delete Contact
  const handleDeleteContact = async (contact: PhonebookContact, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!contact.id) return;

    const confirmed = await showConfirm(
      `Are you sure you want to delete contact "${contact.name}"? This cannot be undone.`,
      {
        title: 'Delete Contact',
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel',
        variant: 'danger'
      }
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('phonebook_contacts')
        .delete()
        .eq('id', contact.id);

      if (error) throw error;
      toast.success('Contact deleted from phonebook.');
      setContacts(prev => prev.filter(c => c.id !== contact.id));
      setViewingContact(prev => (prev && prev.id === contact.id ? null : prev));
    } catch (err: any) {
      toast.error('Failed to delete contact.');
    }
  };

  // Quick Copy
  const copyToClipboard = (text: string, id: string, label: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success(`Copied ${label} to clipboard!`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Callback when scanner scans from main header
  const handleMainScanComplete = (extracted: ExtractedBusinessCardData) => {
    setEditingContact({
      name: extracted.name,
      position: extracted.position,
      company: extracted.company,
      category: extracted.category,
      phone: extracted.phone,
      phones: extracted.phones,
      email: extracted.email,
      emails: extracted.emails,
      address: extracted.address,
      addresses: extracted.addresses,
      note: extracted.note,
      tags: extracted.tags,
      card_image_url: extracted.cardImageUrl
    });
    setIsFormModalOpen(true);
  };

  // Unique Companies for Filter
  const existingCompanies = useMemo(() => {
    const set = new Set<string>();
    contacts.forEach(c => {
      if (c.company?.trim()) set.add(c.company.trim());
    });
    return Array.from(set).sort();
  }, [contacts]);

  // Filtered Contacts
  const filteredContacts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return contacts.filter(c => {
      // Category filter
      if (selectedCategory === 'Favorites' && !c.is_favorite) return false;
      if (selectedCategory !== 'All' && selectedCategory !== 'Favorites' && c.category !== selectedCategory) {
        return false;
      }

      // Company filter
      if (selectedCompany !== 'All' && c.company !== selectedCompany) {
        return false;
      }

      // Query search
      if (!q) return true;
      const matchName = c.name?.toLowerCase().includes(q);
      const matchCompany = c.company?.toLowerCase().includes(q);
      const matchPosition = c.position?.toLowerCase().includes(q);
      const matchPhone = c.phone?.toLowerCase().includes(q) || c.phones?.some(p => p.toLowerCase().includes(q));
      const matchEmail = c.email?.toLowerCase().includes(q) || c.emails?.some(e => e.toLowerCase().includes(q));
      const matchAddress = c.address?.toLowerCase().includes(q) || c.addresses?.some(a => a.toLowerCase().includes(q));
      const matchNote = c.note?.toLowerCase().includes(q);
      const matchTags = c.tags?.some(t => t.toLowerCase().includes(q));

      return matchName || matchCompany || matchPosition || matchPhone || matchEmail || matchAddress || matchNote || matchTags;
    });
  }, [contacts, searchQuery, selectedCategory, selectedCompany]);

  // Export Contacts to CSV
  const exportToCsv = () => {
    if (contacts.length === 0) {
      toast.info('No contacts to export.');
      return;
    }

    const headers = ['Name', 'Position', 'Company', 'Category', 'Primary Phone', 'All Phones', 'Primary Email', 'All Emails', 'Primary Address', 'All Addresses', 'Notes', 'Tags'];
    const rows = contacts.map(c => [
      `"${c.name.replace(/"/g, '""')}"`,
      `"${(c.position || '').replace(/"/g, '""')}"`,
      `"${(c.company || '').replace(/"/g, '""')}"`,
      `"${c.category}"`,
      `"${(c.phone || '').replace(/"/g, '""')}"`,
      `"${(c.phones || []).join(', ').replace(/"/g, '""')}"`,
      `"${(c.email || '').replace(/"/g, '""')}"`,
      `"${(c.emails || []).join(', ').replace(/"/g, '""')}"`,
      `"${(c.address || '').replace(/"/g, '""')}"`,
      `"${(c.addresses || []).join('; ').replace(/"/g, '""')}"`,
      `"${(c.note || '').replace(/"/g, '""')}"`,
      `"${(c.tags || []).join(', ').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `phonebook_contacts_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Phonebook exported to CSV!');
  };

  // Header actions for app-level PageHeader
  const headerActions = (
    <div className="flex items-center gap-2 flex-wrap">
      <Button
        variant="outline"
        size="sm"
        onClick={exportToCsv}
        className="text-xs gap-1.5 h-9"
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Export CSV</span>
        <span className="sm:hidden">Export</span>
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsScannerModalOpen(true)}
        className="gap-2 text-xs font-semibold h-9 border-blue-200 dark:border-blue-800 bg-blue-50/70 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400"
      >
        <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        <span>Scan Business Card</span>
      </Button>

      <Button
        size="sm"
        onClick={() => {
          setEditingContact(null);
          setIsFormModalOpen(true);
        }}
        className="gap-1.5 text-xs font-semibold h-9 bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
      >
        <Plus className="w-4 h-4" />
        <span>Add Contact</span>
      </Button>
    </div>
  );

  const headerTitle = (
    <span className="inline-flex items-center gap-2">
      <span>Client Phonebook</span>
      <span className={cn(
        'text-xs font-semibold px-2 py-0.5 rounded-full border',
        isDark
          ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
          : 'bg-blue-50 border-blue-200 text-blue-700'
      )}>
        {contacts.length} {contacts.length === 1 ? 'Contact' : 'Contacts'}
      </span>
    </span>
  );

  useSetPageTitle(
    headerTitle,
    'Directory of client leads, executives & partners with AI Business Card OCR',
    headerActions,
    [contacts.length, isDark]
  );

  return (
    <div className={cn('min-h-full flex flex-col p-4 sm:p-6 space-y-4', isDark ? 'text-slate-100' : 'text-slate-900')}>

      {/* ── Filters & Search Control Bar ──────────────────────────── */}
      <div className={cn(
        'p-3.5 sm:p-4 rounded-2xl border shadow-xs transition-colors',
        isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200'
      )}>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name, company, position, phone, email, notes, or tags..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className={cn(
                'w-full pl-9 pr-8 py-2 text-xs rounded-xl border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500',
                isDark ? 'bg-slate-800/80 border-slate-700 text-slate-100 placeholder:text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400'
              )}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Filter Dropdown */}
          <div className="w-full sm:w-auto shrink-0">
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className={cn(
                'h-9 px-3 text-xs rounded-xl border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-44 font-medium',
                isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-700'
              )}
            >
              <option value="All">All Categories</option>
              <option value="Favorites">⭐ Starred / Favorites</option>
              <option value="Client">Client</option>
              <option value="Vendor">Vendor</option>
              <option value="Partner">Partner</option>
              <option value="Contractor">Contractor</option>
              <option value="Government">Government</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Company Filter Dropdown */}
          {existingCompanies.length > 0 && (
            <div className="w-full sm:w-auto shrink-0">
              <select
                value={selectedCompany}
                onChange={e => setSelectedCompany(e.target.value)}
                className={cn(
                  'h-9 px-3 text-xs rounded-xl border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-48 font-medium',
                  isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-700'
                )}
              >
                <option value="All">All Companies ({existingCompanies.length})</option>
                {existingCompanies.map(comp => (
                  <option key={comp} value={comp}>{comp}</option>
                ))}
              </select>
            </div>
          )}

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 border rounded-xl p-0.5 shrink-0 border-slate-700/50">
            <button
              onClick={() => setViewMode('grid')}
              title="Grid View"
              className={cn(
                'p-1.5 rounded-lg text-xs transition-colors',
                viewMode === 'grid'
                  ? isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              )}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              title="List View"
              className={cn(
                'p-1.5 rounded-lg text-xs transition-colors',
                viewMode === 'list'
                  ? isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              )}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Content View: Contacts List / Grid ────────────────────── */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
          <div className="text-sm font-semibold">Loading directory contacts...</div>
        </div>
      ) : filteredContacts.length === 0 ? (
        <div className={cn(
          'rounded-2xl border p-12 text-center space-y-4 shadow-xs',
          isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'
        )}>
          <div className="h-16 w-16 rounded-3xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto shadow-inner">
            <Phone className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold">No contacts found</h3>
            <p className={cn('text-xs max-w-sm mx-auto', isDark ? 'text-slate-400' : 'text-slate-500')}>
              {searchQuery
                ? `No contacts matched "${searchQuery}". Try adjusting your search query or filters.`
                : 'Your phonebook is currently empty. Add your first contact or snap a business card using AI!'}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button
              size="sm"
              onClick={() => setIsScannerModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5 shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5" /> Scan Business Card
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingContact(null);
                setIsFormModalOpen(true);
              }}
              className="text-xs gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Add Manually
            </Button>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        /* ── Grid View ────────────────────────────────────────────── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredContacts.map(contact => {
            const primaryPhone = contact.phone || contact.phones?.[0];
            const primaryEmail = contact.email || contact.emails?.[0];
            const primaryAddr = contact.address || contact.addresses?.[0];
            const initials = contact.name.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

            return (
              <div
                key={contact.id}
                onClick={() => setViewingContact(contact)}
                className={cn(
                  'group relative rounded-2xl border p-4.5 transition-all duration-200 hover:shadow-lg cursor-pointer flex flex-col justify-between space-y-3.5',
                  isDark
                    ? 'bg-slate-900/90 border-slate-800 hover:border-blue-500/50 hover:bg-slate-850'
                    : 'bg-white border-slate-200 hover:border-blue-400 hover:shadow-blue-500/5'
                )}
              >
                {/* Card Top: Avatar, Name, Category & Favorite */}
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                        {initials || <User className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-sm font-bold truncate group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors">
                            {contact.name}
                          </h4>
                          {contact.card_image_url && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewCardImage(contact.card_image_url || null);
                              }}
                              title="View business card photo"
                              className="text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 shrink-0"
                            >
                              <ImageIcon className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        {contact.position && (
                          <div className={cn('text-xs truncate font-medium', isDark ? 'text-slate-400' : 'text-slate-500')}>
                            {contact.position}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => toggleFavorite(contact, e)}
                      title={contact.is_favorite ? 'Starred' : 'Mark favorite'}
                      className={cn(
                        'p-1.5 rounded-xl transition-colors shrink-0',
                        contact.is_favorite
                          ? 'text-amber-400 hover:text-amber-300'
                          : 'text-slate-500 hover:text-slate-300'
                      )}
                    >
                      <Star className={cn('w-4 h-4', contact.is_favorite && 'fill-amber-400')} />
                    </button>
                  </div>

                  {/* Company & Category Badges */}
                  <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                    {contact.company && (
                      <span className={cn(
                        'inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-lg border max-w-[200px] truncate',
                        isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                      )}>
                        <Building2 className="w-3 h-3 text-blue-500 shrink-0" />
                        <span className="truncate">{contact.company}</span>
                      </span>
                    )}
                    <span className={cn(
                      'text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md border',
                      contact.category === 'Client'
                        ? isDark ? 'bg-blue-500/10 border-blue-500/30 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-700'
                        : isDark ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'
                    )}>
                      {contact.category}
                    </span>
                  </div>
                </div>

                {/* Card Contact Info: Phone, Email, Address */}
                <div className={cn('space-y-2 text-xs pt-1 border-t', isDark ? 'border-slate-800/50' : 'border-slate-100')}>
                  {/* Phone */}
                  {primaryPhone ? (
                    <div className="flex items-center justify-between gap-2 group/row">
                      <a
                        href={`tel:${primaryPhone}`}
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                          'flex items-center gap-2 hover:text-blue-500 truncate transition-colors font-medium',
                          isDark ? 'text-slate-300' : 'text-slate-800'
                        )}
                      >
                        <Phone className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span className="truncate font-mono">{primaryPhone}</span>
                      </a>
                      <div className="flex items-center gap-1 shrink-0">
                        {contact.phones?.length > 1 && (
                          <span className={cn(
                            'text-[10px] font-semibold px-1 rounded',
                            isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'
                          )}>
                            +{contact.phones.length - 1}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => copyToClipboard(primaryPhone, `phone-${contact.id}`, 'Phone', e)}
                          title="Copy phone"
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-blue-500"
                        >
                          {copiedId === `phone-${contact.id}` ? <Check className="w-3 h-3 text-blue-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {/* Email */}
                  {primaryEmail ? (
                    <div className="flex items-center justify-between gap-2 group/row">
                      <a
                        href={`mailto:${primaryEmail}`}
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                          'flex items-center gap-2 hover:text-blue-500 truncate transition-colors font-medium',
                          isDark ? 'text-slate-300' : 'text-slate-800'
                        )}
                      >
                        <Mail className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span className="truncate">{primaryEmail}</span>
                      </a>
                      <div className="flex items-center gap-1 shrink-0">
                        {contact.emails?.length > 1 && (
                          <span className={cn(
                            'text-[10px] font-semibold px-1 rounded',
                            isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'
                          )}>
                            +{contact.emails.length - 1}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => copyToClipboard(primaryEmail, `email-${contact.id}`, 'Email', e)}
                          title="Copy email"
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-blue-500"
                        >
                          {copiedId === `email-${contact.id}` ? <Check className="w-3 h-3 text-blue-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {/* Address */}
                  {primaryAddr ? (
                    <div className={cn(
                      'flex items-center gap-2 truncate font-normal',
                      isDark ? 'text-slate-400' : 'text-slate-600'
                    )}>
                      <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span className="truncate">{primaryAddr}</span>
                      {contact.addresses?.length > 1 && (
                        <span className={cn(
                          'text-[10px] font-semibold px-1 rounded shrink-0',
                          isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'
                        )}>
                          +{contact.addresses.length - 1}
                        </span>
                      )}
                    </div>
                  ) : null}
                </div>

                {/* Tags and Action Bar */}
                <div className={cn('pt-2 border-t flex items-center justify-between gap-2', isDark ? 'border-slate-800/40' : 'border-slate-100')}>
                  <div className="flex items-center gap-1 overflow-hidden">
                    {contact.tags?.slice(0, 2).map(tag => (
                      <span
                        key={tag}
                        className={cn(
                          'text-[10px] px-2 py-0.5 rounded-full font-medium truncate max-w-[90px]',
                          isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                        )}
                      >
                        #{tag}
                      </span>
                    ))}
                    {(contact.tags?.length || 0) > 2 && (
                      <span className="text-[10px] text-slate-500">
                        +{contact.tags.length - 2}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 p-0 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg"
                        >
                          <MoreVertical className="w-4 h-4" />
                          <span className="sr-only">Open actions menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingContact(contact);
                            setIsFormModalOpen(true);
                          }}
                          className="gap-2 cursor-pointer text-xs"
                        >
                          <Pencil className="w-3.5 h-3.5 text-blue-500" />
                          <span>Edit Contact</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => toggleFavorite(contact, e)}
                          className="gap-2 cursor-pointer text-xs"
                        >
                          <Star className={cn('w-3.5 h-3.5', contact.is_favorite ? 'fill-amber-400 text-amber-400' : 'text-slate-400')} />
                          <span>{contact.is_favorite ? 'Remove Star' : 'Star Contact'}</span>
                        </DropdownMenuItem>
                        {contact.card_image_url && (
                          <DropdownMenuItem
                            onClick={() => setPreviewCardImage(contact.card_image_url || null)}
                            className="gap-2 cursor-pointer text-xs"
                          >
                            <ImageIcon className="w-3.5 h-3.5 text-purple-400" />
                            <span>View Business Card</span>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) => handleDeleteContact(contact, e)}
                          className="gap-2 cursor-pointer text-xs text-rose-500 focus:text-rose-400 focus:bg-rose-500/10"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                          <span>Delete Contact</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── List View ────────────────────────────────────────────── */
        <div className={cn(
          'rounded-2xl border overflow-hidden shadow-xs',
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        )}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className={cn(
                'border-b uppercase font-bold text-[10px] tracking-wider',
                isDark ? 'bg-slate-800/50 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
              )}>
                <tr>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Company & Title</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className={cn('divide-y', isDark ? 'divide-slate-800' : 'divide-slate-200')}>
                {filteredContacts.map(contact => {
                  const primaryPhone = contact.phone || contact.phones?.[0];
                  const primaryEmail = contact.email || contact.emails?.[0];
                  const primaryAddr = contact.address || contact.addresses?.[0];

                  return (
                    <tr
                      key={contact.id}
                      onClick={() => setViewingContact(contact)}
                      className={cn(
                        'cursor-pointer transition-colors',
                        isDark
                          ? 'hover:bg-slate-800/50 even:bg-slate-900/40 text-slate-100'
                          : 'hover:bg-blue-50/40 even:bg-slate-50/60 text-slate-900'
                      )}
                    >
                      <td className="py-3.5 px-4 font-semibold">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => toggleFavorite(contact, e)}
                            className={cn(
                              'p-1 transition-colors',
                              contact.is_favorite ? 'text-amber-500' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                            )}
                          >
                            <Star className={cn('w-4 h-4', contact.is_favorite ? 'fill-amber-400 text-amber-500' : '')} />
                          </button>
                          <span className={cn('font-bold text-xs', isDark ? 'text-slate-100' : 'text-slate-900')}>
                            {contact.name}
                          </span>
                          {contact.card_image_url && (
                            <ImageIcon className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className={cn('font-semibold text-xs', isDark ? 'text-slate-200' : 'text-slate-900')}>
                          {contact.company || '—'}
                        </div>
                        {contact.position && (
                          <div className={cn('text-[11px] font-medium pt-0.5', isDark ? 'text-slate-400' : 'text-slate-600')}>
                            {contact.position}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={cn(
                          'px-2 py-0.5 rounded-md border text-[10px] font-bold tracking-wide uppercase',
                          contact.category === 'Client'
                            ? isDark
                              ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                              : 'bg-blue-50 border-blue-200 text-blue-700'
                            : isDark
                              ? 'bg-slate-800 border-slate-700 text-slate-300'
                              : 'bg-slate-100 border-slate-200 text-slate-700'
                        )}>
                          {contact.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs">
                        {primaryPhone ? (
                          <a
                            href={`tel:${primaryPhone}`}
                            onClick={e => e.stopPropagation()}
                            className={cn(
                              'font-medium hover:underline hover:text-blue-600 dark:hover:text-blue-400',
                              isDark ? 'text-slate-200' : 'text-slate-800'
                            )}
                          >
                            {primaryPhone}
                          </a>
                        ) : (
                          <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        {primaryEmail ? (
                          <a
                            href={`mailto:${primaryEmail}`}
                            onClick={e => e.stopPropagation()}
                            className={cn(
                              'font-medium hover:underline hover:text-blue-600 dark:hover:text-blue-400',
                              isDark ? 'text-slate-200' : 'text-slate-800'
                            )}
                          >
                            {primaryEmail}
                          </a>
                        ) : (
                          <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs truncate max-w-[180px]">
                        <span className={cn('font-normal', isDark ? 'text-slate-300' : 'text-slate-700')}>
                          {primaryAddr || '—'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className={cn(
                                  'h-8 w-8 p-0 rounded-lg transition-colors',
                                  isDark
                                    ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                                )}
                              >
                                <MoreVertical className="w-4 h-4" />
                                <span className="sr-only">Open actions menu</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditingContact(contact);
                                  setIsFormModalOpen(true);
                                }}
                                className="gap-2 cursor-pointer text-xs"
                              >
                                <Pencil className="w-3.5 h-3.5 text-blue-500" />
                                <span>Edit Contact</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => toggleFavorite(contact, e)}
                                className="gap-2 cursor-pointer text-xs"
                              >
                                <Star className={cn('w-3.5 h-3.5', contact.is_favorite ? 'fill-amber-400 text-amber-400' : 'text-slate-400')} />
                                <span>{contact.is_favorite ? 'Remove Star' : 'Star Contact'}</span>
                              </DropdownMenuItem>
                              {contact.card_image_url && (
                                <DropdownMenuItem
                                  onClick={() => setPreviewCardImage(contact.card_image_url || null)}
                                  className="gap-2 cursor-pointer text-xs"
                                >
                                  <ImageIcon className="w-3.5 h-3.5 text-purple-400" />
                                  <span>View Business Card</span>
                                </DropdownMenuItem>
                              )}
                              {primaryPhone && (
                                <DropdownMenuItem
                                  onClick={(e) => copyToClipboard(primaryPhone, `phone-${contact.id}`, 'Phone', e)}
                                  className="gap-2 cursor-pointer text-xs"
                                >
                                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Copy Phone</span>
                                </DropdownMenuItem>
                              )}
                              {primaryEmail && (
                                <DropdownMenuItem
                                  onClick={(e) => copyToClipboard(primaryEmail, `email-${contact.id}`, 'Email', e)}
                                  className="gap-2 cursor-pointer text-xs"
                                >
                                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Copy Email</span>
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={(e) => handleDeleteContact(contact, e)}
                                className="gap-2 cursor-pointer text-xs text-rose-500 focus:text-rose-400 focus:bg-rose-500/10"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                <span>Delete Contact</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Contact Detail View Modal ─────────────────────────────── */}
      <ContactDetailModal
        isOpen={!!viewingContact}
        contact={viewingContact}
        onClose={() => setViewingContact(null)}
        onEdit={(contact) => {
          setViewingContact(null);
          setEditingContact(contact);
          setIsFormModalOpen(true);
        }}
        onDelete={(contact) => handleDeleteContact(contact)}
        onToggleFavorite={(contact) => toggleFavorite(contact)}
      />

      {/* ── Contact Add/Edit Form Modal ────────────────────────────── */}
      <ContactFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingContact(null);
        }}
        onSave={handleSaveContact}
        initialData={editingContact}
        existingCompanies={existingCompanies}
      />

      {/* ── Business Card Scanner Modal (Direct Trigger) ────────────── */}
      <BusinessCardScannerModal
        isOpen={isScannerModalOpen}
        onClose={() => setIsScannerModalOpen(false)}
        onScanComplete={handleMainScanComplete}
      />

      {/* ── Card Lightbox Preview ───────────────────────────────────── */}
      {previewCardImage && (
        <div
          onClick={() => setPreviewCardImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md cursor-pointer animate-in fade-in"
        >
          <div className="relative max-w-3xl max-h-[85vh] rounded-2xl overflow-hidden shadow-2xl border border-slate-700">
            <img src={previewCardImage} alt="Business Card Full" className="w-full h-full object-contain" />
            <button
              onClick={() => setPreviewCardImage(null)}
              className="absolute top-3 right-3 p-2 rounded-full bg-slate-900/80 text-white hover:bg-slate-800 shadow"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
