// ==============================================================================
// AssetVault: Google Workspace Gmail OAuth & Direct Email Service
// Uses Firebase Authentication (GoogleAuthProvider) with gmail.send scope
// Access tokens are strictly cached in memory only (never localStorage/sessionStorage)
// ==============================================================================

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Define the required Google Workspace scopes
const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];

// Memory-only cache for the Google OAuth access token (never persisted to storage)
let cachedAccessToken: string | null = null;

/**
 * Initializes the authentication state listener.
 * Must be called on application or modal startup.
 */
export const initAuth = (
  callback: (user: User | null, needsAuth: boolean) => void
) => {
  return onAuthStateChanged(auth, (user) => {
    if (user) {
      // If user is signed in to Firebase, check if we have the API token in memory
      callback(user, !cachedAccessToken);
    } else {
      cachedAccessToken = null;
      callback(null, true);
    }
  });
};

/**
 * Triggers the Google Sign-In popup to authenticate the user and request API scopes.
 * Also used to refresh the access token if it expires or is lost on page reload.
 */
export const googleSignIn = async (loginHint?: string): Promise<string> => {
  const provider = new GoogleAuthProvider();

  SCOPES.forEach((scope) => provider.addScope(scope));

  // Always show the Google account selector so the user can choose the authorized project owner account
  const customParams: Record<string, string> = {
    prompt: 'select_account',
  };
  if (loginHint) {
    customParams.login_hint = loginHint;
  }
  provider.setCustomParameters(customParams);

  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);

  if (credential?.accessToken) {
    cachedAccessToken = credential.accessToken;
    return cachedAccessToken;
  }

  throw new Error('Failed to retrieve access token from Google Sign-In.');
};

/**
 * Retrieves the cached access token, or triggers the sign-in flow if missing.
 */
export const getAccessToken = async (): Promise<string> => {
  if (cachedAccessToken) {
    return cachedAccessToken;
  }
  return await googleSignIn();
};

/**
 * Checks whether an active Gmail OAuth access token is currently in memory.
 */
export const hasActiveGmailToken = (): boolean => {
  return Boolean(cachedAccessToken);
};

/**
 * Signs the user out of Firebase and clears the cached token.
 */
export const logout = async () => {
  cachedAccessToken = null;
  await signOut(auth);
};

/**
 * Encodes a string to UTF-8 safe base64url as required by Gmail API RFC 2822 raw messages.
 */
function toBase64Url(input: string): string {
  const utf8Bytes = new TextEncoder().encode(input);
  let binary = '';
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Encodes the email subject using RFC 2047 UTF-8 Base64 encoding so special characters render properly.
 */
function encodeMimeSubject(subject: string): string {
  const utf8Bytes = new TextEncoder().encode(subject);
  let binary = '';
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  return `=?utf-8?B?${btoa(binary)}?=`;
}

export interface SendGmailResult {
  id: string;
  threadId: string;
  labelIds?: string[];
}

/**
 * Sends an RFC 2822 formatted email via the user's authenticated Gmail account
 * using https://gmail.googleapis.com/gmail/v1/users/me/messages/send
 */
export const sendGmailMessage = async (params: {
  to: string;
  subject: string;
  body: string;
}): Promise<SendGmailResult> => {
  const token = await getAccessToken();

  const emailLines = [
    `To: ${params.to.trim()}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'MIME-Version: 1.0',
    `Subject: ${encodeMimeSubject(params.subject.trim())}`,
    '',
    params.body,
  ];

  const rawEmail = emailLines.join('\r\n');
  const encodedEmail = toBase64Url(rawEmail);

  const response = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw: encodedEmail,
      }),
    }
  );

  if (response.status === 401 || response.status === 403) {
    // Clear expired token so the user can re-authorize cleanly
    cachedAccessToken = null;
    const errBody = await response.json().catch(() => ({}));
    throw new Error(
      errBody?.error?.message ||
        'Gmail authorization expired or insufficient permissions. Please click Sign in with Google again.'
    );
  }

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(
      errBody?.error?.message || `Gmail API failed with status ${response.status}`
    );
  }

  return (await response.json()) as SendGmailResult;
};
