// ==============================================================================
// AssetVault: Modern Split-Layout Multi-Step Tenant Registration Page
// Course: BCSE307L Database Systems (Fall 2026-27)
// Multi-step wizard:
// Step 1: Organization name + auto-derived slug + contact email
// Step 2: Administrator name + email + password with 5-segment strength meter
// Fully validated with React Hook Form & Zod matching auth.validator.ts
// ==============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { AuthBrandedPanel } from './AuthBrandedPanel';
import {
  Building2,
  Globe,
  Mail,
  User,
  Lock,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Check,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '../../utils/cn';

// ==============================================================================
// Zod Schemas Matching backend/src/validators/auth.validator.ts
// ==============================================================================

export const passwordStrengthRegex = {
  upper: /[A-Z]/,
  lower: /[a-z]/,
  digit: /[0-9]/,
  symbol: /[^A-Za-z0-9]/,
};

export const registerTenantSchema = z.object({
  tenantName: z
    .string()
    .min(2, 'Organization name must be at least 2 characters')
    .max(100, 'Organization name cannot exceed 100 characters')
    .trim(),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(50, 'Slug cannot exceed 50 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase alphanumeric characters and hyphens')
    .trim(),
  contactEmail: z
    .string()
    .email('Valid organization contact email is required')
    .toLowerCase()
    .trim(),
  adminFullName: z
    .string()
    .min(2, 'Administrator full name is required')
    .max(100, 'Name cannot exceed 100 characters')
    .trim(),
  adminEmail: z
    .string()
    .email('Valid administrator email is required')
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(10, 'Password must be at least 10 characters long')
    .max(128, 'Password cannot exceed 128 characters')
    .regex(passwordStrengthRegex.upper, 'Password must contain at least one uppercase letter')
    .regex(passwordStrengthRegex.lower, 'Password must contain at least one lowercase letter')
    .regex(passwordStrengthRegex.digit, 'Password must contain at least one numeric digit')
    .regex(passwordStrengthRegex.symbol, 'Password must contain at least one special symbol'),
});

export type RegisterFormData = z.infer<typeof registerTenantSchema>;

export const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

// ==============================================================================
// Main RegisterPage Component
// ==============================================================================

export const RegisterPage: React.FC = () => {
  const { register: registerAuth } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2>(1);
  const [isSlugManual, setIsSlugManual] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerTenantSchema),
    mode: 'onChange',
    defaultValues: {
      tenantName: '',
      slug: '',
      contactEmail: '',
      adminFullName: '',
      adminEmail: '',
      password: '',
    },
  });

  const tenantNameValue = watch('tenantName');
  const passwordValue = watch('password') || '';
  const contactEmailValue = watch('contactEmail');

  // Auto-derive slug from tenantName unless user manually typed in slug
  useEffect(() => {
    if (!isSlugManual && tenantNameValue) {
      const derived = slugify(tenantNameValue);
      setValue('slug', derived, { shouldValidate: true });
    }
  }, [tenantNameValue, isSlugManual, setValue]);

  // Sync contact email to admin email if admin email is empty
  const handleStep1Next = async () => {
    const isStep1Valid = await trigger(['tenantName', 'slug', 'contactEmail']);
    if (isStep1Valid) {
      const currentAdminEmail = watch('adminEmail');
      if (!currentAdminEmail && contactEmailValue) {
        setValue('adminEmail', contactEmailValue);
      }
      setStep(2);
      setServerError(null);
    }
  };

  // 5-Segment Password Strength Rules
  const passwordRules = useMemo(() => {
    const p = passwordValue;
    return [
      { id: 'min10', label: 'At least 10 characters', met: p.length >= 10 },
      { id: 'upper', label: 'One uppercase letter (A-Z)', met: passwordStrengthRegex.upper.test(p) },
      { id: 'lower', label: 'One lowercase letter (a-z)', met: passwordStrengthRegex.lower.test(p) },
      { id: 'digit', label: 'One numeric digit (0-9)', met: passwordStrengthRegex.digit.test(p) },
      { id: 'symbol', label: 'One special symbol (!@#$...)', met: passwordStrengthRegex.symbol.test(p) },
    ];
  }, [passwordValue]);

  const satisfiedCount = useMemo(() => {
    return passwordRules.filter((r) => r.met).length;
  }, [passwordRules]);

  // Color mapping: red -> orange -> yellow -> green
  const strengthColorClass = useMemo(() => {
    if (satisfiedCount <= 1) return 'bg-rose-500';
    if (satisfiedCount === 2) return 'bg-amber-500';
    if (satisfiedCount <= 4) return 'bg-yellow-400';
    return 'bg-emerald-500';
  }, [satisfiedCount]);

  const strengthLabel = useMemo(() => {
    if (!passwordValue) return 'Enter password';
    if (satisfiedCount <= 1) return 'Weak (Red)';
    if (satisfiedCount === 2) return 'Fair (Orange)';
    if (satisfiedCount <= 4) return 'Good (Yellow)';
    return 'Strong (Green)';
  }, [passwordValue, satisfiedCount]);

  const onSubmit = async (data: RegisterFormData) => {
    try {
      setIsLoading(true);
      setServerError(null);
      await registerAuth({
        tenantName: data.tenantName,
        tenantSlug: data.slug,
        fullName: data.adminFullName,
        email: data.adminEmail,
        contactEmail: data.contactEmail,
        password: data.password,
      });

      toast.success(
        `Organization ${data.tenantName} and Master Admin provisioned successfully!`,
        'Welcome to AssetVault'
      );
      navigate('/');
    } catch (err: any) {
      let errorMsg = err.message || 'Failed to register organization.';
      if (err.details?.fieldErrors) {
        const fieldKeys = Object.keys(err.details.fieldErrors);
        if (fieldKeys.length > 0) {
          const firstKey = fieldKeys[0];
          const messages = err.details.fieldErrors[firstKey];
          if (Array.isArray(messages) && messages.length > 0) {
            errorMsg = `${firstKey}: ${messages[0]}`;
          }
        }
      }
      setServerError(errorMsg);
      toast.error(errorMsg, 'Registration Failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100 transition-colors">
      {/* ====================================================================== */}
      {/* Left Half: Dark Branded Panel with Animated Floating Cards             */}
      {/* ====================================================================== */}
      <AuthBrandedPanel />

      {/* ====================================================================== */}
      {/* Right Half: Form Panel (Multi-Step Wizard)                             */}
      {/* ====================================================================== */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 overflow-y-auto">
        <div className="max-w-md w-full space-y-6">
          {/* Mobile Header Brand (Visible on mobile only) */}
          <div className="lg:hidden text-center mb-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 shadow-lg shadow-indigo-500/20 mb-2 text-white">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight font-mono">
              Asset<span className="text-indigo-400">Vault</span>
            </h1>
            <p className="text-xs text-slate-400">
              Multi-Tenant Digital Asset & License Management System
            </p>
          </div>

          {/* Wizard Header & Progress Bar */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-extrabold text-white tracking-tight">
                  Register Organization
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {step === 1
                    ? 'Step 1 of 2: Organization Profile & Workspace'
                    : 'Step 2 of 2: Lead Administrator & Credentials'}
                </p>
              </div>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-indigo-400">
                Step {step} / 2
              </span>
            </div>

            {/* Top Progress Bar Track */}
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className={cn(
                  'h-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-300 ease-out',
                  step === 1 ? 'w-1/2' : 'w-full'
                )}
              />
            </div>

            {/* Step Breadcrumb Indicators */}
            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={() => setStep(1)}
                className={cn(
                  'flex items-center gap-1.5 font-semibold transition-colors',
                  step === 1
                    ? 'text-indigo-400'
                    : 'text-slate-400 hover:text-slate-200'
                )}
              >
                <span
                  className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold',
                    step === 2
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-indigo-600 text-white'
                  )}
                >
                  {step === 2 ? <Check className="w-3 h-3 stroke-[3]" /> : '1'}
                </span>
                <span>Organization</span>
              </button>

              <div className="w-12 h-px bg-slate-800" />

              <div
                className={cn(
                  'flex items-center gap-1.5 font-semibold',
                  step === 2 ? 'text-indigo-400' : 'text-slate-500'
                )}
              >
                <span
                  className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold',
                    step === 2 ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                  )}
                >
                  2
                </span>
                <span>Administrator</span>
              </div>
            </div>
          </div>

          {/* Server Error Alert */}
          {serverError && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-start gap-2.5 animate-fade-in">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{serverError}</span>
            </div>
          )}

          {/* Registration Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* ================================================================ */}
            {/* STEP 1: ORGANIZATION DETAILS                                      */}
            {/* ================================================================ */}
            {step === 1 && (
              <div className="space-y-4 animate-fade-in">
                <div>
                  <Input
                    label="Organization / Company Name"
                    type="text"
                    placeholder="Acme Innovations, Inc."
                    iconLeft={<Building2 className="w-4 h-4 text-slate-400" />}
                    error={errors.tenantName?.message}
                    {...register('tenantName')}
                  />
                </div>

                <div>
                  <Input
                    label="Workspace URL Slug"
                    type="text"
                    placeholder="acme-innovations"
                    helperText="Unique tenant identifier used for tenant isolation and routing"
                    iconLeft={<Globe className="w-4 h-4 text-slate-400" />}
                    error={errors.slug?.message}
                    {...register('slug', {
                      onChange: () => setIsSlugManual(true),
                    })}
                  />
                </div>

                <div>
                  <Input
                    label="Organization Contact Email"
                    type="email"
                    placeholder="contact@acme.com"
                    helperText="Official billing & operational contact email"
                    iconLeft={<Mail className="w-4 h-4 text-slate-400" />}
                    error={errors.contactEmail?.message}
                    {...register('contactEmail')}
                  />
                </div>

                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={handleStep1Next}
                  className="w-full mt-2 font-semibold shadow-md shadow-indigo-600/25"
                  iconRight={<ArrowRight className="w-4 h-4" />}
                >
                  Continue to Admin Setup
                </Button>
              </div>
            )}

            {/* ================================================================ */}
            {/* STEP 2: LEAD ADMINISTRATOR & PASSWORD WITH STRENGTH METER         */}
            {/* ================================================================ */}
            {step === 2 && (
              <div className="space-y-4 animate-fade-in">
                <div>
                  <Input
                    label="Lead Administrator Full Name"
                    type="text"
                    placeholder="Jane Doe"
                    iconLeft={<User className="w-4 h-4 text-slate-400" />}
                    error={errors.adminFullName?.message}
                    {...register('adminFullName')}
                  />
                </div>

                <div>
                  <Input
                    label="Administrator Work Email"
                    type="email"
                    placeholder="admin@company.com"
                    helperText="Your personal admin login credentials"
                    iconLeft={<Mail className="w-4 h-4 text-slate-400" />}
                    error={errors.adminEmail?.message}
                    {...register('adminEmail')}
                  />
                </div>

                <div className="space-y-2">
                  <Input
                    label="Master Administrator Password"
                    type="password"
                    placeholder="Min 10 chars, uppercase, symbol..."
                    iconLeft={<Lock className="w-4 h-4 text-slate-400" />}
                    error={errors.password?.message}
                    {...register('password')}
                  />

                  {/* 5-Segment Password Strength Meter */}
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-300">Password Strength:</span>
                      <span
                        className={cn(
                          'font-bold text-[11px] font-mono',
                          satisfiedCount <= 1
                            ? 'text-rose-400'
                            : satisfiedCount === 2
                            ? 'text-amber-400'
                            : satisfiedCount <= 4
                            ? 'text-yellow-400'
                            : 'text-emerald-400'
                        )}
                      >
                        {strengthLabel} ({satisfiedCount}/5)
                      </span>
                    </div>

                    {/* 5 Discrete Segments */}
                    <div className="grid grid-cols-5 gap-1.5">
                      {[1, 2, 3, 4, 5].map((index) => {
                        const isFilled = index <= satisfiedCount;
                        return (
                          <div
                            key={index}
                            className={cn(
                              'h-1.5 rounded-full transition-all duration-200',
                              isFilled ? strengthColorClass : 'bg-slate-800'
                            )}
                          />
                        );
                      })}
                    </div>

                    {/* Criteria Checklist */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-[11px]">
                      {passwordRules.map((rule) => (
                        <div
                          key={rule.id}
                          className={cn(
                            'flex items-center gap-1.5 transition-colors',
                            rule.met ? 'text-emerald-400 font-medium' : 'text-slate-500'
                          )}
                        >
                          <CheckCircle2
                            className={cn(
                              'w-3.5 h-3.5 shrink-0',
                              rule.met ? 'opacity-100 text-emerald-400' : 'opacity-30 text-slate-600'
                            )}
                          />
                          <span>{rule.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Back & Submit Buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => setStep(1)}
                    className="flex-1"
                    iconLeft={<ArrowLeft className="w-4 h-4" />}
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    className="flex-2 font-semibold shadow-md shadow-indigo-600/25"
                    isLoading={isLoading}
                    loadingText="Provisioning..."
                    iconRight={<Check className="w-4 h-4" />}
                  >
                    Create Organization
                  </Button>
                </div>
              </div>
            )}
          </form>

          {/* Footer Link to Sign In */}
          <div className="text-center pt-2 text-xs text-slate-400 border-t border-slate-800/80">
            <span>Already have an account? </span>
            <Link
              to="/login"
              className="font-bold text-indigo-400 hover:text-indigo-300 hover:underline"
            >
              Sign In &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
