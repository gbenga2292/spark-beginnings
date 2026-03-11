import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import { Badge } from '@/src/components/ui/badge';
import {
  Save, Building, Bell, Link as LinkIcon, CloudDownload,
  RefreshCw, Library, Pencil, X, Mail, Phone, MapPin, Hash, CheckCircle2
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { Variables } from './Variables';

interface CompanyInfo {
  name: string;
  regNumber: string;
  email: string;
  phone: string;
  address: string;
}

const DEFAULT_COMPANY: CompanyInfo = {
  name: 'Dewatering Construction Etc Limited',
  regNumber: 'RC-1245678',
  email: 'hr@dcel.com',
  phone: '+234 801 234 5678',
  address: 'Victoria Island, Lagos, Nigeria',
};

export function Settings() {
  const [activeTab, setActiveTab] = useState('general');
  const [appVersion, setAppVersion] = useState('1.0.0');
  const [isChecking, setIsChecking] = useState(false);
  const isElectron = window.electronAPI?.isElectron;

  /* ── Company info state ─────────────────────────────────────── */
  const [isEditing, setIsEditing] = useState(false);
  const [saved, setSaved] = useState<CompanyInfo>(DEFAULT_COMPANY);
  const [draft, setDraft] = useState<CompanyInfo>(DEFAULT_COMPANY);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (isElectron && window.electronAPI?.getVersion) {
      window.electronAPI.getVersion().then((v: string) => setAppVersion(v)).catch(console.error);
    }
  }, [isElectron]);

  const handleCheckForUpdates = () => {
    if (isElectron && window.electronAPI?.checkForUpdates) {
      setIsChecking(true);
      window.electronAPI.checkForUpdates();
      setTimeout(() => setIsChecking(false), 3000);
    }
  };

  const handleEditStart = () => { setDraft({ ...saved }); setIsEditing(true); };
  const handleCancel    = () => { setDraft({ ...saved }); setIsEditing(false); };
  const handleSave      = () => {
    setSaved({ ...draft });
    setIsEditing(false);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2500);
  };

  const fields: { key: keyof CompanyInfo; label: string; icon: any; type?: string; fullWidth?: boolean }[] = [
    { key: 'name',      label: 'Company Name',       icon: Building, fullWidth: true },
    { key: 'regNumber', label: 'Registration Number', icon: Hash },
    { key: 'email',     label: 'Primary Email',       icon: Mail,  type: 'email' },
    { key: 'phone',     label: 'Phone Number',        icon: Phone, type: 'tel' },
    { key: 'address',   label: 'Address',             icon: MapPin, fullWidth: true },
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="text-slate-500 mt-2">Manage application preferences, integrations, and security.</p>
      </div>

      <Tabs className="w-full">
        <TabsList className="mb-8 bg-slate-100">
          <TabsTrigger active={activeTab === 'general'}       onClick={() => setActiveTab('general')}       className="w-32">
            <Building      className="mr-2 h-4 w-4" /> General
          </TabsTrigger>
          <TabsTrigger active={activeTab === 'notifications'} onClick={() => setActiveTab('notifications')} className="w-36">
            <Bell          className="mr-2 h-4 w-4" /> Notifications
          </TabsTrigger>
          <TabsTrigger active={activeTab === 'integrations'}  onClick={() => setActiveTab('integrations')}  className="w-36">
            <LinkIcon      className="mr-2 h-4 w-4" /> Integrations
          </TabsTrigger>
          <TabsTrigger active={activeTab === 'updates'}       onClick={() => setActiveTab('updates')}       className="w-32">
            <CloudDownload className="mr-2 h-4 w-4" /> Updates
          </TabsTrigger>
          <TabsTrigger active={activeTab === 'variables'}     onClick={() => setActiveTab('variables')}     className="w-36">
            <Library       className="mr-2 h-4 w-4" /> Variables
          </TabsTrigger>
        </TabsList>

        {/* ─────────── GENERAL TAB ─────────────────────────────────── */}
        <TabsContent active={activeTab === 'general'}>
          <Card className="border border-slate-200 shadow-sm rounded-2xl overflow-hidden">

            {/* Card header with Edit / Save / Cancel controls */}
            <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 px-6 py-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm">
                    <Building className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-slate-800">Company Information</CardTitle>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {isEditing ? 'Edit your company details below.' : 'View your registered company profile.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* "Saved ✓" flash */}
                  {justSaved && !isEditing && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 animate-in fade-in duration-200">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Saved
                    </span>
                  )}

                  {isEditing ? (
                    <>
                      <Button
                        variant="ghost" size="sm" onClick={handleCancel}
                        className="gap-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 h-9"
                      >
                        <X className="h-4 w-4" /> Cancel
                      </Button>
                      <Button
                        size="sm" onClick={handleSave}
                        className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm h-9 px-4"
                      >
                        <Save className="h-4 w-4" /> Save Changes
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline" size="sm" onClick={handleEditStart}
                      className="gap-1.5 border-slate-300 hover:border-indigo-400 hover:text-indigo-600 h-9"
                    >
                      <Pencil className="h-4 w-4" /> Edit
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>

            {/* Card body */}
            <CardContent className="px-6 py-6">
              {isEditing ? (
                /* ── EDIT MODE ── */
                <div className="grid gap-5 md:grid-cols-2">
                  {fields.map(({ key, label, icon: Icon, type, fullWidth }) => (
                    <div key={key} className={fullWidth ? 'md:col-span-2 space-y-1.5' : 'space-y-1.5'}>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <Icon className="h-3.5 w-3.5" /> {label}
                      </label>
                      <Input
                        type={type || 'text'}
                        value={draft[key]}
                        onChange={(e) => setDraft(prev => ({ ...prev, [key]: e.target.value }))}
                        className="h-11 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                /* ── VIEW MODE ── */
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Left column */}
                  <div className="space-y-6">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1.5">
                        <Building className="h-3.5 w-3.5" /> Company Name
                      </p>
                      <p className="text-base font-semibold text-slate-800 leading-snug">{saved.name}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1.5">
                        <Hash className="h-3.5 w-3.5" /> Registration Number
                      </p>
                      <span className="text-sm font-mono font-medium text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md inline-block border border-slate-200">
                        {saved.regNumber}
                      </span>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" /> Address
                      </p>
                      <p className="text-sm text-slate-700">{saved.address}</p>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="space-y-6 md:border-l md:border-slate-100 md:pl-6">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" /> Primary Email
                      </p>
                      <a
                        href={`mailto:${saved.email}`}
                        className="text-sm text-indigo-600 hover:text-indigo-700 hover:underline font-medium"
                      >
                        {saved.email}
                      </a>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5" /> Phone Number
                      </p>
                      <p className="text-sm text-slate-700 font-medium">{saved.phone}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─────────── NOTIFICATIONS TAB ───────────────────────────── */}
        <TabsContent active={activeTab === 'notifications'}>
          <Card>
            <CardHeader>
              <CardTitle>Email &amp; SMS Alerts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {['Leave Requests', 'Payroll Processing', 'New Hire Onboarding', 'Document Expiry', 'System Updates'].map((item) => (
                  <div key={item} className="flex items-center justify-between border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                    <div>
                      <p className="font-medium text-slate-900">{item}</p>
                      <p className="text-sm text-slate-500">Receive notifications for {item.toLowerCase()}.</p>
                    </div>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm text-slate-600">
                        <input type="checkbox" defaultChecked className="rounded border-slate-300 h-4 w-4" /> Email
                      </label>
                      <label className="flex items-center gap-2 text-sm text-slate-600">
                        <input type="checkbox" className="rounded border-slate-300 h-4 w-4" /> SMS
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─────────── INTEGRATIONS TAB ────────────────────────────── */}
        <TabsContent active={activeTab === 'integrations'}>
          <Card>
            <CardHeader>
              <CardTitle>Connected Services</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  { letter: 'W', name: 'Microsoft Word',  desc: 'Document Generation', bg: 'bg-blue-100',    text: 'text-blue-600',    connected: true  },
                  { letter: 'X', name: 'Microsoft Excel', desc: 'Data Import/Export',  bg: 'bg-emerald-100', text: 'text-emerald-600', connected: true  },
                  { letter: 'Q', name: 'QuickBooks',       desc: 'Accounting Sync',     bg: 'bg-green-100',   text: 'text-green-600',  connected: false },
                  { letter: 'S', name: 'Stripe',           desc: 'Payment Gateway',     bg: 'bg-slate-100',   text: 'text-slate-600',  connected: false },
                ].map(({ letter, name, desc, bg, text, connected }) => (
                  <div key={name} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 ${bg} ${text} flex items-center justify-center rounded-md font-bold text-xl`}>{letter}</div>
                      <div>
                        <p className="font-medium text-slate-900">{name}</p>
                        <p className="text-xs text-slate-500">{desc}</p>
                      </div>
                    </div>
                    {connected
                      ? <Badge variant="success">Connected</Badge>
                      : <Button variant="outline" size="sm">Connect</Button>
                    }
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─────────── UPDATES TAB ─────────────────────────────────── */}
        <TabsContent active={activeTab === 'updates'}>
          <Card>
            <CardHeader>
              <CardTitle>Application Updates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between p-6 border border-slate-200 rounded-lg bg-slate-50">
                <div className="flex items-center gap-4 mb-4 md:mb-0">
                  <div className="h-12 w-12 bg-indigo-100 text-indigo-600 flex items-center justify-center rounded-xl shadow-sm">
                    <CloudDownload className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Current Version</h3>
                    <p className="text-sm text-slate-500">v{appVersion}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={handleCheckForUpdates}
                    disabled={!isElectron || isChecking}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[160px]"
                  >
                    {isChecking
                      ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      : <CloudDownload className="mr-2 h-4 w-4" />
                    }
                    {isChecking ? 'Checking...' : 'Check for Updates'}
                  </Button>
                  {!isElectron && (
                    <p className="text-xs text-slate-400 text-center">Only available in Desktop App</p>
                  )}
                </div>
              </div>
              <div className="text-sm text-slate-600 space-y-2">
                <p><strong>Auto-Update:</strong> The app automatically checks for updates on startup.</p>
                <p><strong>Channel:</strong> Stable releases only.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─────────── VARIABLES TAB ───────────────────────────────── */}
        <TabsContent active={activeTab === 'variables'}>
          <Variables />
        </TabsContent>
      </Tabs>
    </div>
  );
}
