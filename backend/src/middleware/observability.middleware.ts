// ==============================================================================
// AssetVault: Observability, Metrics & Telemetry Subsystem
// Course: BCSE307L Database Systems (Fall 2026-27)
// Provides: Request ID tracing, Prometheus Metrics via prom-client, Health/Readiness
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import client from 'prom-client';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { logger } from '../config/logger';

// ------------------------------------------------------------------------------
// 1. Prometheus Registry & Metrics Setup
// ------------------------------------------------------------------------------
export const register = new client.Registry();

// Default process & Node.js metrics
client.collectDefaultMetrics({
  register,
  prefix: 'assetvault_',
});

// Custom HTTP Duration Metric
export const httpRequestDurationSeconds = new client.Histogram({
  name: 'assetvault_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

// Custom License Allocation Failures Metric
export const licenseAllocationFailuresTotal = new client.Counter({
  name: 'assetvault_license_allocation_failures_total',
  help: 'Total count of license seat allocation failures partitioned by reason',
  labelNames: ['reason'],
  registers: [register],
});

// SSE Active Connections Gauge
export const sseActiveConnectionsGauge = new client.Gauge({
  name: 'assetvault_sse_active_connections',
  help: 'Number of active Server-Sent Events notification stream connections',
  registers: [register],
});

// DB Pool Active Connections Gauge
export const dbPoolConnectionsGauge = new client.Gauge({
  name: 'assetvault_db_pool_active_connections',
  help: 'Active database connection pool utilization gauge',
  registers: [register],
});

// Scheduled Job Execution Duration Metric
export const scheduledJobDurationSeconds = new client.Histogram({
  name: 'assetvault_scheduled_job_duration_seconds',
  help: 'Execution duration of scheduled background jobs in seconds',
  labelNames: ['job_name'],
  buckets: [0.1, 0.5, 1, 2.5, 5, 10, 30, 60],
  registers: [register],
});

// Scheduled Job Failures Metric
export const scheduledJobFailuresTotal = new client.Counter({
  name: 'assetvault_scheduled_job_failures_total',
  help: 'Total count of scheduled job failures',
  labelNames: ['job_name'],
  registers: [register],
});

// ------------------------------------------------------------------------------
// 2. Request ID & Tracing Middleware (X-Request-Id)
// ------------------------------------------------------------------------------
declare global {
  namespace Express {
    interface Request {
      id?: string;
      startTime?: number;
    }
  }
}

export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const incomingId = req.headers['x-request-id'] as string | undefined;
  const requestId =
    incomingId && /^[A-Za-z0-9._:-]{1,128}$/.test(incomingId)
      ? incomingId
      : crypto.randomUUID();

  req.id = requestId;
  req.startTime = Date.now();
  res.setHeader('X-Request-Id', requestId);

  // Hook response finish for Prometheus request duration measurement
  res.on('finish', () => {
    if (req.startTime) {
      const durationSeconds = (Date.now() - req.startTime) / 1000;
      const normalizedRoute = req.route?.path || req.baseUrl || req.path || 'unknown';
      httpRequestDurationSeconds.observe(
        {
          method: req.method,
          route: normalizedRoute,
          status_code: res.statusCode.toString(),
        },
        durationSeconds
      );
    }
  });

  next();
};

// ------------------------------------------------------------------------------
// 3. GET /metrics Endpoint (Protected by Bearer Token)
// ------------------------------------------------------------------------------
export const getMetricsHandler = async (req: Request, res: Response): Promise<void> => {
  const authHeader = req.headers.authorization;
  const expectedToken = `Bearer ${env.METRICS_BEARER_TOKEN}`;

  if (!authHeader || authHeader !== expectedToken) {
    logger.warn({ ip: req.ip }, 'Unauthorized attempt to scrape /metrics');
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Valid Bearer token required to access metrics telemetry',
      },
    });
    return;
  }

  try {
    res.setHeader('Content-Type', register.contentType);
    const metricsOutput = await register.metrics();
    res.send(metricsOutput);
  } catch (err: any) {
    logger.error({ err }, 'Error collecting Prometheus metrics');
    res.status(500).json({ error: { code: 'METRICS_ERROR', message: 'Failed to generate metrics' } });
  }
};

// ------------------------------------------------------------------------------
// 4. GET /api/ready Readiness Probe (Verifies PostgreSQL Connectivity)
// ------------------------------------------------------------------------------
export const getReadinessHandler = async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  try {
    // Run direct query to verify database connection pool and responsiveness
    await prisma.$queryRaw`SELECT 1 as ping`;
    const latencyMs = Date.now() - startTime;

    res.status(200).json({
      status: 'ready',
      database: {
        status: 'connected',
        latencyMs,
      },
      timestamp: new Date().toISOString(),
      service: 'assetvault-api',
    });
  } catch (err: any) {
    logger.error({ err, requestId: req.id }, 'Readiness check failed: Database unreachable');
    res.status(503).json({
      status: 'not_ready',
      database: {
        status: 'disconnected',
        error: 'Database unavailable',
      },
      timestamp: new Date().toISOString(),
      service: 'assetvault-api',
    });
  }
};
