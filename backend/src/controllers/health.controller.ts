import { Request, Response } from 'express';
import { prisma } from '../config/prisma';

export const getHealth = async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.status(200).json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
      service: 'assetvault-api',
      uptimeSeconds: Math.floor(process.uptime()),
    });
  } catch (error) {
    return res.status(503).json({
      status: 'degraded',
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Database check failed',
      timestamp: new Date().toISOString(),
      service: 'assetvault-api',
    });
  }
};
