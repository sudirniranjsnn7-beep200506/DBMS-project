// ==============================================================================
// AssetVault HTTP Server Entry Point
// Course: VIT, BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import app from './app';
import { env } from './config/env';
import { prisma } from './config/prisma';
import { jobScheduler } from './jobs/scheduler';

export const startServer = async (portOverride?: number) => {
  try {
    // Verify database connectivity
    try {
      await prisma.$connect();
      console.log('✅ Connected to PostgreSQL database successfully.');
    } catch (dbErr) {
      console.warn('⚠️ PostgreSQL database offline or unreachable. Proceeding with mock/graceful fallback.');
    }

    // Start background schedulers in API process (controlled by authoritative ENABLE_IN_PROCESS_WORKER)
    const enableWorker = env.ENABLE_IN_PROCESS_WORKER;
    if (enableWorker) {
      jobScheduler.startScheduler();
    }

    const port = portOverride ?? env.PORT;
    const server = app.listen(port, () => {
      console.log(`🚀 AssetVault API server running on port ${port} in ${env.NODE_ENV} mode`);
      console.log(`🔗 Health check available at http://localhost:${port}/api/health`);
    });

    const shutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}. Gracefully shutting down AssetVault API...`);
      if (enableWorker) {
        jobScheduler.stopScheduler();
      }
      server.close(async () => {
        await prisma.$disconnect();
        console.log('🔌 PostgreSQL disconnected. Process exited.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    return server;
  } catch (error) {
    console.error('❌ Failed to start AssetVault API server:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
};

if (process.env.NODE_ENV !== 'test') {
  startServer();
}
