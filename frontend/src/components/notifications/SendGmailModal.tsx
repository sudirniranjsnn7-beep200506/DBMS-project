// ==============================================================================
// AssetVault: Direct Gmail Notification & License Alert Composer Modal
// Integrates Google Workspace Gmail API (https://www.googleapis.com/auth/gmail.send)
// with Gemini AI email drafting, inline member email editing, and mandatory
// user confirmation before sending.
// ==============================================================================

import React, { useState, useEffect } from 'react';
import {
  Mail,
  Send,
  Sparkles,
  X,
  CheckCircle2,
  ShieldCheck,
  User as UserIcon,
  LogOut,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Edit3,
  Check,
  ExternalLink,
} from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import { useQueryClient } from '@tanstack/react-query';
import {
  initAuth,
  googleSignIn,
  logout,
  sendGmailMessage,
  hasActiveGmailToken,
} from '../../services/gmailAuth';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';

export interface GmailModalPayload {
  recipientName?: string;
  recipientEmail?: string;
  notificationTitle?: string;
  notificationMessage?: string;
  notificationType?: string;
  licenseName?: string;
  initialSubject?: string;
  initialBody?: string;
}

const OPEN_GMAIL_MODAL_EVENT = 'assetvault:open-gmail-modal';

export function openGmailModal(payload: GmailModalPayload = {}) {
  window.dispatchEvent(
    new CustomEvent<GmailModalPayload>(OPEN_GMAIL_MODAL_EVENT, {
      detail: payload,
    })
  );
}

interface TenantMember {
  id: string;
  fullName: string;
  email: string;
  role: string;
  department?: string;
}

