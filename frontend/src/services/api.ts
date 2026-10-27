// ==============================================================================
// AssetVault: Frontend HTTP Client with In-Memory Token & Silent Refresh
// Course: BCSE307L Database Systems (Fall 2026-27)
// Axios interceptor for JWT Bearer attachment and 401 token rotation retry
// ==============================================================================

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { ApiResponse } from '../types';

const rawBase = (import.meta as any).env?.VITE_API_URL;
const isLocalhostOverride =
  typeof rawBase === 'string' &&
  (rawBase.includes('localhost:') || rawBase.includes('127.0.0.1:'));

export const API_BASE_URL =
  rawBase && !isLocalhostOverride
    ? rawBase.endsWith('/api')
      ? rawBase
      : `${rawBase.replace(/\/+$/, '')}/api`
    : '/api';

// Token & Session Persistence (in-memory + localStorage/sessionStorage fallback for page refresh resilience)
let inMemoryAccessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  inMemoryAccessToken = token;
  try {
    if (token) {
      localStorage.setItem('assetvault_access_token', token);
      sessionStorage.setItem('assetvault_access_token', token);
    } else {
      localStorage.removeItem('assetvault_access_token');
      sessionStorage.removeItem('assetvault_access_token');
    }
  } catch {}
};

export const getAccessToken = (): string | null => {
  if (inMemoryAccessToken) return inMemoryAccessToken;
  try {
    const stored =
      localStorage.getItem('assetvault_access_token') ||
      sessionStorage.getItem('assetvault_access_token');
    if (stored) {
      inMemoryAccessToken = stored;
      return stored;
    }
  } catch {}
  return null;
};

export const getStoredRefreshToken = (): string | null => {
  try {
    return localStorage.getItem('assetvault_refresh_token') || sessionStorage.getItem('assetvault_refresh_token');
  } catch {
    return null;
  }
};

export const setStoredRefreshToken = (token: string | null): void => {
  try {
    if (token) {
      localStorage.setItem('assetvault_refresh_token', token);
      sessionStorage.setItem('assetvault_refresh_token', token);
    } else {
      localStorage.removeItem('assetvault_refresh_token');
      sessionStorage.removeItem('assetvault_refresh_token');
    }
  } catch {}
};

export const getStoredSession = (): { user: any; tenant: any; permissions: string[] } | null => {
  try {
    const raw =
      localStorage.getItem('assetvault_session_cache') ||
      sessionStorage.getItem('assetvault_session_cache');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.user && parsed.user.id) {
      return parsed;
    }
  } catch {}
  return null;
};

export const setStoredSession = (session: { user: any; tenant: any; permissions: string[] } | null): void => {
  try {
    if (session && session.user) {
      const serialized = JSON.stringify(session);
      localStorage.setItem('assetvault_session_cache', serialized);
      sessionStorage.setItem('assetvault_session_cache', serialized);
    } else {
      localStorage.removeItem('assetvault_session_cache');
      sessionStorage.removeItem('assetvault_session_cache');
    }
  } catch {}
};

// Create Axios Instance
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Send httpOnly cookies (for refresh token)
  headers: {
    'Content-Type': 'application/json',
  },
});

// In-Flight Refresh Token Promise (dedupes concurrent refresh calls across client)
let inFlightRefreshPromise: Promise<string> | null = null;

export const refreshAccessToken = async (): Promise<string> => {
  if (inFlightRefreshPromise) {
    return inFlightRefreshPromise;
  }

  inFlightRefreshPromise = (async () => {
    try {
      const fallbackToken = getStoredRefreshToken();
      const res = await axios.post<ApiResponse<{ accessToken: string; refreshToken?: string }>>(
        `${API_BASE_URL}/auth/refresh`,
        fallbackToken ? { refreshToken: fallbackToken } : {},
        { withCredentials: true }
      );
      const newAccessToken = res.data.data.accessToken;
      setAccessToken(newAccessToken);
      if (res.data?.data?.refreshToken) {
        setStoredRefreshToken(res.data.data.refreshToken);
      }
      return newAccessToken;
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        setAccessToken(null);
        setStoredRefreshToken(null);
        setStoredSession(null);
      }
      throw err;
    } finally {
      inFlightRefreshPromise = null;
    }
  })();

  return inFlightRefreshPromise;
};

