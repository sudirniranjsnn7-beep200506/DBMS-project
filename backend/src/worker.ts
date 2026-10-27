// ==============================================================================
// AssetVault: Standalone Background Worker Entry Point
// Course: BCSE307L Database Systems (Fall 2026-27)
// Runs automated maintenance jobs, PostgreSQL MV refreshes, and auto-renewals
// ==============================================================================

import { jobScheduler } from './jobs/scheduler';
import { prisma } from './config/prisma';
import { logger } from './config/logger';

async function startWorker() {
  logger.info('⚙️ Starting AssetVault Dedicated Background Worker...');

  try {
    // 1. Verify Database Connectivity
    await prisma.$queryRaw`SELECT 1 as ping`;
    logger.info('✅ Worker connected to PostgreSQL successfully.');

    // 2. Start Cron Jobs
    jobScheduler.startScheduler();

    // 3. Graceful Termination Handlers
    const shutdown = async (signal: string) => {
      logger.info({ signal }, 'Received termination signal. Gracefully shutting down worker...');
      jobScheduler.stopScheduler();
      await prisma.$disconnect();
      logger.info('Worker exited cleanly.');
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err: any) {
    logger.error({ err }, '❌ Fatal: Background worker failed to initialize');
    process.exit(1);
  }
}

startWorker();
