import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/src/store/auth';
import { useUserStore } from '@/src/store/userStore';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/src/components/ui/avatar';
import { supabase } from '@/src/integrations/supabase/client';
import { useTheme, ALL_COLOR_THEMES, ALL_UI_THEMES, type ColorTheme, type UITheme } from '@/src/hooks/useTheme';
import { 
  User, 
  Mail, 
  Lock, 
  Shield, 
  Camera, 
  Save, 
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Building2,
  Loader2,
  Palette,
  Sun,
  Moon,
  Check,
  LayoutTemplate,
  CalendarDays
} from 'lucide-react';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { toast, showConfirm } from '@/src/components/ui/toast';

const THEME_OPTIONS: { id: ColorTheme; label: string; swatches: string[] }[] = [
  { id: 'default', label: 'Indigo',  swatches: ['#4f46e5', '#6366f1', '#818cf8'] },
  { id: 'ocean',   label: 'Ocean',   swatches: ['#2563eb', '#3b82f6', '#60a5fa'] },
  { id: 'forest',  label: 'Forest',  swatches: ['#059669', '#10b981', '#34d399'] },
  { id: 'sunset',  label: 'Sunset',  swatches: ['#d97706', '#f59e0b', '#fbbf24'] },
  { id: 'rose',    label: 'Rose',    swatches: ['#e11d48', '#f43f5e', '#fb7185'] },
  { id: 'violet',  label: 'Violet',  swatches: ['#7c3aed', '#8b5cf6', '#a78bfa'] },
  { id: 'slate',   label: 'Slate',   swatches: ['#475569', '#64748b', '#94a3b8'] },
];

const UI_THEME_OPTIONS: { id: UITheme; label: string; description: string }[] = [
  { id: 'default', label: 'Classic', description: 'Standard layout' },
  { id: 'modern', label: 'Modern', description: 'Soft corners, clean look' },
  { id: 'glass', label: 'Glassmorphism', description: 'Frosted glass effects' },
  { id: 'brutalism', label: 'Neo-Brutalism', description: 'Bold, high-contrast' },
  { id: 'minimalist', label: 'Minimalist', description: 'Sleek, borderless' },
  { id: 'burgundy', label: 'Burgundy IDE', description: 'Deep dark red editor mode' },
  { id: 'midnight', label: 'Midnight IDE', description: 'Deep navy blue editor mode' },
];

