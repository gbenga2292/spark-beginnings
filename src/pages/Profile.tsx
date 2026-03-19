import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/src/store/auth';
import { useUserStore } from '@/src/store/userStore';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/src/components/ui/avatar';
import { supabase } from '@/src/integrations/supabase/client';
import { useTheme, ALL_COLOR_THEMES, type ColorTheme } from '@/src/hooks/useTheme';
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
  Check
} from 'lucide-react';


const THEME_OPTIONS: { id: ColorTheme; label: string; swatches: string[] }[] = [
  { id: 'default', label: 'Indigo',  swatches: ['#4f46e5', '#6366f1', '#818cf8'] },
  { id: 'ocean',   label: 'Ocean',   swatches: ['#2563eb', '#3b82f6', '#60a5fa'] },
  { id: 'forest',  label: 'Forest',  swatches: ['#059669', '#10b981', '#34d399'] },
  { id: 'sunset',  label: 'Sunset',  swatches: ['#d97706', '#f59e0b', '#fbbf24'] },
  { id: 'rose',    label: 'Rose',    swatches: ['#e11d48', '#f43f5e', '#fb7185'] },
  { id: 'violet',  label: 'Violet',  swatches: ['#7c3aed', '#8b5cf6', '#a78bfa'] },
  { id: 'slate',   label: 'Slate',   swatches: ['#475569', '#64748b', '#94a3b8'] },
];

export function Profile() {
  const navigate = useNavigate();
  const { user, login } = useAuthStore();
  const { updateUser, getCurrentUser } = useUserStore();
  const { isDark, toggle, colorTheme, setColorTheme } = useTheme();
  const currentUser = getCurrentUser();
  
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(user?.avatar);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form states
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Messages
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

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

  const handleChangePassword = () => {
    setErrorMessage('');
    setSuccessMessage('');

    if (!currentUser) {
      setErrorMessage('User not found');
      return;
    }

    if (!currentPassword) {
      setErrorMessage('Please enter your current password');
      return;
    }

    if (currentPassword !== currentUser.password) {
      setErrorMessage('Current password is incorrect');
      return;
    }

    if (!newPassword) {
      setErrorMessage('Please enter a new password');
      return;
    }

    if (newPassword.length < 4) {
      setErrorMessage('Password must be at least 4 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('New passwords do not match');
      return;
    }

    // Update password
    updateUser(currentUser.id, {
      password: newPassword,
    });

    setSuccessMessage('Password changed successfully');
    setIsChangingPassword(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
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

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => navigate('/')}
          className="h-10 w-10"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
          <p className="text-slate-500 text-sm">Manage your account settings and security</p>
        </div>
      </div>

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
                <AvatarImage src={avatarPreview} alt={user?.name} referrerPolicy="no-referrer" />
                <AvatarFallback className="text-3xl bg-indigo-100 text-indigo-700 font-bold">
                  {user?.name?.charAt(0)}
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
            <h2 className="text-xl font-bold text-slate-900">{user?.name}</h2>
            <p className="text-slate-500 text-sm">{user?.email}</p>
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
                        setName(user?.name || '');
                        setAvatarPreview(user?.avatar);
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
                        <p className="text-sm font-medium text-slate-900">{user?.name}</p>
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
                        <p className="text-sm font-medium text-slate-900">{user?.email}</p>
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
                    <label className="text-sm font-medium text-slate-700">Current Password</label>
                    <Input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">New Password</label>
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
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
                  <div className="flex gap-3 pt-2">
                    <Button 
                      onClick={handleChangePassword}
                      className="bg-indigo-600 hover:bg-indigo-700"
                    >
                      <Lock className="h-4 w-4 mr-2" />
                      Update Password
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setIsChangingPassword(false);
                        setCurrentPassword('');
                        setNewPassword('');
                        setConfirmPassword('');
                        setErrorMessage('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4 py-4">
                  <div className="h-12 w-12 rounded-xl bg-emerald-50 flex items-center justify-center">
                    <Lock className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">Password</p>
                    <p className="text-xs text-slate-500">Last changed: Never</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setIsChangingPassword(true)}
                  >
                    Change
                  </Button>
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
              {/* Light / Dark toggle */}
              <div>
                <label className="text-sm font-medium text-slate-700 mb-3 block">Mode</label>
                <div className="flex gap-3">
                  <button
                    onClick={toggle}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      !isDark
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <Sun className="h-4 w-4" /> Light
                  </button>
                  <button
                    onClick={toggle}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      isDark
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <Moon className="h-4 w-4" /> Dark
                  </button>
                </div>
              </div>

              {/* Color themes */}
              <div>
                <label className="text-sm font-medium text-slate-700 mb-3 block">Color Theme</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {THEME_OPTIONS.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setColorTheme(opt.id)}
                      className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                        colorTheme === opt.id
                          ? 'border-indigo-500 bg-indigo-50/60 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {colorTheme === opt.id && (
                        <div className="absolute top-2 right-2">
                          <Check className="h-4 w-4 text-indigo-600" />
                        </div>
                      )}
                      <div className="flex gap-1">
                        {opt.swatches.map((c, i) => (
                          <div key={i} className="w-5 h-5 rounded-full" style={{ backgroundColor: c }} />
                        ))}
                      </div>
                      <span className="text-xs font-medium text-slate-700">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}


