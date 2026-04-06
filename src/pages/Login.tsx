import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/src/hooks/useAuth';
import { useAuthStore } from '@/src/store/auth';
import { useUserStore } from '@/src/store/userStore';
import { supabase } from '@/src/integrations/supabase/client';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Mail, Lock, AlertCircle, ShieldCheck, Users, BarChart3, ArrowRight, Eye, EyeOff } from 'lucide-react';
import logoSrc from '../../logo/logo-2.png';

const CURRENT_YEAR = new Date().getFullYear();

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [savedEmails, setSavedEmails] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState(false);

  const { signIn } = useAuth();
  const login = useAuthStore((state) => state.login);
  const { setCurrentUser } = useUserStore();
  const navigate = useNavigate();

  useEffect(() => {
    // Load saved emails for autocomplete memory
    try {
      const emails = JSON.parse(localStorage.getItem('savedLoginEmails') || '[]');
      if (Array.isArray(emails)) {
        setSavedEmails(emails);
      }
    } catch (e) {
      console.error('Could not parse saved emails');
    }

    // Load remembered email if 'Remember me' was checked
    const lastRemembered = localStorage.getItem('lastRememberedEmail');
    if (lastRemembered) {
      setEmail(lastRemembered);
      setRememberMe(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Domain validation
    if (!email.toLowerCase().endsWith('@dewaterconstruct.com')) {
      setError('Only @dewaterconstruct.com email addresses are allowed.');
      setIsLoading(false);
      return;
    }

    try {
      const { error: authError } = await signIn(email, password);
      if (authError) {
        setError(authError.message || 'Login failed.');
        setIsLoading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Authentication failed.');
        setIsLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile && !profile.is_active) {
        setError('Your account has been disabled. Contact an administrator.');
        await supabase.auth.signOut();
        setIsLoading(false);
        return;
      }

      let userRole: any = 'Employee';
      if (profile?.privileges) {
        if (profile.privileges.users?.canManage) userRole = 'Super Admin';
        else if (profile.privileges.employees?.canEdit) userRole = 'HR Manager';
        else if (profile.privileges.billing?.canCreate) userRole = 'Finance';
      }

      login({
        id: user.id,
        name: profile?.name || user.email || '',
        email: user.email || '',
        role: userRole,
        avatar: profile?.avatar,
      });
      setCurrentUser(user.id);

      // Save email for memory (autocomplete)
      try {
        const currentEmails = JSON.parse(localStorage.getItem('savedLoginEmails') || '[]');
        const updatedEmails = [email, ...currentEmails.filter((e: string) => e !== email)].slice(0, 5); // Keep up to 5 unique emails
        localStorage.setItem('savedLoginEmails', JSON.stringify(updatedEmails));
      } catch (e) {
        console.error('Error saving email memory');
      }

      // Handle remember me
      if (rememberMe) {
        localStorage.setItem('lastRememberedEmail', email);
      } else {
        localStorage.removeItem('lastRememberedEmail'); // Clear if not checked
      }

      setIsLoading(false);
      navigate('/');
    } catch (err: any) {
      const isOffline =
        !navigator.onLine ||
        err?.message === 'Failed to fetch' ||
        err?.message?.toLowerCase().includes('network') ||
        err?.message?.toLowerCase().includes('fetch');
      setError(
        isOffline
          ? 'No internet connection. Please check your network and try again.'
          : err.message || 'An error occurred.'
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-full flex">
      {/* ── Left Panel ─────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[55%] bg-gradient-to-br from-[#0d1b3e] via-[#0f2260] to-[#0d1b3e] relative overflow-hidden flex-col justify-between">

        {/* Decorative blobs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -left-32 w-[500px] h-[500px] bg-indigo-600/15 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/3 w-72 h-72 bg-purple-600/10 rounded-full blur-3xl" />
        </div>

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M0 0h1v40H0zm39 0h1v40h-1zM0 0v1h40V0zm0 39v1h40v-1z'/%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center flex-1 px-14 xl:px-20 py-12">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-14">
            <img src={logoSrc} alt="DCEL" className="h-14 xl:h-16 w-auto drop-shadow-xl" />
          </div>

          {/* Headline */}
          <div className="mb-10">
            <h1 className="text-4xl xl:text-[2.75rem] font-extrabold text-white leading-tight tracking-tight mb-4">
              Office Management Tool<br />
              <span className="text-blue-300">For Dewatering Construction</span><br />
              <span className="text-slate-300 text-3xl xl:text-4xl">Etc Limited</span>
            </h1>
            <p className="text-slate-400 text-base xl:text-lg max-w-sm leading-relaxed">
              A complete HR &amp; finance platform purpose-built for DCEL's operations — from payroll to invoicing, all in one place.
            </p>
          </div>

          {/* Feature list */}
          <div className="space-y-4">
            {[
              { icon: ShieldCheck, title: 'Enterprise-Grade Security', desc: 'Role-based access control for every team member' },
              { icon: Users, title: 'HR & Payroll Management', desc: 'Employees, attendance, leaves and salary in one system' },
              { icon: BarChart3, title: 'Financial Reporting', desc: 'Invoices, payments, VAT and account reports at a glance' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-4">
                <div className="flex-shrink-0 w-9 h-9 bg-blue-500/20 border border-blue-500/30 rounded-lg flex items-center justify-center mt-0.5">
                  <Icon className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom gradient line */}
        <div className="relative z-10 h-1 bg-gradient-to-r from-blue-500 via-purple-400 to-blue-500" />
      </div>

      {/* ── Right Panel (Form) ──────────────────────────────────── */}
      <div className="w-full lg:w-[45%] flex items-center justify-center px-6 py-12 sm:px-12 bg-white">
        <div className="w-full max-w-[400px]">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-10">
            <img src={logoSrc} alt="DCEL" className="h-12 w-auto" />
          </div>

          {/* Heading */}
          <div className="mb-8">
            <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-widest mb-2">
              Dewatering Construction Etc Limited
            </p>
            <h2 className="text-2xl font-bold text-slate-900">Welcome Back</h2>
            <p className="text-slate-500 text-sm mt-1.5">Enter your credentials to access the portal</p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3 mb-6">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide" htmlFor="email">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  list="saved-emails-list"
                  placeholder="admin@dewaterconstruct.com"
                  className="h-11 pl-10 bg-slate-50 border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 rounded-lg text-sm"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <datalist id="saved-emails-list">
                  {savedEmails.map((e, idx) => (
                    <option key={idx} value={e} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  className="h-11 pl-10 pr-10 bg-slate-50 border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 rounded-lg text-sm"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span className="text-sm text-slate-500">Remember me</span>
              </label>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>Sign In <ArrowRight className="w-4 h-4" /></>
              )}
            </Button>
          </form>

          {/* Footer */}
          <p className="mt-10 text-center text-[11px] text-slate-400">
            © {CURRENT_YEAR} Dewatering Construction Etc Limited. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}

