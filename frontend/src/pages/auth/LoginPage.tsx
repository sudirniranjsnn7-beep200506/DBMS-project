// ==============================================================================
// AssetVault: Modern Split-Layout Enterprise Login Page
// Course: BCSE307L Database Systems (Fall 2026-27)
// Split-layout: left half is dark branded panel with animated floating cards;
// right half is login form with React Hook Form, Zod, and Google OAuth feature flag.
// ==============================================================================

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { API_BASE_URL } from '../../services/api';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { AuthBrandedPanel } from './AuthBrandedPanel';
import {
  ShieldCheck,
  Mail,
  Lock,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';

// Zod validation matching backend auth.validator.ts loginSchema
export const loginSchema = z.object({
  email: z.string().email('Valid email address is required').toLowerCase().trim(),
  password: z.string().min(1, 'Password is required'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

// Feature flag helper to check if Google OAuth is configured
export const isGoogleAuthEnabled = (): boolean => {
  const env = (import.meta as any).env || {};
  const win = typeof window !== 'undefined' ? (window as any) : {};
  const globalObj = typeof globalThis !== 'undefined' ? (globalThis as any) : {};
  const proc = globalObj.process?.env || {};
  return Boolean(
    env.VITE_GOOGLE_CLIENT_ID ||
    env.GOOGLE_CLIENT_ID ||
    proc.VITE_GOOGLE_CLIENT_ID ||
    proc.GOOGLE_CLIENT_ID ||
    win.__ENV__?.GOOGLE_CLIENT_ID ||
    win.__ENV__?.VITE_GOOGLE_CLIENT_ID
  );
};

export const LoginPage: React.FC = () => {
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const from = (location.state as any)?.from?.pathname || '/';
  const showGoogleOAuth = isGoogleAuthEnabled();

  React.useEffect(() => {
    if (!authLoading && isAuthenticated) {
      let savedRoute = '/';
      try {
        savedRoute =
          sessionStorage.getItem('assetvault_last_route') ||
          localStorage.getItem('assetvault_last_route') ||
          '/';
      } catch {}
      const target = from && from !== '/login' && from !== '/' ? from : savedRoute;
      navigate(target, { replace: true });
    }
  }, [authLoading, isAuthenticated, from, navigate]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      setIsLoading(true);
      setServerError(null);
      const user = await login(data.email, data.password);
      toast.success(`Welcome back, ${user.fullName}!`, 'Signed In Successfully');
      navigate(from, { replace: true });
    } catch (err: any) {
      const errorMsg = err.message || 'Invalid email or password.';
      setServerError(errorMsg);
      toast.error(errorMsg, 'Authentication Failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `${API_BASE_URL}/auth/google`;
  };

  const handleForgotPassword = (e: React.MouseEvent) => {
    e.preventDefault();
    toast.info(
      'Password reset request sent. Please contact your organization administrator or check your recovery inbox.',
      'Password Reset'
    );
  };

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100 transition-colors">
      {/* ====================================================================== */}
      {/* Left Half: Dark Branded Panel with Animated Floating Cards             */}
      {/* ====================================================================== */}
      <AuthBrandedPanel />

      {/* ====================================================================== */}
      {/* Right Half: Form Panel (Full width on mobile, 50% on desktop)          */}
      {/* ====================================================================== */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 overflow-y-auto">
        <div className="max-w-md w-full space-y-6">
          {/* Mobile Header Brand (Visible on mobile only) */}
          <div className="lg:hidden text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 shadow-lg shadow-indigo-500/20 mb-3 text-white">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight font-mono">
              Asset<span className="text-indigo-400">Vault</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Multi-Tenant Digital Asset & License Management System
            </p>
          </div>

          {/* Form Header */}
          <div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">
              Sign In to AssetVault
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Enter your corporate credentials to access digital assets and license allocations.
            </p>
          </div>

          {/* Server Error Alert */}
          {serverError && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-start gap-2.5 animate-fade-in">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{serverError}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Input
                label="Work Email"
                type="email"
                placeholder="name@company.com"
                iconLeft={<Mail className="w-4 h-4 text-slate-400" />}
                error={errors.email?.message}
                {...register('email')}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300 select-none">
                  Password
                </label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <Input
                type="password"
                placeholder="••••••••••••"
                iconLeft={<Lock className="w-4 h-4 text-slate-400" />}
                error={errors.password?.message}
                {...register('password')}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full mt-2 font-semibold shadow-md shadow-indigo-600/25"
              isLoading={isLoading}
              loadingText="Authenticating..."
              iconRight={<ArrowRight className="w-4 h-4" />}
            >
              Sign In to AssetVault
            </Button>
          </form>

          {/* Feature Flagged: Google OAuth Button */}
          {showGoogleOAuth && (
            <div className="space-y-4 pt-2">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-800" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-slate-950 text-slate-400 uppercase font-medium text-[10px] tracking-wider">
                    Or Continue With SSO
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 bg-slate-900 hover:bg-slate-850 active:bg-slate-800 border border-slate-700/80 rounded-xl text-xs font-semibold text-slate-200 transition-colors shadow-xs"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Sign in with Google</span>
              </button>
            </div>
          )}

          {/* Footer Link to Register Organization */}
          <div className="text-center pt-2 text-xs text-slate-400 border-t border-slate-800/80">
            <span>Need a new organization? </span>
            <Link
              to="/register"
              className="font-bold text-indigo-400 hover:text-indigo-300 hover:underline"
            >
              Register Organization &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
