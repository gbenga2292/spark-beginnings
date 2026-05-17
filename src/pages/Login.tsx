import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/src/hooks/useAuth';
import { useAuthStore } from '@/src/store/auth';
import { useUserStore } from '@/src/store/userStore';
import { supabase } from '@/src/integrations/supabase/client';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Mail, Lock, AlertCircle, ShieldCheck, Users, BarChart3, ArrowRight, Eye, EyeOff, Fingerprint } from 'lucide-react';
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth';
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
  const [hasBiometricCreds, setHasBiometricCreds] = useState(false);
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return localStorage.getItem('hasSeenOnboarding') !== 'true';
  });

  const handleFinishOnboarding = () => {
    localStorage.setItem('hasSeenOnboarding', 'true');
    setShowOnboarding(false);
  };

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

    // Check biometric setup
    const credsStr = localStorage.getItem('biometric_credentials');
    if (credsStr) {
      setHasBiometricCreds(true);
      const checkBiometric = async () => {
        try {
          const info = await BiometricAuth.checkBiometry();
          setIsBiometricAvailable(info.isAvailable);
        } catch (e) {
          setIsBiometricAvailable(false);
        }
      };
      checkBiometric();
    }
  }, []);

  const performLogin = async (emailToUse: string, passwordToUse: string) => {
    setError('');
    setIsLoading(true);

    // Domain validation
    if (!emailToUse.toLowerCase().endsWith('@dewaterconstruct.com')) {
      setError('Only @dewaterconstruct.com email addresses are allowed.');
      setIsLoading(false);
      return;
    }

    try {
      const { error: authError } = await signIn(emailToUse, passwordToUse);
      if (authError) {
        const isOffline =
          !navigator.onLine ||
          authError.message === 'Failed to fetch' ||
          authError.message?.toLowerCase().includes('network') ||
          authError.message?.toLowerCase().includes('fetch');
          
        setError(
          isOffline
            ? 'No internet connection. Please check your network and try again.'
            : authError.message || 'Login failed.'
        );
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
        const updatedEmails = [emailToUse, ...currentEmails.filter((e: string) => e !== emailToUse)].slice(0, 5); // Keep up to 5 unique emails
        localStorage.setItem('savedLoginEmails', JSON.stringify(updatedEmails));
      } catch (e) {
        console.error('Error saving email memory');
      }

      // Handle remember me
      if (rememberMe) {
        localStorage.setItem('lastRememberedEmail', emailToUse);
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    await performLogin(email, password);
  };

  const handleBiometricLogin = async () => {
    setError('');
    const credsStr = localStorage.getItem('biometric_credentials');
    if (!credsStr) return;
    
    try {
      await BiometricAuth.authenticate({ reason: 'Authenticate to log in' });
      const creds = JSON.parse(atob(credsStr));
      
      setEmail(creds.email);
      setPassword(creds.password);
      
      await performLogin(creds.email, creds.password);
    } catch (err: any) {
      if (err.code !== 'userCancel' && err.code !== 'systemCancel') {
        setError(err.message || 'Biometric authentication failed.');
      }
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
      <div className="w-full lg:w-[45%] flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12 bg-white relative min-h-[100dvh] lg:min-h-full">
        
        {/* MOBILE ONBOARDING OVERLAY */}
        {showOnboarding && (
          <div className="absolute inset-0 z-50 bg-white flex flex-col lg:hidden animate-in fade-in slide-in-from-right-4 duration-500">
            {/* Header */}
            <div className="px-6 pt-14 pb-8 flex justify-center border-b border-slate-100">
              <img src={logoSrc} alt="DCEL" className="h-12 w-auto" />
            </div>
            
            {/* Content */}
            <div className="flex-1 flex flex-col justify-center px-8 py-6">
              <p className="text-[11px] font-bold text-blue-600 uppercase tracking-widest mb-3 text-center">
                Dewatering Construction Etc Limited
              </p>
              <h2 className="text-[24px] font-extrabold text-slate-900 leading-tight mb-3 text-center tracking-tight">
                Your Complete<br />Operations Portal
              </h2>
              <p className="text-slate-500 text-[14px] text-center mb-10 leading-relaxed max-w-[280px] mx-auto font-medium">
                Manage HR, finance, and site operations efficiently from anywhere.
              </p>
              
              {/* Feature List */}
              <div className="space-y-4 mb-4 max-w-[300px] mx-auto w-full">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center">
                    <Users className="w-4.5 h-4.5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-[13px] font-bold text-slate-900">HR & Payroll</h3>
                    <p className="text-[12px] text-slate-500 mt-0.5 leading-snug font-medium">Track attendance, leaves, and salary automatically.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-4.5 h-4.5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-[13px] font-bold text-slate-900">Financial Reports</h3>
                    <p className="text-[12px] text-slate-500 mt-0.5 leading-snug font-medium">View invoices, payments, and VAT summaries.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center">
                    <ShieldCheck className="w-4.5 h-4.5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-[13px] font-bold text-slate-900">Secure Access</h3>
                    <p className="text-[12px] text-slate-500 mt-0.5 leading-snug font-medium">Role-based controls for every team member.</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Footer / Actions */}
            <div className="p-6 pb-10 bg-white">
              <Button
                onClick={handleFinishOnboarding}
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-lg shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                Continue to Login <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        <div className={`w-full max-w-[400px] mx-auto relative z-10 ${showOnboarding ? 'hidden lg:block' : 'block animate-in fade-in slide-in-from-bottom-4 duration-500'}`}>

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-10 mt-2">
            <img src={logoSrc} alt="DCEL" className="h-12 w-auto" />
          </div>

          {/* Heading */}
          <div className="mb-8">
            <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-widest mb-2 text-center lg:text-left">
              Dewatering Construction Etc Limited
            </p>
            <h2 className="text-2xl font-bold text-slate-900 text-center lg:text-left">Welcome Back</h2>
            <p className="text-slate-500 text-sm mt-1.5 text-center lg:text-left">Enter your credentials to access the portal</p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3 mb-6">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span className="font-medium">{error}</span>
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
                  className="h-12 pl-10 bg-slate-50 border-slate-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 rounded-lg text-sm transition-all"
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
                  className="h-12 pl-10 pr-10 bg-slate-50 border-slate-200 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 rounded-lg text-sm transition-all tracking-wider"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none p-1 rounded hover:bg-slate-100 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none group">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 cursor-pointer"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span className="text-sm text-slate-500 font-medium group-hover:text-slate-700 transition-colors">Remember me</span>
              </label>
              
              <button type="button" className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors focus:outline-none">
                Forgot password?
              </button>
            </div>

            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={isLoading}
                className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>Sign In <ArrowRight className="w-4 h-4" /></>
                )}
              </Button>

              {hasBiometricCreds && isBiometricAvailable && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isLoading}
                  onClick={handleBiometricLogin}
                  className="h-12 w-12 border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 rounded-lg shadow-sm flex items-center justify-center transition-all disabled:opacity-70 flex-shrink-0"
                  title="Sign In with Biometrics"
                >
                  <Fingerprint className="h-6 w-6" />
                </Button>
              )}
            </div>
          </form>

          {/* Footer */}
          <div className="mt-12 text-center lg:mt-16">
            <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">
              © {CURRENT_YEAR} Dewatering Construction Etc Limited.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}