// Request Interceptor: Attach Access Token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token) {
      if (config.headers && typeof config.headers.set === 'function') {
        if (!config.headers.has('Authorization') && !config.headers.has('authorization')) {
          config.headers.set('Authorization', `Bearer ${token}`);
        }
      } else {
        config.headers = config.headers || {};
        if (!config.headers.Authorization && !config.headers.authorization) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Silent 401 Refresh & Auto-Retry
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<any>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // If 401 occurs and is NOT the login or refresh endpoint itself
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      originalRequest._retry = true;

      try {
        const newAccessToken = await refreshAccessToken();
        if (originalRequest.headers && typeof originalRequest.headers.set === 'function') {
          originalRequest.headers.set('Authorization', `Bearer ${newAccessToken}`);
        } else {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        return apiClient(originalRequest);
      } catch (refreshErr) {
        window.dispatchEvent(new CustomEvent('auth:session_expired'));
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(error);
  }
);

export class ApiError extends Error {
  public code: string;
  public status: number;
  public details?: unknown;

  constructor(message: string, code = 'API_ERROR', status = 500, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

// Helper to format Axios errors into standard ApiError
export const handleApiError = (err: unknown): never => {
  if (err instanceof ApiError) {
    throw err;
  }
  if (axios.isAxiosError(err)) {
    const status = err.response?.status || 500;
    const data = err.response?.data;
    const errorData = data?.error;

    let message =
      errorData?.message ||
      (typeof data?.message === 'string' ? data.message : undefined) ||
      (typeof data === 'string' ? data : undefined) ||
      err.message ||
      'An unexpected error occurred';

    // Unpack Zod field errors into user-friendly message if generic "Invalid input payload"
    const details = errorData?.details || data?.details;
    if (details && typeof details === 'object' && (details as any).fieldErrors) {
      const fieldErrors = (details as any).fieldErrors as Record<string, string[]>;
      const fieldMessages = Object.entries(fieldErrors)
        .filter(([_, msgs]) => Array.isArray(msgs) && msgs.length > 0)
        .map(([field, msgs]) => `${field}: ${msgs.join(', ')}`);
      if (fieldMessages.length > 0 && (message === 'Invalid input payload' || message.includes('Validation failed'))) {
        message = fieldMessages.join('; ');
      }
    }

    const code = errorData?.code || data?.code || (status === 0 ? 'NETWORK_ERROR' : 'API_ERROR');
    throw new ApiError(message, code, status, details);
  }
  if (err instanceof Error) {
    throw new ApiError(err.message);
  }
  throw new ApiError('An unknown error occurred');
};

// Typed Convenience API Wrapper
export const api = {
  async get<T = any>(url: string, configOrParams?: any): Promise<T> {
    try {
      const isAxiosConfig =
        configOrParams &&
        (configOrParams.params !== undefined ||
          configOrParams.headers !== undefined ||
          configOrParams.responseType !== undefined ||
          configOrParams.signal !== undefined);

      const config = isAxiosConfig ? configOrParams : { params: configOrParams };
      const response = await apiClient.get<T>(url, config);
      return response.data;
    } catch (err) {
      return handleApiError(err);
    }
  },

  async post<T = any>(url: string, data?: unknown, configOrHeaders?: any): Promise<T> {
    try {
      const config = configOrHeaders?.headers
        ? configOrHeaders
        : configOrHeaders
        ? { headers: configOrHeaders }
        : undefined;
      const response = await apiClient.post<T>(url, data, config);
      return response.data;
    } catch (err) {
      return handleApiError(err);
    }
  },

  async put<T = any>(url: string, data?: unknown, config?: any): Promise<T> {
    try {
      const response = await apiClient.put<T>(url, data, config);
      return response.data;
    } catch (err) {
      return handleApiError(err);
    }
  },

  async patch<T = any>(url: string, data?: unknown, config?: any): Promise<T> {
    try {
      const response = await apiClient.patch<T>(url, data, config);
      return response.data;
    } catch (err) {
      return handleApiError(err);
    }
  },

  async delete<T = any>(url: string, configOrParams?: any): Promise<T> {
    try {
      const config = configOrParams?.params || configOrParams?.headers
        ? configOrParams
        : { params: configOrParams };
      const response = await apiClient.delete<T>(url, config);
      return response.data;
    } catch (err) {
      return handleApiError(err);
    }
  },
};