export function Profile() {
  const navigate = useNavigate();
  const { user, login } = useAuthStore();
  const { updateUser, getCurrentUser } = useUserStore();
  const { isDark, toggle, colorTheme, setColorTheme, uiTheme, setUITheme, showFloatingCalendar, setShowFloatingCalendar } = useTheme();
  const currentUser = getCurrentUser();
  
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(currentUser?.avatar || user?.avatar);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form states
  const [name, setName] = useState(currentUser?.name || user?.name || '');
  const [email, setEmail] = useState(currentUser?.email || user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Messages
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // MFA States
  const [mfaStatus, setMfaStatus] = useState<'unverified' | 'verified' | 'loading'>('loading');
  const [factors, setFactors] = useState<any[]>([]);
  const [isEnrollingMfa, setIsEnrollingMfa] = useState(false);
  const [mfaQr, setMfaQr] = useState('');
  const [mfaSecret, setMfaSecret] = useState('');
  const [mfaFactorId, setMfaFactorId] = useState('');
  const [mfaCode, setMfaCode] = useState('');

  useEffect(() => {
    const checkMfa = async () => {
      try {
        const { data: factorsData } = await supabase.auth.mfa.listFactors();
        const activeFactors = factorsData?.totp ?? [];
        setFactors(activeFactors.filter(f => f.status === 'verified'));
        if (activeFactors.some(f => f.status === 'verified')) {
           setMfaStatus('verified');
        } else {
           setMfaStatus('unverified');
        }
      } catch (err) {
        console.error('Failed to load MFA:', err);
        setMfaStatus('unverified');
      }
    };
    checkMfa();
  }, []);

  const handleEnrollMfa = async () => {
    setIsEnrollingMfa(true);
    setErrorMessage('');
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
      if (error) throw error;
      setMfaFactorId(data.id);
      setMfaQr(data.totp.qr_code);
      setMfaSecret(data.totp.secret);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to start MFA enrollment');
      setIsEnrollingMfa(false);
    }
  };

  const handleVerifyMfa = async () => {
    setErrorMessage('');
    try {
      const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
      if (challengeErr) throw challengeErr;
      
      const { error } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challenge.id,
        code: mfaCode
      });
      if (error) throw error;
      setSuccessMessage('Two-Factor Authentication successfully enabled!');
      setMfaStatus('verified');
      setIsEnrollingMfa(false);
      
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      setFactors(factorsData?.totp?.filter(f => f.status === 'verified') ?? []);
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid code. Please try again.');
    }
  };

  const handleUnenrollMfa = async () => {
    const ok = await showConfirm("Are you sure you want to disable Two-Factor Authentication? This makes your account less secure.");
    if (!ok) return;
    try {
      for (const factor of factors) {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }
      setMfaStatus('unverified');
      setSuccessMessage('Two-Factor Authentication disabled');
      setFactors([]);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error disabling MFA');
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    setIsUploadingAvatar(true);
    setErrorMessage('');

    try {
      // Show local preview immediately while uploading
      const localUrl = URL.createObjectURL(file);
      setAvatarPreview(localUrl);

      // Upload to Supabase Storage: avatars/{userId}/{timestamp}.{ext}
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${currentUser.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      // Get the public URL
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      // Save URL to profiles table + local store
      updateUser(currentUser.id, { avatar: publicUrl });
      login({ ...user!, avatar: publicUrl });
      setAvatarPreview(publicUrl);

      setSuccessMessage('Profile picture updated successfully');
    } catch (err: any) {
      setErrorMessage(`Failed to upload photo: ${err.message ?? 'Unknown error'}`);
      setAvatarPreview(user?.avatar); // revert preview on failure
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSaveProfile = () => {
    setErrorMessage('');
    setSuccessMessage('');

    if (!name.trim()) {
      setErrorMessage('Name is required');
      return;
    }

    if (!currentUser) {
      setErrorMessage('User not found');
      return;
    }

    // Update user in store
    updateUser(currentUser.id, {
      name: name.trim(),
      avatar: avatarPreview,
    });

    // Update auth store
    login({
      ...user!,
      name: name.trim(),
      avatar: avatarPreview,
    });

    setSuccessMessage('Profile updated successfully');
    setIsEditing(false);
    setCurrentPassword('');
  };

  const handleChangePassword = async () => {
    setErrorMessage('');
    setSuccessMessage('');

    if (!currentUser) return;
    if (!newPassword) {
      setErrorMessage('Please enter a new password');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('New passwords do not match');
      return;
    }

    try {
      // Actually securely update the password with Supabase Auth!
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      // Also update local cache so other components don't freak out
      updateUser(currentUser.id, { password: newPassword });

      setSuccessMessage('Password changed successfully');
      setIsChangingPassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to securely update password');
    }
  };

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">User not found</p>
          <Button variant="link" onClick={() => navigate('/')}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  useSetPageTitle('My Profile', 'Account settings, appearance, and security');

  return (
    <div className="max-w-4xl mx-auto p-6">

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 mb-6">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-6">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {errorMessage}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile Card */}
        <Card className="lg:col-span-1">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-lg">Profile Photo</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <div className="relative mb-4">
              <Avatar className="w-32 h-32 border-4 border-white shadow-lg">
                <AvatarImage src={avatarPreview || currentUser?.avatar} alt={currentUser?.name || user?.name} referrerPolicy="no-referrer" />
                <AvatarFallback className="text-3xl bg-indigo-100 text-indigo-700 font-bold uppercase">
                  {(currentUser?.name || user?.name || '?').charAt(0)}
                </AvatarFallback>
              </Avatar>
              <button
                onClick={handleAvatarClick}
                disabled={isUploadingAvatar}
                className="absolute bottom-0 right-0 h-10 w-10 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-indigo-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isUploadingAvatar
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Camera className="h-4 w-4" />
                }
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>
            <h2 className="text-xl font-bold text-slate-900">{currentUser?.name || user?.name}</h2>
            <p className="text-slate-500 text-sm">{currentUser?.email || user?.email}</p>
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-full">
              <Building2 className="h-3 w-3" />
              {user?.role || 'Employee'}
            </div>
          </CardContent>
        </Card>

        {/* Settings Cards */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Information */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="h-5 w-5 text-indigo-600" />
                    Personal Information
                  </CardTitle>
                  <CardDescription>Update your personal details</CardDescription>
                </div>
                {!isEditing && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setIsEditing(true)}
                  >
                    Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing ? (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Full Name</label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter your full name"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Email Address</label>
                    <Input
                      value={email}
                      disabled
                      className="bg-slate-50"
                    />
                    <p className="text-xs text-slate-400">Email cannot be changed</p>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button 
                      onClick={handleSaveProfile}
                      className="bg-indigo-600 hover:bg-indigo-700"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setIsEditing(false);
                        setName(currentUser?.name || user?.name || '');
                        setAvatarPreview(currentUser?.avatar || user?.avatar);
                        setCurrentPassword('');
                        setErrorMessage('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center">
                        <User className="h-5 w-5 text-indigo-600" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Full Name</p>
                        <p className="text-sm font-medium text-slate-900">{currentUser?.name || user?.name}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center">
                        <Mail className="h-5 w-5 text-indigo-600" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Email Address</p>
                        <p className="text-sm font-medium text-slate-900">{currentUser?.email || user?.email}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Security Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="h-5 w-5 text-indigo-600" />
                    Security
                  </CardTitle>
                  <CardDescription>Manage your password and account security</CardDescription>
                </div>
                {!isChangingPassword && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setIsChangingPassword(true)}
                  >
                    Change Password
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isChangingPassword ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">New Password</label>
                      <Input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password (min. 6 chars)"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Confirm New Password</label>
                      <Input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                      />
                    </div>
                    <div className="flex gap-3 pt-2 items-center">
                      <Button onClick={handleChangePassword} className="bg-indigo-600 hover:bg-indigo-700">
                        <Lock className="h-4 w-4 mr-2" /> Update Password
                      </Button>
                      <Button variant="outline" onClick={() => {
                        setIsChangingPassword(false);
                        setNewPassword('');
                        setConfirmPassword('');
                        setErrorMessage('');
                      }}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4 py-4">
                    <div className="h-10 w-10 shrink-0 rounded-xl bg-orange-50 flex items-center justify-center">
                      <Lock className="h-5 w-5 text-orange-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">Password</p>
                      <p className="text-xs text-slate-500 truncate">Change your login password</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setIsChangingPassword(true)}>
                      Change
                    </Button>
                  </div>
                )}
                
                {/* MFA / Two-Factor Authentication Divider */}
                <div className="h-px bg-slate-100 my-4" />
                
                {isEnrollingMfa ? (
                  <div className="space-y-4 bg-slate-50 border border-slate-200 p-4 rounded-xl">
                    <p className="text-sm font-semibold text-slate-800">Set Up Two-Factor Authentication</p>
                    <p className="text-xs text-slate-600">Scan this QR code with your authenticator app (Authy, Google Authenticator, etc).</p>
                    
                    <div className="flex flex-col items-center">
                      <div className="bg-white p-2 rounded-xl shadow-sm inline-block" dangerouslySetInnerHTML={{ __html: mfaQr }} />
                      <p className="text-[10px] text-slate-500 mt-2 tracking-widest font-mono text-center max-w-[250px] break-all">{mfaSecret}</p>
                    </div>
                    
                    <div className="space-y-2 pt-2">
                       <label className="text-xs font-semibold text-slate-700">Enter Verification Code</label>
                       <Input 
                         type="text" 
                         value={mfaCode} 
                         onChange={(e) => setMfaCode(e.target.value)}
                         placeholder="000000"
                         className="font-mono text-center tracking-widest text-lg h-12"
                         maxLength={6}
                       />
                    </div>
                    
                    <div className="flex gap-3 pt-2">
                      <Button onClick={handleVerifyMfa} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                        Verify & Enable
                      </Button>
                      <Button variant="outline" className="w-full" onClick={() => setIsEnrollingMfa(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4 py-4">
                    <div className="h-10 w-10 shrink-0 rounded-xl bg-emerald-50 flex items-center justify-center">
                       <Shield className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                       <p className="text-sm font-medium text-slate-900 flex items-center gap-2">
                          Two-Factor Authentication
                          {mfaStatus === 'verified' && <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full font-bold">ACTIVE</span>}
                       </p>
                       <p className="text-xs text-slate-500 truncate">Adds an extra layer of security to your account.</p>
                    </div>
                    {mfaStatus === 'loading' ? (
                       <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                    ) : mfaStatus === 'verified' ? (
                       <Button variant="outline" size="sm" onClick={handleUnenrollMfa} className="text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200">
                         Disable
                       </Button>
                    ) : (
                       <Button variant="outline" size="sm" onClick={handleEnrollMfa}>
                         Enable
                       </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          {/* Appearance / Theme */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Palette className="h-5 w-5 text-indigo-600" />
                Appearance
              </CardTitle>
              <CardDescription>Choose your preferred color theme and mode</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Theme Settings Dropdowns */}
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 block">Mode</label>
                  <select 
                    value={isDark ? 'dark' : 'light'} 
                    onChange={() => toggle()}
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 block">Color Theme</label>
                  <select
                    value={colorTheme}
                    onChange={(e) => setColorTheme(e.target.value as ColorTheme)}
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {THEME_OPTIONS.map(opt => (
                      <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 block">App Layout Theme</label>
                  <select
                    value={uiTheme}
                    onChange={(e) => setUITheme(e.target.value as UITheme)}
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {UI_THEME_OPTIONS.map(opt => (
                      <option key={opt.id} value={opt.id}>{opt.label} - {opt.description}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Floating Calendar Toggle */}
              <div className="h-px bg-slate-100 dark:bg-slate-800" />
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center">
                    <CalendarDays className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">Floating Calendar</p>
                    <p className="text-xs text-slate-500">Quick-access calendar tab on the right edge</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowFloatingCalendar(!showFloatingCalendar)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    showFloatingCalendar ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                    showFloatingCalendar ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}


