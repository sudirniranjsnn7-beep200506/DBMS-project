import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotificationStreamClient } from '../services/notificationStream';
import { setAccessToken } from '../services/api';

describe('NotificationStreamClient Fetch-Streaming & Backoff Suite', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setAccessToken('mock-valid-jwt-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    setAccessToken(null);
  });

  it('stops reconnect loop immediately on HTTP 401 Unauthorized', async () => {
    const onAuthError = vi.fn();
    const onError = vi.fn();

    // Mock global fetch returning 401
    const mockFetch = vi.fn().mockResolvedValue({
      status: 401,
      ok: false,
    });
    vi.stubGlobal('fetch', mockFetch);

    const client = new NotificationStreamClient({
      onAuthError,
      onError,
      initialBackoffMs: 1000,
    });

    client.start();
    await vi.advanceTimersByTimeAsync(0);

    // Verify fetch was called once with Authorization Bearer header
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain('/notifications/stream');
    expect(init.headers.Authorization).toBe('Bearer mock-valid-jwt-token');
    expect(init.headers.Accept).toBe('text/event-stream');

    // Verify reconnect loop is stopped
    expect(client.isStopped()).toBe(true);
    expect(onAuthError).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();

    // Fast-forward time to verify NO reconnect was scheduled
    await vi.advanceTimersByTimeAsync(10000);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('applies exponential backoff on network errors and schedules retries', async () => {
    const onError = vi.fn();

    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
    vi.stubGlobal('fetch', mockFetch);

    const client = new NotificationStreamClient({
      onError,
      initialBackoffMs: 1000,
      backoffMultiplier: 2,
      maxBackoffMs: 8000,
    });

    expect(client.getCurrentBackoff()).toBe(1000);

    // Initial connection attempt
    client.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);

    // After failure 1, backoff should be multiplied by 2 (2000ms)
    expect(client.getCurrentBackoff()).toBe(2000);

    // Advance time by 1000ms (the delay scheduled for attempt 2)
    await vi.advanceTimersByTimeAsync(1000);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // After failure 2, backoff should be multiplied to 4000ms
    expect(client.getCurrentBackoff()).toBe(4000);

    // Clean stop
    client.stop();
    expect(client.isStopped()).toBe(true);
  });

  it('correctly parses SSE event: notification payload and ignores keepalive comments', () => {
    const onNotification = vi.fn();
    const client = new NotificationStreamClient({ onNotification });

    // 1. Process keepalive ping (should not trigger onNotification)
    client.processSseBlock(': keepalive-ping\n\n');
    expect(onNotification).not.toHaveBeenCalled();

    // 2. Process connected event (should not trigger onNotification)
    client.processSseBlock('event: connected\ndata: {"status": "connected"}\n\n');
    expect(onNotification).not.toHaveBeenCalled();

    // 3. Process notification event
    const notifData = {
      id: 'notif-1',
      title: 'License Renewal Warning',
      message: 'Figma Cloud Inc license expires in 7 days',
    };
    client.processSseBlock(`event: notification\ndata: ${JSON.stringify(notifData)}\n\n`);

    expect(onNotification).toHaveBeenCalledTimes(1);
    expect(onNotification).toHaveBeenCalledWith(notifData);
  });

  it('does not attempt connection when no token is available', async () => {
    setAccessToken(null);
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    const client = new NotificationStreamClient();
    client.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(mockFetch).not.toHaveBeenCalled();
    expect(client.isStopped()).toBe(true);
  });
});
