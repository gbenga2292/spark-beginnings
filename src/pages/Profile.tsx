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
  CalendarDays,
  Fingerprint,
  Upload,
  Trash2,
  Sparkles,
  RotateCcw
} from 'lucide-react';
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth';
import { useSetPageTitle } from '@/src/contexts/PageContext';
import { toast, showConfirm } from '@/src/components/ui/toast';

const COLOR_THEMES: { id: ColorTheme; label: string; swatches: string[] }[] = [
  { id: 'default', label: 'Default (Indigo)', swatches: ['#4f46e5', '#6366f1', '#818cf8'] },
  { id: 'ocean',   label: 'Ocean Blue',  swatches: ['#2563eb', '#3b82f6', '#60a5fa'] },
  { id: 'forest',  label: 'Forest Green',swatches: ['#059669', '#10b981', '#34d399'] },
  { id: 'sunset',  label: 'Sunset Amber',swatches: ['#d97706', '#f59e0b', '#fbbf24'] },
  { id: 'rose',    label: 'Rose Pink',   swatches: ['#e11d48', '#f43f5e', '#fb7185'] },
  { id: 'violet',  label: 'Royal Violet',swatches: ['#7c3aed', '#8b5cf6', '#a78bfa'] },
  { id: 'slate',   label: 'Slate Gray',  swatches: ['#475569', '#64748b', '#94a3b8'] },
  { id: 'burgundy',label: 'Burgundy IDE',swatches: ['#380000', '#9f1239', '#fb7185'] },
  { id: 'midnight',label: 'Midnight IDE',swatches: ['#001428', '#0284c7', '#38bdf8'] },
  { id: 'monokai', label: 'Monokai IDE', swatches: ['#272822', '#88c010', '#a6e22e'] },
  { id: 'solarized',label: 'Solarized Dark', swatches: ['#002b36', '#218c83', '#2aa198'] },
  { id: 'tokyo-night',label: 'Tokyo Night', swatches: ['#1a1b26', '#4264b3', '#7aa2f7'] },
];

