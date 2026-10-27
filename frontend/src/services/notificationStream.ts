// ==============================================================================
// AssetVault: Frontend Real-time Notification Stream via Fetch Streaming
// Course: BCSE307L Database Systems (Fall 2026-27)
// Fixes EventSource header limitation: Uses fetch() with Bearer Authorization header
// Implements exponential backoff and terminates reconnect loop immediately on 401
// Respects VITE_API_URL via API_BASE_URL
// ==============================================================================

import { API_BASE_URL, getAccessToken } from './api';

export interface NotificationStreamOptions {
  url?: string;
  onNotification?: (notification: any) => void;
  onConnected?: () => void;
  onError?: (error: any) => void;
  onAuthError?: () => void;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
  backoffMultiplier?: number;
}

export class NotificationStreamClient {
  private url: string;
  private onNotification?: (notification: any) => void;
  private onConnected?: () => void;
  private onError?: (error: any) => void;
  private onAuthError?: () => void;
  private initialBackoffMs: number;
  private maxBackoffMs: number;
  private backoffMultiplier: number;

  private currentBackoffMs: number;
  private abortController: AbortController | null = null;
  private reconnectTimeoutId: any = null;
  private isExplicitlyStopped = false;
  private isConnecting = false;

  constructor(options: NotificationStreamOptions = {}) {
    const defaultStreamUrl = `${API_BASE_URL}/notifications/stream`;
    this.url = options.url || defaultStreamUrl;
    this.onNotification = options.onNotification;
    this.onConnected = options.onConnected;
    this.onError = options.onError;
    this.onAuthError = options.onAuthError;
    this.initialBackoffMs = options.initialBackoffMs || 1000;
    this.maxBackoffMs = options.maxBackoffMs || 30000;
    this.backoffMultiplier = options.backoffMultiplier || 2;
    this.currentBackoffMs = this.initialBackoffMs;
  }

  public start(): void {
    this.isExplicitlyStopped = false;
    this.connect();
  }

  public stop(): void {
    this.isExplicitlyStopped = true;
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  public isStopped(): boolean {
    return this.isExplicitlyStopped;
  }

  public getCurrentBackoff(): number {
    return this.currentBackoffMs;
  }

  public async connect(): Promise<void> {
    if (this.isExplicitlyStopped || this.isConnecting) return;

    const token = getAccessToken();
    if (!token) {
      console.warn('[NotificationStream] No access token available. Halting connection.');
      this.stop();
      return;
    }

    this.isConnecting = true;
    this.abortController = new AbortController();

    try {
      const response = await fetch(this.url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        signal: this.abortController.signal,
      });

      // Crucial requirement: Halt reconnect loop on 401 Unauthorized
      if (response.status === 401) {
        console.warn('[NotificationStream] 401 Unauthorized received. Stopping reconnect loop.');
        this.stop();
        if (this.onAuthError) this.onAuthError();
        this.isConnecting = false;
        return;
      }

      if (!response.ok) {
        throw new Error(`SSE stream connection failed with HTTP status ${response.status}`);
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported on response body');
      }

      // Successful connection: reset backoff to initial
      this.currentBackoffMs = this.initialBackoffMs;
      this.isConnecting = false;
      if (this.onConnected) this.onConnected();

      await this.readStream(response.body);
    } catch (err: any) {
      this.isConnecting = false;
      if (this.isExplicitlyStopped || err.name === 'AbortError') {
        return;
      }

      console.warn(`[NotificationStream] Connection error (${err.message}). Scheduling backoff retry.`);
      if (this.onError) this.onError(err);
      this.scheduleReconnect();
    }
  }

  private async readStream(body: ReadableStream<Uint8Array>): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (!this.isExplicitlyStopped) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split('\n\n');
        buffer = blocks.pop() || '';

        for (const block of blocks) {
          this.processSseBlock(block);
        }
      }
    } finally {
      reader.releaseLock();
      if (!this.isExplicitlyStopped) {
        this.scheduleReconnect();
      }
    }
  }

  public processSseBlock(block: string): void {
    if (!block.trim()) return;

    let eventType = 'message';
    let dataBuffer = '';

    for (const rawLine of block.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith(':')) {
        // Comment or keepalive ping
        continue;
      }
      if (line.startsWith('event:')) {
        eventType = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        const dataPart = line.slice(5).trim();
        dataBuffer = dataBuffer ? `${dataBuffer}\n${dataPart}` : dataPart;
      }
    }

    if (eventType === 'notification' && dataBuffer && this.onNotification) {
      try {
        const parsed = JSON.parse(dataBuffer);
        this.onNotification(parsed);
      } catch {
        this.onNotification({ raw: dataBuffer });
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.isExplicitlyStopped) return;

    const delay = this.currentBackoffMs;
    // Increase backoff for next attempt up to maxBackoffMs
    this.currentBackoffMs = Math.min(
      this.currentBackoffMs * this.backoffMultiplier,
      this.maxBackoffMs
    );

    this.reconnectTimeoutId = setTimeout(() => {
      this.connect();
    }, delay);
  }
}