export const SendGmailModal: React.FC = () => {
  const queryClient = useQueryClient();
  const toastContext = useToast();
  const toast = (toastContext as any).toast || toastContext;

  const [isOpen, setIsOpen] = useState(false);
  const [payload, setPayload] = useState<GmailModalPayload>({});

  // Firebase Google Auth state
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
  const [needsAuth, setNeedsAuth] = useState<boolean>(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Tenant users for quick recipient selection & inline email editing
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingMemberEmail, setEditingMemberEmail] = useState('');
  const [editingMemberName, setEditingMemberName] = useState('');
  const [isSavingMemberEmail, setIsSavingMemberEmail] = useState(false);

  // Email Composer fields
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  // Workflow states
  const [isDrafting, setIsDrafting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sentResult, setSentResult] = useState<{ id: string; to: string } | null>(
    null
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Listen to Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = initAuth((user, requiresToken) => {
      setGoogleUser(user);
      setNeedsAuth(requiresToken);
    });
    return () => unsubscribe();
  }, []);

  // Listen to global openGmailModal custom events
  useEffect(() => {
    const handleOpen = (e: Event) => {
      const customEvent = e as CustomEvent<GmailModalPayload>;
      const detail = customEvent.detail || {};
      setPayload(detail);
      setRecipientName(detail.recipientName || '');
      setRecipientEmail(detail.recipientEmail || '');
      setErrorMessage(null);
      setSentResult(null);
      setIsConfirming(false);
      setEditingMemberId(null);
      setNeedsAuth(!hasActiveGmailToken());

      const defaultSubj =
        detail.initialSubject ||
        (detail.notificationTitle
          ? `[AssetVault] ${detail.notificationTitle}`
          : detail.licenseName
          ? `[AssetVault] License Seat Allocated: ${detail.licenseName}`
          : '[AssetVault] License & Asset Notification');

      const defaultBody =
        detail.initialBody ||
        [
          `Hi ${detail.recipientName || 'Team Member'},`,
          '',
          detail.notificationMessage
            ? `You have a new notification from AssetVault:\n\n"${detail.notificationMessage}"`
            : detail.licenseName
            ? `Your software license seat for "${detail.licenseName}" has been allocated in AssetVault.`
            : 'Here is an important update from your AssetVault workspace.',
          '',
          detail.licenseName ? `License: ${detail.licenseName}` : '',
          '',
          'Best regards,',
          'AssetVault License Operations Team',
        ]
          .filter((line, idx, arr) => !(line === '' && arr[idx - 1] === ''))
          .join('\n');

      setSubject(defaultSubj);
      setBody(defaultBody);
      setIsOpen(true);
    };

    window.addEventListener(OPEN_GMAIL_MODAL_EVENT, handleOpen);
    return () => window.removeEventListener(OPEN_GMAIL_MODAL_EVENT, handleOpen);
  }, []);

  // Load tenant members when modal opens so the user can pick or edit a recipient in 1 click
  const fetchMembers = async () => {
    try {
      const res = await api.get<any>('/ai/context-summary');
      const data = res?.data || res;
      if (Array.isArray(data?.users) && data.users.length > 0) {
        setMembers(data.users);
        if (!recipientEmail && data.users[0]?.email) {
          setRecipientEmail(data.users[0].email);
          setRecipientName(data.users[0].fullName || '');
        }
      }
    } catch {
      // Ignore if context summary fails
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchMembers();
  }, [isOpen]);

  const handleSaveMemberEmail = async (memberId: string) => {
    const trimmedEmail = editingMemberEmail.trim().toLowerCase();
    const trimmedName = editingMemberName.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setIsSavingMemberEmail(true);
    setErrorMessage(null);
    try {
      await api.patch(`/users/${memberId}`, {
        email: trimmedEmail,
        fullName: trimmedName || undefined,
      });

      setMembers((prev) =>
        prev.map((m) =>
          m.id === memberId
            ? { ...m, email: trimmedEmail, fullName: trimmedName || m.fullName }
            : m
        )
      );
      setRecipientEmail(trimmedEmail);
      if (trimmedName) setRecipientName(trimmedName);
      setEditingMemberId(null);

      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['allocations'] });

      if (typeof toast.success === 'function') {
        toast.success(`Updated member email to ${trimmedEmail}`);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to update member email.');
    } finally {
      setIsSavingMemberEmail(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setIsAuthenticating(true);
    try {
      await googleSignIn('sudirniranjsnn07@gmail.com');
      setNeedsAuth(false);
      if (typeof toast.success === 'function') {
        toast.success('Connected to Google Gmail API');
      } else if (typeof toast === 'function') {
        toast({
          title: 'Gmail Connected',
          message: 'Authorized to send emails via Gmail API',
          type: 'success',
        });
      }
    } catch (err: any) {
      setErrorMessage(
        err?.message ||
          'Google Sign-In failed or was blocked. Make sure you select sudirniranjsnn07@gmail.com (Project Owner) or add the email as a Test User in Google Cloud Console.'
      );
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleGoogleLogout = async () => {
    await logout();
    setNeedsAuth(true);
    setGoogleUser(null);
  };

  const handleAiDraft = async () => {
    setErrorMessage(null);
    setIsDrafting(true);
    try {
      const res = await api.post<any>('/ai/draft-email', {
        recipientName: recipientName || undefined,
        recipientEmail: recipientEmail || undefined,
        notificationTitle: payload.notificationTitle,
        notificationMessage: payload.notificationMessage,
        notificationType: payload.notificationType,
        licenseName: payload.licenseName,
        customContext: body,
      });
      const data = res?.data || res;
      if (data?.subject) setSubject(data.subject);
      if (data?.body) setBody(data.body);
      if (data?.recipientEmail && !recipientEmail) {
        setRecipientEmail(data.recipientEmail);
      }
      if (data?.recipientName && !recipientName) {
        setRecipientName(data.recipientName);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to generate AI draft.');
    } finally {
      setIsDrafting(false);
    }
  };

  const handleProceedToConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!recipientEmail.trim() || !recipientEmail.includes('@')) {
      setErrorMessage('Please enter a valid recipient email address.');
      return;
    }
    if (!subject.trim()) {
      setErrorMessage('Please provide an email subject.');
      return;
    }
    if (!body.trim()) {
      setErrorMessage('Please provide an email message body.');
      return;
    }

    setIsConfirming(true);
  };

  const handleConfirmSend = async () => {
    setErrorMessage(null);
    setIsSending(true);
    try {
      const result = await sendGmailMessage({
        to: recipientEmail.trim(),
        subject: subject.trim(),
        body,
      });

      setSentResult({
        id: result.id,
        to: recipientEmail.trim(),
      });
      setIsConfirming(false);

      if (typeof toast.success === 'function') {
        toast.success(`Email sent to ${recipientEmail.trim()} via Gmail`);
      } else if (typeof toast === 'function') {
        toast({
          title: 'Email Sent via Gmail',
          message: `Delivered notification email to ${recipientEmail.trim()}`,
          type: 'success',
        });
      }
    } catch (err: any) {
      setErrorMessage(
        err?.message || 'Failed to send email via Gmail API. Please re-authenticate.'
      );
      setNeedsAuth(!hasActiveGmailToken());
      setIsConfirming(false);
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gmail-modal-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm transition-opacity"
        onClick={() => setIsOpen(false)}
      />

      {/* Modal Box */}
      <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden z-10 text-slate-100">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3
                id="gmail-modal-title"
                className="text-sm font-bold text-white tracking-tight"
              >
                Send Notification via Gmail
              </h3>
              <p className="text-[11px] text-slate-400">
                Google Workspace Gmail API (gmail.send) • AI-Assisted Composer
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          {/* Google Account Connection Banner */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    !needsAuth ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
                  }`}
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-200 truncate">
                    {!needsAuth && googleUser?.email
                      ? `Sender Connected: ${googleUser.email}`
                      : googleUser?.email
                      ? `Session expired for ${googleUser.email}`
                      : 'Step 1: Connect Sender Google Account'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {!needsAuth
                      ? 'Can send emails to any recipient email address'
                      : 'Sign in with sudirniranjsnn07@gmail.com (Project Owner)'}
                  </p>
                </div>
              </div>

              {needsAuth ? (
                /* Official Google Sign-In Button per Google Branding Guidelines */
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isAuthenticating}
                  className="gsi-material-button inline-flex items-center justify-center gap-2.5 px-3.5 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-800 font-medium text-xs shadow-sm border border-slate-300 transition-all cursor-pointer shrink-0 disabled:opacity-60"
                >
                  <div className="gsi-material-button-state" />
                  <div className="gsi-material-button-content-wrapper flex items-center gap-2">
                    <div className="gsi-material-button-icon w-4 h-4 shrink-0">
                      <svg
                        version="1.1"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 48 48"
                        style={{ display: 'block' }}
                      >
                        <path
                          fill="#EA4335"
                          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                        />
                        <path
                          fill="#4285F4"
                          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                        />
                        <path
                          fill="#34A853"
                          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                        />
                        <path fill="none" d="M0 0h48v48H0z" />
                      </svg>
                    </div>
                    <span className="gsi-material-button-contents font-semibold">
                      {isAuthenticating
                        ? 'Authorizing...'
                        : googleUser
                        ? 'Authorize Gmail'
                        : 'Sign in with Google'}
                    </span>
                  </div>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleGoogleLogout}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Switch Sender</span>
                </button>
              )}
            </div>

            {needsAuth && (
              <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex flex-col gap-1">
                <span>
                  <strong className="text-amber-300">Why &quot;Access blocked (403)&quot;?</strong> Your OAuth app is in Google Testing mode, so only the project owner (<code className="text-indigo-300">sudirniranjsnn07@gmail.com</code>) or approved Test Users can sign in as the <strong>sender</strong>. Once signed in with <code className="text-indigo-300">sudirniranjsnn07@gmail.com</code>, you can send emails <strong>to any address</strong> (including <code className="text-indigo-300">karthikeyansudir2007@gmail.com</code>).
                </span>
                <a
                  href="https://console.cloud.google.com/apis/credentials/consent?project=gen-lang-client-0028429131"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 underline w-fit"
                >
                  <span>Or add Test Users in Google Cloud Console (Audience)</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Sent Success View */}
          {sentResult ? (
            <div className="p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-white">
                  Email Delivered via Gmail
                </h4>
                <p className="text-xs text-slate-300">
                  Successfully sent to{' '}
                  <span className="font-mono text-indigo-300">
                    {sentResult.to}
                  </span>
                </p>
                <p className="text-[11px] text-slate-500 font-mono">
                  Gmail Message ID: {sentResult.id}
                </p>
              </div>
              <div className="pt-2 flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setSentResult(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
                >
                  Send Another Email
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          ) : isConfirming ? (
            /* Mandatory Confirmation Dialog before executing Gmail API send */
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-800/60 space-y-1">
                <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs">
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  <span>Confirm Gmail Delivery</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Please review and confirm the email details below before AssetVault sends this message from your Google account.
                </p>
              </div>

              <div className="rounded-xl bg-slate-950 border border-slate-800 p-3.5 space-y-2.5 text-xs">
                <div className="flex justify-between gap-2 border-b border-slate-800/80 pb-2">
                  <span className="text-slate-400 font-medium">From:</span>
                  <span className="font-mono text-slate-200">
                    {googleUser?.email || 'Your Google Account'}
                  </span>
                </div>
                <div className="flex justify-between gap-2 border-b border-slate-800/80 pb-2">
                  <span className="text-slate-400 font-medium">To:</span>
                  <span className="font-mono text-indigo-300 font-semibold">
                    {recipientName
                      ? `${recipientName} <${recipientEmail}>`
                      : recipientEmail}
                  </span>
                </div>
                <div className="flex justify-between gap-2 border-b border-slate-800/80 pb-2">
                  <span className="text-slate-400 font-medium shrink-0">
                    Subject:
                  </span>
                  <span className="text-slate-100 font-semibold text-right">
                    {subject}
                  </span>
                </div>
                <div className="space-y-1 pt-1">
                  <span className="text-slate-400 font-medium block">
                    Message Body:
                  </span>
                  <pre className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 font-sans text-xs whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                    {body}
                  </pre>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsConfirming(false)}
                  disabled={isSending}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Edit</span>
                </button>

                <button
                  type="button"
                  onClick={handleConfirmSend}
                  disabled={isSending}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-emerald-600/25 transition-all cursor-pointer"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending via Gmail...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Confirm &amp; Send Email Now</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Composer Form */
            <form onSubmit={handleProceedToConfirm} className="space-y-3.5">
              {/* Quick Team Member Selector + Inline Edit Email */}
              {members.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Quick Select or Edit Team Member Email
                    </label>
                    <span className="text-[10px] text-slate-500">
                      Click pencil icon to update saved email
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {members.map((m) => {
                      const isSelected =
                        recipientEmail.toLowerCase() === m.email.toLowerCase();
                      return (
                        <div
                          key={m.id || m.email}
                          className={`inline-flex items-center gap-1 rounded-lg text-xs font-medium border transition-all ${
                            isSelected
                              ? 'bg-indigo-600/25 border-indigo-500 text-indigo-200'
                              : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setRecipientEmail(m.email);
                              setRecipientName(m.fullName);
                            }}
                            className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 cursor-pointer"
                          >
                            <UserIcon className="w-3 h-3 text-indigo-400" />
                            <span>{m.fullName}</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              ({m.email})
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMemberId(m.id);
                              setEditingMemberEmail(m.email);
                              setEditingMemberName(m.fullName);
                            }}
                            className="p-1 mr-1 rounded hover:bg-slate-800 text-slate-400 hover:text-indigo-300 transition-colors cursor-pointer"
                            title={`Edit saved email for ${m.fullName}`}
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Inline Member Email Editor Box */}
                  {editingMemberId && (
                    <div className="p-3 rounded-xl bg-slate-950 border border-indigo-500/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-indigo-300">
                          Update Saved Member Email in Database
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditingMemberId(null)}
                          className="text-slate-400 hover:text-white"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={editingMemberName}
                          onChange={(e) => setEditingMemberName(e.target.value)}
                          placeholder="Full Name"
                          className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                        />
                        <input
                          type="email"
                          value={editingMemberEmail}
                          onChange={(e) => setEditingMemberEmail(e.target.value)}
                          placeholder="New Email Address"
                          className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingMemberId(null)}
                          className="px-2.5 py-1 rounded-lg text-[11px] text-slate-400 hover:bg-slate-800"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={isSavingMemberEmail}
                          onClick={() => handleSaveMemberEmail(editingMemberId)}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                        >
                          {isSavingMemberEmail ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                          <span>Save Email</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Recipient Name
                  </label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="e.g. Karthik"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Recipient Email (To) *
                  </label>
                  <input
                    type="email"
                    required
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="e.g. karthikeyansudir2007@gmail.com"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-300">
                    Subject *
                  </label>
                  <button
                    type="button"
                    onClick={handleAiDraft}
                    disabled={isDrafting}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isDrafting ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3 text-indigo-400" />
                    )}
                    <span>
                      {isDrafting ? 'Drafting with Gemini...' : 'AI Polish Draft'}
                    </span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Message Body *
                </label>
                <textarea
                  rows={5}
                  required
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Review &amp; Confirm Send</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