export function Profile() {
  const navigate = useNavigate();
  const { user, login } = useAuthStore();
  const { updateUser, getCurrentUser } = useUserStore();
  const { isDark, setLight, setDark, colorTheme, setColorTheme, showFloatingCalendar, setShowFloatingCalendar } = useTheme();
  const currentUser = getCurrentUser();
  
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(currentUser?.avatar || user?.avatar);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [signaturePreview, setSignaturePreview] = useState<string | undefined>(currentUser?.signature || (user as any)?.signature);
  const [isUploadingSignature, setIsUploadingSignature] = useState(false);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  
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

  // Biometric States
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const [showBiometricPasswordPrompt, setShowBiometricPasswordPrompt] = useState(false);
  const [biometricSetupPassword, setBiometricSetupPassword] = useState('');

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

    const checkBiometric = async () => {
      try {
        const info = await BiometricAuth.checkBiometry();
        setIsBiometricAvailable(info.isAvailable);
      } catch (e) {
        setIsBiometricAvailable(false);
      }
    };
    checkBiometric();
    setIsBiometricEnabled(!!localStorage.getItem('biometric_credentials'));
  }, []);

  const handleToggleBiometric = async () => {
    setErrorMessage('');
    if (isBiometricEnabled) {
      localStorage.removeItem('biometric_credentials');
      setIsBiometricEnabled(false);
      setSuccessMessage('Biometric Sign-In disabled.');
    } else {
      setShowBiometricPasswordPrompt(true);
    }
  };

  const handleEnableBiometric = async () => {
    setErrorMessage('');
    if (!biometricSetupPassword) {
      setErrorMessage('Please enter your password to enable Biometrics.');
      return;
    }
    try {
      const emailToUse = currentUser?.email || user?.email;
      if (!emailToUse) throw new Error('No email found');
      
      const { error } = await supabase.auth.signInWithPassword({ email: emailToUse, password: biometricSetupPassword });
      if (error) throw error;
      
      await BiometricAuth.authenticate({ reason: 'Authenticate to enable Biometric Sign-In' });
      
      const creds = btoa(JSON.stringify({ email: emailToUse, password: biometricSetupPassword }));
      localStorage.setItem('biometric_credentials', creds);
      setIsBiometricEnabled(true);
      setShowBiometricPasswordPrompt(false);
      setBiometricSetupPassword('');
      setSuccessMessage('Biometric Sign-In enabled successfully.');
    } catch (err: any) {
      if (err.code === 'userCancel' || err.code === 'systemCancel') {
        // User cancelled, do nothing
      } else {
        setErrorMessage(err.message || 'Biometric verification failed.');
      }
    }
  };

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

  const handleSignatureClick = () => {
    signatureInputRef.current?.click();
  };

  const handleSignatureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    setIsUploadingSignature(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      // Show local preview immediately
      const localUrl = URL.createObjectURL(file);
      setSignaturePreview(localUrl);

      // Upload to webserver (same as DailyJournal photo uploads)
      const MEDIA_SERVER_URL = import.meta.env.VITE_MEDIA_SERVER_URL || 'https://dewaterconstruct.com/dcel-media';
      const formData = new FormData();
      formData.append('media', file);
      formData.append('type', 'signature');
      formData.append('uploaded_by', currentUser.id);
      formData.append('uploaded_by_name', currentUser.name);

      const response = await fetch(`${MEDIA_SERVER_URL}/upload-signature.php`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error(`Upload failed: ${response.statusText}`);

      const result = await response.json();
      const publicUrl: string = result.url || result.path || result.file_url;
      if (!publicUrl) throw new Error('Server did not return a file URL');

      // Save URL to profiles table + local store
      updateUser(currentUser.id, { signature: publicUrl });
      login({ ...user!, signature: publicUrl } as any);
      setSignaturePreview(publicUrl);

      setSuccessMessage('Signature uploaded successfully');
    } catch (err: any) {
      setErrorMessage(`Failed to upload signature: ${err.message ?? 'Unknown error'}`);
      setSignaturePreview(currentUser?.signature || (user as any)?.signature); // revert preview on failure
    } finally {
      setIsUploadingSignature(false);
      // Reset the input so the same file can be re-selected if needed
      if (signatureInputRef.current) signatureInputRef.current.value = '';
    }
  };


  const handleRemoveSignature = async () => {
    if (!currentUser) return;
    setErrorMessage('');
    setSuccessMessage('');
    try {
      updateUser(currentUser.id, { signature: '' });
      login({ ...user!, signature: '' } as any);
      setSignaturePreview(undefined);
      setSuccessMessage('Signature removed successfully');
    } catch (err: any) {
      setErrorMessage(`Failed to remove signature: ${err.message ?? 'Unknown error'}`);
    }
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

  useSetPageTitle('My Profile', 'Account settings, appearance, and security', null, [], true);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 sm:py-8 pb-20 sm:pb-10">

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="flex items-center gap-3 text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl px-4 py-4 mb-6 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-500" />
          <p className="font-bold">{successMessage}</p>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center gap-3 text-sm text-red-600 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl px-4 py-4 mb-6 animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-500" />
          <p className="font-bold">{errorMessage}</p>
        </div>
      )}

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        {/* Left Column (1 col): Profile Photo & Signature stacked */}
        <div className="lg:col-span-1 space-y-6">
          {/* Profile Card */}
          <Card className="h-fit overflow-hidden border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl">
            <CardHeader className="text-center pb-3 border-b border-slate-100 dark:border-slate-800 mb-6 bg-slate-50/50 dark:bg-slate-900/50">
              <CardTitle className="text-sm font-semibold text-slate-800 dark:text-slate-200">Profile Photo</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center pt-2 pb-8">
              <div className="relative mb-6">
                <div className="relative p-1.5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 shadow-xl">
                  <Avatar className="w-28 h-28 sm:w-32 sm:h-32 border-4 border-white dark:border-slate-900 shadow-inner">
                    <AvatarImage src={avatarPreview || currentUser?.avatar} alt={currentUser?.name || user?.name} referrerPolicy="no-referrer" />
                    <AvatarFallback className="text-3xl bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-bold uppercase">
                      {(currentUser?.name || user?.name || '?').charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <button
                  onClick={handleAvatarClick}
                  disabled={isUploadingAvatar}
                  className="absolute bottom-1 right-1 h-10 w-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-lg hover:scale-110 active:scale-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isUploadingAvatar
                    ? <Loader2 className="h-5 w-5 animate-spin" />
                    : <Camera className="h-5 w-5" />
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
              <h2 className="text-xl font-bold text-slate-900 dark:text-white text-center px-2">{currentUser?.name || user?.name}</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">{currentUser?.email || user?.email}</p>
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 px-4 py-1.5 rounded-full border border-indigo-100 dark:border-indigo-800 shadow-sm">
                <Building2 className="h-3.5 w-3.5" />
                {user?.role || 'Employee'}
              </div>
            </CardContent>
          </Card>

          {/* User Signature Card */}
          <Card className="h-fit overflow-hidden border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl">
            <CardHeader className="text-center pb-3 border-b border-slate-100 dark:border-slate-800 mb-6 bg-slate-50/50 dark:bg-slate-900/50">
              <CardTitle className="text-sm font-semibold text-slate-800 dark:text-slate-200">My Signature</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center pt-2 pb-8">
              <div className="relative mb-6 w-full max-w-[200px] aspect-[2/1] border border-dashed border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-center bg-slate-50/50 dark:bg-slate-950/50 overflow-hidden">
                {signaturePreview ? (
                  <img src={signaturePreview} alt="Signature Preview" className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-xs text-slate-400 font-medium">No signature uploaded</span>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSignatureClick}
                  disabled={isUploadingSignature}
                  className="gap-2 h-9 rounded-xl border-slate-200 dark:border-slate-800 hover:bg-slate-50 font-semibold text-xs"
                >
                  {isUploadingSignature ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 text-indigo-600" />
                  )}
                  Upload Signature
                </Button>
                {signaturePreview && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveSignature}
                    className="h-9 rounded-xl text-rose-600 hover:bg-rose-50 hover:text-rose-700 font-semibold text-xs"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <input
                ref={signatureInputRef}
                type="file"
                accept="image/*"
                onChange={handleSignatureChange}
                className="hidden"
              />
              <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center mt-3 max-w-[180px]">
                Upload a transparent PNG or clean image of your signature to include on return sheets.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Right Column (2 cols): Appearance (Top), Personal Information, Security & Access */}
        <div className="lg:col-span-2 space-y-6">
          {/* 1. Appearance & Theme */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden rounded-2xl">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shadow-sm">
                  <Palette className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold text-slate-800 dark:text-slate-200">Appearance & Theme</CardTitle>
                  <CardDescription className="text-xs text-slate-500">Light / Dark mode and workspace color theme</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {/* Mode Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 ml-1">Display Mode</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setLight()}
                    className={`flex items-center justify-center gap-2.5 p-3 rounded-xl border text-sm font-bold transition-all cursor-pointer ${
                      !isDark
                        ? 'bg-white text-slate-900 border-indigo-600 dark:border-indigo-400 ring-2 ring-indigo-500/20 shadow-md'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    <Sun className={`h-4 w-4 ${!isDark ? 'text-amber-500' : 'text-slate-400'}`} />
                    Light Mode
                    {!isDark && <Check className="h-4 w-4 text-indigo-600 dark:text-indigo-400 ml-1" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDark()}
                    className={`flex items-center justify-center gap-2.5 p-3 rounded-xl border text-sm font-bold transition-all cursor-pointer ${
                      isDark
                        ? 'bg-slate-900 text-white border-indigo-500 ring-2 ring-indigo-500/30 shadow-md'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    <Moon className={`h-4 w-4 ${isDark ? 'text-indigo-400' : 'text-slate-400'}`} />
                    Dark Mode
                    {isDark && <Check className="h-4 w-4 text-indigo-400 ml-1" />}
                  </button>
                </div>
              </div>

              {/* Theme Selection */}
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 ml-1">Color Theme</label>
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      {isDark ? 'Active in Dark Mode' : 'Active in Light Mode'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {colorTheme !== 'default' && (
                      <button
                        type="button"
                        onClick={() => setColorTheme('default')}
                        className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors cursor-pointer px-2.5 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-xs"
                        title="Reset to default theme"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Reset to Default
                      </button>
                    )}
                    <span className="text-[10px] text-slate-400">
                      {isDark ? 'Customized for Dark Mode' : 'Customized for Light Mode'}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                  {COLOR_THEMES.map((theme) => {
                    const isActive = colorTheme === theme.id;
                    const isDefault = theme.id === 'default';
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => setColorTheme(theme.id)}
                        className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          isActive
                            ? 'border-indigo-600 dark:border-indigo-400 bg-indigo-50/70 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20 shadow-sm font-bold'
                            : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="flex -space-x-1 shrink-0">
                            {theme.swatches.map((hex, i) => (
                              <span
                                key={i}
                                className="w-3.5 h-3.5 rounded-full border border-white dark:border-slate-900 shadow-sm"
                                style={{ backgroundColor: hex }}
                              />
                            ))}
                          </div>
                          <div className="min-w-0 flex items-center gap-1.5">
                            <span className="text-xs truncate">{theme.label}</span>
                            {isDefault && (
                              <span className="text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shrink-0">
                                Default
                              </span>
                            )}
                          </div>
                        </div>
                        {isActive && (
                          <Check className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0 ml-1" />
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Each theme features a crisp Light Mode and a fully themed Dark IDE workspace. Changing a theme here applies just to {isDark ? 'Dark Mode' : 'Light Mode'}.
                </p>
              </div>

              {/* Floating Calendar */}
              <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
              <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/50">
                <div className="flex items-center gap-3.5">
                  <div className="h-9 w-9 rounded-lg bg-indigo-50 dark:bg-slate-800 flex items-center justify-center border border-slate-100 dark:border-slate-700">
                    <CalendarDays className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900 dark:text-white">Floating Calendar</p>
                    <p className="text-[11px] text-slate-500">Quick-access sidebar calendar overlay</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFloatingCalendar(!showFloatingCalendar)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 shadow-inner cursor-pointer ${
                    showFloatingCalendar ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-300 ${
                    showFloatingCalendar ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            </CardContent>
          </Card>

          {/* 2. Personal Information */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden rounded-2xl">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shadow-sm">
                    <User className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold text-slate-800 dark:text-slate-200">Personal Details</CardTitle>
                    <CardDescription className="text-xs text-slate-500">Identity & Contact</CardDescription>
                  </div>
                </div>
                {!isEditing && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    className="h-8 px-4 rounded-lg font-bold text-[10px] uppercase tracking-wider border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-5">
              {isEditing ? (
                <div className="space-y-5 animate-in fade-in duration-300">
                  <div className="space-y-2 px-1">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 ml-1">Full Name</label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter your full name"
                      className="h-11 rounded-lg bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-800 font-bold"
                    />
                  </div>
                  <div className="space-y-2 px-1">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 ml-1">Email Address</label>
                    <Input
                      value={email}
                      disabled
                      className="h-11 rounded-lg bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-60 text-slate-500 font-bold"
                    />
                    <p className="text-[10px] text-slate-400 italic px-2 font-medium">Registered email cannot be changed</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <Button 
                      onClick={handleSaveProfile}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 rounded-xl shadow-lg active:scale-95 transition-all"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </Button>
                    <Button 
                      variant="ghost"
                      onClick={() => {
                        setIsEditing(false);
                        setName(currentUser?.name || user?.name || '');
                        setAvatarPreview(currentUser?.avatar || user?.avatar);
                        setCurrentPassword('');
                        setErrorMessage('');
                      }}
                      className="h-11 rounded-xl font-bold text-slate-500 dark:text-slate-400"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-4 p-3 rounded-xl bg-white dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/50">
                    <div className="h-10 w-10 rounded-lg bg-indigo-50 dark:bg-slate-800 flex items-center justify-center border border-slate-100 dark:border-slate-700">
                      <User className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-500">Full Name</p>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{currentUser?.name || user?.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-3 rounded-xl bg-white dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/50">
                    <div className="h-10 w-10 rounded-lg bg-indigo-50 dark:bg-slate-800 flex items-center justify-center border border-slate-100 dark:border-slate-700">
                      <Mail className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-500">Email Address</p>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{currentUser?.email || user?.email}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 3. Security Settings */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden rounded-2xl">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center shadow-sm">
                    <Shield className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold text-slate-800 dark:text-slate-200">Security & Access</CardTitle>
                    <CardDescription className="text-xs text-slate-500">Credentials & MFA</CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {isChangingPassword ? (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="space-y-2 px-1">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 ml-1">New Password</label>
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min. 6 characters"
                      className="h-11 rounded-lg bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 font-bold"
                    />
                  </div>
                  <div className="space-y-2 px-1">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 ml-1">Confirm Password</label>
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm your new password"
                      className="h-11 rounded-lg bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 font-bold"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <Button onClick={handleChangePassword} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 rounded-xl shadow-lg active:scale-95 transition-all">
                      <Lock className="h-4 w-4 mr-2" /> Change Password
                    </Button>
                    <Button variant="ghost" onClick={() => {
                      setIsChangingPassword(false);
                      setNewPassword('');
                      setConfirmPassword('');
                      setErrorMessage('');
                    }} className="h-11 rounded-xl font-bold text-slate-500 dark:text-slate-400">Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4 py-2">
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-orange-50 dark:bg-orange-950/20 flex items-center justify-center border border-orange-100 dark:border-orange-900/30">
                    <Lock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Account Password</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">Last changed recently</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setIsChangingPassword(true)} className="rounded-lg h-8 text-xs font-medium border-slate-200 dark:border-slate-700 shadow-sm">
                    Change
                  </Button>
                </div>
              )}
              
              {/* MFA / Two-Factor Authentication Divider */}
              <div className="h-px bg-slate-100 dark:bg-slate-800 my-6" />
              
              {isEnrollingMfa ? (
                <div className="space-y-5 bg-slate-50 dark:bg-slate-800/50 border border-indigo-100 dark:border-indigo-900/30 p-5 rounded-xl animate-in zoom-in-95 duration-300">
                  <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
                      <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">MFA Setup Wizard</p>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Scan this code with an Authenticator app (Authy, Google Authenticator, etc).</p>
                  
                  <div className="flex flex-col items-center py-2">
                    <div className="bg-white p-3 rounded-xl shadow-xl inline-block border-4 border-white" dangerouslySetInnerHTML={{ __html: mfaQr }} />
                    <div className="mt-4 p-2 bg-slate-100 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 w-full max-w-[280px]">
                      <p className="text-[9px] font-bold text-slate-500 dark:text-slate-500 uppercase text-center mb-1">Manual Entry Secret</p>
                      <p className="text-[10px] text-slate-600 dark:text-slate-300 tracking-widest font-mono text-center break-all select-all">{mfaSecret}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2 pt-2">
                     <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 text-center block">6-Digit Verification Code</label>
                     <Input 
                       type="text" 
                       value={mfaCode} 
                       onChange={(e) => setMfaCode(e.target.value)}
                       placeholder="000 000"
                       className="font-mono text-center tracking-[0.5em] text-2xl h-14 rounded-xl border-indigo-200 dark:border-indigo-900 bg-white dark:bg-slate-900 shadow-inner"
                       maxLength={6}
                     />
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <Button onClick={handleVerifyMfa} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 rounded-xl shadow-lg active:scale-95 transition-all">
                      Verify & Enable
                    </Button>
                    <Button variant="ghost" className="w-full font-bold text-slate-500" onClick={() => setIsEnrollingMfa(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4 py-2">
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-center border border-emerald-100 dark:border-emerald-900/30">
                     <Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                     <p className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        Two-Factor Auth
                        {mfaStatus === 'verified' && <span className="bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 text-[10px] px-2 py-0.5 rounded-full font-bold border border-emerald-200 dark:border-emerald-800 shadow-sm animate-pulse">ACTIVE</span>}
                     </p>
                     <p className="text-xs text-slate-500 dark:text-slate-400 truncate">Login verification via 6-digit codes</p>
                  </div>
                  {mfaStatus === 'loading' ? (
                     <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  ) : mfaStatus === 'verified' ? (
                     <Button variant="outline" size="sm" onClick={handleUnenrollMfa} className="rounded-lg h-8 text-xs font-medium border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 shadow-sm">
                       Disable
                     </Button>
                  ) : (
                     <Button variant="outline" size="sm" onClick={handleEnrollMfa} className="rounded-lg h-8 text-xs font-medium border-slate-200 dark:border-slate-700 shadow-sm">
                       Enable
                     </Button>
                  )}
                </div>
              )}
              
              {/* Biometric Authentication */}
              <div className="h-px bg-slate-100 dark:bg-slate-800 my-4" />
              {showBiometricPasswordPrompt ? (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Verify Password to Enable Biometrics</p>
                  <div className="space-y-2 px-1">
                    <Input
                      type="password"
                      value={biometricSetupPassword}
                      onChange={(e) => setBiometricSetupPassword(e.target.value)}
                      placeholder="Enter your current password"
                      className="h-11 rounded-lg bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 font-bold"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <Button onClick={handleEnableBiometric} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 rounded-xl shadow-lg active:scale-95 transition-all">
                      Verify & Enable
                    </Button>
                    <Button variant="ghost" onClick={() => {
                      setShowBiometricPasswordPrompt(false);
                      setBiometricSetupPassword('');
                      setErrorMessage('');
                    }} className="h-11 rounded-xl font-bold text-slate-500 dark:text-slate-400">Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between py-2 p-3 rounded-xl bg-white dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/50">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 shrink-0 rounded-xl bg-blue-50 dark:bg-blue-950/20 flex items-center justify-center border border-blue-100 dark:border-blue-900/30">
                      <Fingerprint className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        Biometric Sign-In
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {isBiometricAvailable ? "Log in using Fingerprint or Face ID" : "Not supported on this device/browser"}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleBiometric}
                    disabled={!isBiometricAvailable && !isBiometricEnabled}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 shadow-inner ${
                      isBiometricEnabled ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'
                    } ${!isBiometricAvailable && !isBiometricEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-xl transition-transform duration-300 ${
                      isBiometricEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}


