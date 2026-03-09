import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Shield, Lock, Mail, User } from 'lucide-react';
import { useUserStore, FULL_ACCESS } from '@/src/store/userStore';

export function SuperAdminSetup() {
  const { superAdminCreated, superAdminSignupEnabled, addUser, setSuperAdminCreated, setCurrentUser } = useUserStore();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');

  // If already created or disabled, redirect
  if (superAdminCreated || !superAdminSignupEnabled) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <Shield className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 text-sm">
              {superAdminCreated ? 'Super Admin has already been created.' : 'Super Admin signup has been disabled.'}
            </p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/login')}>Go to Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.name || !form.email || !form.password) { setError('All fields are required.'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return; }

    const id = crypto.randomUUID();
    addUser({
      id,
      name: form.name,
      email: form.email,
      password: form.password,
      privileges: FULL_ACCESS,
      isActive: true,
      createdAt: new Date().toISOString(),
    });
    setSuperAdminCreated();
    setCurrentUser(id);
    navigate('/');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center space-y-3 text-center">
          <div className="h-14 w-14 rounded-xl bg-indigo-600 flex items-center justify-center">
            <Shield className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">First-Time Setup</h1>
          <p className="text-sm text-slate-500">Create your Super Admin account. This page is only available once.</p>
        </div>

        <Card>
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle className="text-base">Super Admin Account</CardTitle>
              <CardDescription>This account will have full system access.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Admin Name" className="pl-10" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="admin@company.com" className="pl-10" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" className="pl-10" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} placeholder="••••••••" className="pl-10" />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                Create Super Admin & Enter System
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
