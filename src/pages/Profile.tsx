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
        {/* Profile Card */}
        <Card className="lg:col-span-1 h-fit overflow-hidden border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl">
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

        {/* Settings Cards */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Information */}
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

          {/* Security Settings */}
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
                {!isChangingPassword && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setIsChangingPassword(true)}
                    className="h-8 px-4 rounded-lg font-bold text-[10px] uppercase tracking-wider border-slate-200 dark:border-slate-700"
                  >
                    Update
                  </Button>
                )}
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
              </CardContent>
          </Card>

          {/* Appearance / Theme */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden rounded-2xl">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shadow-sm">
                  <Palette className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold text-slate-800 dark:text-slate-200">Appearance</CardTitle>
                  <CardDescription className="text-xs text-slate-500">Workspace Themes</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {/* Theme Settings Dropdowns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2 px-1">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 ml-1">Color Mode</label>
                  <select 
                    value={isDark ? 'dark' : 'light'} 
                    onChange={() => toggle()}
                    className="flex h-11 w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 px-4 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer font-bold"
                  >
                    <option value="light">☀️ Light Mode</option>
                    <option value="dark">🌙 Dark Mode</option>
                  </select>
                </div>

                <div className="space-y-2 px-1">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 ml-1">Accent Color</label>
                  <select
                    value={colorTheme}
                    onChange={(e) => setColorTheme(e.target.value as ColorTheme)}
                    className="flex h-11 w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 px-4 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer font-bold"
                  >
                    {THEME_OPTIONS.map(opt => (
                      <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2 space-y-2 px-1">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 ml-1">UI Interaction Style</label>
                  <select
                    value={uiTheme}
                    onChange={(e) => setUITheme(e.target.value as UITheme)}
                    className="flex h-11 w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 px-4 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer font-bold"
                  >
                    {UI_THEME_OPTIONS.map(opt => (
                      <option key={opt.id} value={opt.id}>{opt.label} - {opt.description}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Floating Calendar Toggle */}
              <div className="h-px bg-slate-100 dark:bg-slate-800 my-2" />
              <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/50">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-indigo-50 dark:bg-slate-800 flex items-center justify-center border border-slate-100 dark:border-slate-700">
                    <CalendarDays className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Floating Calendar</p>
                    <p className="text-xs font-medium text-slate-500">Sidebar quick-access</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowFloatingCalendar(!showFloatingCalendar)}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 shadow-inner ${
                    showFloatingCalendar ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-xl transition-transform duration-300 ${
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


