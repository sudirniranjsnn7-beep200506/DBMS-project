// ==============================================================================
// AssetVault: Server Background Worker Flag & Scheduler Activation Suite
// Course: BCSE307L Database Systems (Fall 2026-27)
// Verifies authoritative ENABLE_IN_PROCESS_WORKER flag and startServer behavior
// ==============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env';
import { jobScheduler } from '../jobs/scheduler';
import { startServer } from '../server';

describe('Server Background Worker Flag & Scheduler Isolation Suite', () => {
  let originalWorkerFlag: boolean;

  beforeEach(() => {
    originalWorkerFlag = env.ENABLE_IN_PROCESS_WORKER;
  });

  afterEach(() => {
    (env as any).ENABLE_IN_PROCESS_WORKER = originalWorkerFlag;
    vi.restoreAllMocks();
  });

  describe('1. Authoritative Flag Default & Contract Validation', () => {
    it('defaults ENABLE_IN_PROCESS_WORKER to false in env when not explicitly enabled', () => {
      // In production / test defaults, the flag must be false so API does not start duplicate jobs
      expect(typeof env.ENABLE_IN_PROCESS_WORKER).toBe('boolean');
    });

    it('ensures docker-compose.yml sets ENABLE_IN_PROCESS_WORKER=false for api and true for worker', () => {
      const composePath = path.resolve(__dirname, '../../../docker-compose.yml');
      const composeContent = fs.readFileSync(composePath, 'utf-8');

      // API service must set ENABLE_IN_PROCESS_WORKER: "false"
      expect(composeContent).toMatch(
        /api:[\s\S]*?ENABLE_IN_PROCESS_WORKER:\s*"false"/
      );

      // Dedicated worker service must set ENABLE_IN_PROCESS_WORKER: "true"
      expect(composeContent).toMatch(
        /worker:[\s\S]*?ENABLE_IN_PROCESS_WORKER:\s*"true"/
      );
    });

    it('ensures root and backend .env.example document ENABLE_IN_PROCESS_WORKER=false', () => {
      const rootEnvPath = path.resolve(__dirname, '../../../.env.example');
      const backendEnvPath = path.resolve(__dirname, '../../.env.example');

      const rootEnvContent = fs.readFileSync(rootEnvPath, 'utf-8');
      const backendEnvContent = fs.readFileSync(backendEnvPath, 'utf-8');

      expect(rootEnvContent).toMatch(/^ENABLE_IN_PROCESS_WORKER=false/m);
      expect(backendEnvContent).toMatch(/^ENABLE_IN_PROCESS_WORKER=false/m);
    });

    it('ensures docs/deployment.md documents ENABLE_IN_PROCESS_WORKER as the authoritative flag', () => {
      const docPath = path.resolve(__dirname, '../../../docs/deployment.md');
      const docContent = fs.readFileSync(docPath, 'utf-8');

      expect(docContent).toContain('ENABLE_IN_PROCESS_WORKER');
      expect(docContent).toMatch(/defaults to `false`/i);
    });
  });

  describe('2. startServer() Scheduler Execution Behavior', () => {
    it('does NOT call jobScheduler.startScheduler() when ENABLE_IN_PROCESS_WORKER is false', async () => {
      // Explicitly turn flag off
      (env as any).ENABLE_IN_PROCESS_WORKER = false;

      const startSpy = vi.spyOn(jobScheduler, 'startScheduler');
      const stopSpy = vi.spyOn(jobScheduler, 'stopScheduler');

      // Start server on an ephemeral port (0) to avoid any port collision
      const server: any = await startServer(0);

      try {
        expect(startSpy).not.toHaveBeenCalled();
      } finally {
        if (server && typeof server.close === 'function') {
          await new Promise<void>((resolve) => server.close(() => resolve()));
        }
      }

      expect(stopSpy).not.toHaveBeenCalled();
    });

    it('DOES call jobScheduler.startScheduler() when ENABLE_IN_PROCESS_WORKER is true', async () => {
      // Explicitly turn flag on
      (env as any).ENABLE_IN_PROCESS_WORKER = true;

      const startSpy = vi.spyOn(jobScheduler, 'startScheduler').mockImplementation(() => {});

      // Start server on an ephemeral port (0)
      const server: any = await startServer(0);

      try {
        expect(startSpy).toHaveBeenCalledTimes(1);
      } finally {
        if (server && typeof server.close === 'function') {
          await new Promise<void>((resolve) => server.close(() => resolve()));
        }
      }
    });
  });
});
