import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { refreshAccessToken, getAccessToken, setAccessToken } from '../services/api';

describe('Frontend inFlightRefreshPromise Deduplication', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setAccessToken(null);
  });

  it('dedupes multiple concurrent calls into a single HTTP POST /auth/refresh', async () => {
    let networkCallCount = 0;

    vi.spyOn(axios, 'post').mockImplementation(async (url: any) => {
      if (String(url).includes('/auth/refresh')) {
        networkCallCount++;
        // Simulate small network delay
        await new Promise((resolve) => setTimeout(resolve, 50));
        return {
          data: {
            status: 'success',
            data: { accessToken: 'deduped-token-123' },
          },
        };
      }
      return { data: {} };
    });

    // Fire 4 concurrent refreshAccessToken() calls simultaneously (e.g. StrictMode + concurrent queries)
    const [t1, t2, t3, t4] = await Promise.all([
      refreshAccessToken(),
      refreshAccessToken(),
      refreshAccessToken(),
      refreshAccessToken(),
    ]);

    // All callers must receive the exact same token
    expect(t1).toBe('deduped-token-123');
    expect(t2).toBe('deduped-token-123');
    expect(t3).toBe('deduped-token-123');
    expect(t4).toBe('deduped-token-123');
    expect(getAccessToken()).toBe('deduped-token-123');

    // Exactly 1 network request was issued to the backend
    expect(networkCallCount).toBe(1);
  });

  it('allows subsequent calls after previous refresh finishes to initiate a new request', async () => {
    let networkCallCount = 0;

    vi.spyOn(axios, 'post').mockImplementation(async (url: any) => {
      if (String(url).includes('/auth/refresh')) {
        networkCallCount++;
        return {
          data: {
            status: 'success',
            data: { accessToken: `token-call-${networkCallCount}` },
          },
        };
      }
      return { data: {} };
    });

    const token1 = await refreshAccessToken();
    expect(token1).toBe('token-call-1');
    expect(networkCallCount).toBe(1);

    const token2 = await refreshAccessToken();
    expect(token2).toBe('token-call-2');
    expect(networkCallCount).toBe(2);
  });

  it('clears inFlightRefreshPromise and resets access token when refresh fails', async () => {
    vi.spyOn(axios, 'post').mockRejectedValueOnce(new Error('Network error on refresh'));

    await expect(refreshAccessToken()).rejects.toThrow('Network error on refresh');
    expect(getAccessToken()).toBeNull();

    // After failure, a new attempt can be made
    vi.spyOn(axios, 'post').mockResolvedValueOnce({
      data: {
        status: 'success',
        data: { accessToken: 'recovered-token' },
      },
    });

    const recovered = await refreshAccessToken();
    expect(recovered).toBe('recovered-token');
    expect(getAccessToken()).toBe('recovered-token');
  });
});
