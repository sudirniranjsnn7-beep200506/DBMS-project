// ==============================================================================
// AssetVault: Google OAuth 2.0 Client Callback Consumer
// Course: BCSE307L Database Systems (Fall 2026-27)
// Captures JWT access token from the OAuth URL fragment, then clears the URL before loading the profile
// ==============================================================================

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { setAccessToken } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ShieldCheck, AlertCircle } from 'lucide-react';

export const OAuthCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const toast = useToast();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const handleCallback = async () => {
      // URL fragments are not sent to the web server in HTTP requests or referrer headers.
      const fragmentParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const token = fragmentParams.get('token');
      const error = searchParams.get('error') || fragmentParams.get('error');

      // Remove any OAuth credentials from the visible URL before making further requests.
      if (token) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      if (error) {
        let msg = 'Google authentication failed';
        if (error === 'not_invited') {
          msg = 'Your Google account is not invited to an organization. Please register or contact an admin.';
        } else if (error === 'account_inactive') {
          msg = 'Your account is deactivated. Please contact your organization administrator.';
        } else if (error === 'tenant_suspended') {
          msg = 'Your organization account is suspended.';
        }
        if (isMounted) setErrorMessage(msg);
        toast.error(msg, 'Sign in Failed');
        setTimeout(() => navigate('/login', { replace: true }), 3500);
        return;
      }

      if (token) {
        try {
          setAccessToken(token);
          await refreshProfile();
          toast.success('Welcome back! Signed in with Google.', 'Authentication Successful');
          navigate('/', { replace: true });
        } catch (err: any) {
          const msg = err.message || 'Failed to initialize session profile';
          if (isMounted) setErrorMessage(msg);
          toast.error(msg, 'Session Error');
          setTimeout(() => navigate('/login', { replace: true }), 3500);
        }
      } else {
        if (isMounted) setErrorMessage('No authentication token received.');
        navigate('/login', { replace: true });
      }
    };

    handleCallback();

    return () => {
      isMounted = false;
    };
  }, [searchParams, navigate, refreshProfile, toast]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center items-center px-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-2xl shadow-sm text-center max-w-sm w-full">
        {errorMessage ? (
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Authentication Failed</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{errorMessage}</p>
            <p className="text-[11px] text-slate-400">Redirecting to login...</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-950 text-primary-600 flex items-center justify-center mx-auto animate-pulse">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Completing Sign-In</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Verifying your Google session...</p>
            <div className="w-6 h-6 border-2 border-primary-500/20 border-t-primary-600 rounded-full animate-spin mx-auto mt-2" />
          </div>
        )}
      </div>
    </div>
  );
};
