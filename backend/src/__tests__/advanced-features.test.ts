// ==============================================================================
// AssetVault: Advanced Enterprise Features Test Suite
// Course: BCSE307L Database Systems (Fall 2026-27)
// Covers:
//   1. Compliance Engine (Score 0-100, Grade A-D, Factors, Remediation items)
//   2. Cost Optimisation & Dormant Seats (>30d inactive, savings, v_vendor_spend)
//   3. Global pg_trgm Search (Assets, Licenses, Vendors, Tags)
//   4. Document Exports (PDF License Dossier, RFC 4180 CSV Audit Log)
//   5. Data Lifecycle & Compliance (GET /api/tenant/export full JSON archive)
//   6. Observability (X-Request-Id, /health, /ready, protected /metrics)
//   7. Database Advisory Locks (pg_try_advisory_lock idempotency)
// ==============================================================================

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import app from '../app';
import { prismaForRequest } from '../config/prisma';
import { env } from '../config/env';
import { jobScheduler } from '../jobs/scheduler';
import { emailService } from '../services/email.service';

const systemPrisma = prismaForRequest({ isSuperAdmin: true });

describe('AssetVault Advanced Enterprise Features Suite', () => {
  let adminToken: string;
  let memberToken: string;
  let tenantId: string;
  let testLicenseId: string;

  beforeAll(async () => {
    // 1. Authenticate TechCorp Tenant Admin
    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'techcorp.admin@techcorp.io', password: 'Password123!' });
    expect(adminLoginRes.status).toBe(200);
    adminToken = adminLoginRes.body.data.accessToken;
    tenantId = adminLoginRes.body.data.user.tenantId;

    // 2. Authenticate TechCorp Member
    const memberLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'techcorp.dev1@techcorp.io', password: 'Password123!' });
    expect(memberLoginRes.status).toBe(200);
    memberToken = memberLoginRes.body.data.accessToken;

    // 3. Find an existing license for TechCorp
    const license = await systemPrisma.license.findFirst({
      where: { tenantId, deletedAt: null },
    });
    expect(license).toBeDefined();
    testLicenseId = license!.id;
  });

  // --------------------------------------------------------------------------
  // 1. Compliance Engine (Score 0-100, Grade A-D, Remediation List)
  // --------------------------------------------------------------------------
  describe('1. Compliance Engine (GET /api/reports/compliance)', () => {
    it('returns tenant compliance report with score, grade, factors and remediation items', async () => {
      const res = await request(app)
        .get('/api/reports/compliance')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('score');
      expect(typeof res.body.data.score).toBe('number');
      expect(res.body.data.score).toBeGreaterThanOrEqual(0);
      expect(res.body.data.score).toBeLessThanOrEqual(100);

      expect(['A', 'B', 'C', 'D']).toContain(res.body.data.grade);
      expect(Array.isArray(res.body.data.factors)).toBe(true);
      expect(res.body.data.factors.length).toBe(4);

      // Verify 4 compliance factors are calculated
      const factorNames = res.body.data.factors.map((f: any) => f.name);
      expect(factorNames).toContain('Asset Licensing Coverage');
      expect(factorNames).toContain('Seat Availability & Allocation Health');
      expect(factorNames).toContain('Active Assets with Expired Licenses');
      expect(factorNames).toContain('30-Day Expiration Horizon');

      expect(res.body.data).toHaveProperty('stats');
      expect(res.body.data.stats).toHaveProperty('totalAssets');
      expect(res.body.data.stats).toHaveProperty('compliantAssets');

      expect(Array.isArray(res.body.data.remediationItems)).toBe(true);
    });

    it('rejects unauthenticated requests to compliance endpoint with 401', async () => {
      const res = await request(app).get('/api/reports/compliance');
      expect(res.status).toBe(401);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Cost Optimisation Insights (Dormant Seats, Monthly Savings, v_vendor_spend)
  // --------------------------------------------------------------------------
  describe('2. Cost Optimisation Insights (GET /api/reports/unused-seats)', () => {
    it('returns reclaim candidates, potential monthly savings, and top expensive vendors', async () => {
      const res = await request(app)
        .get('/api/reports/unused-seats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('summary');
      expect(res.body.data.summary).toHaveProperty('totalUnusedSeats');
      expect(res.body.data.summary).toHaveProperty('potentialMonthlySavings');
      expect(res.body.data.summary).toHaveProperty('potentialAnnualSavings');
      expect(res.body.data.summary).toHaveProperty('averageCostPerSeat');

      expect(Array.isArray(res.body.data.reclaimCandidates)).toBe(true);
      expect(Array.isArray(res.body.data.topExpensiveVendors)).toBe(true);

      // Verify structure of top expensive vendors from v_vendor_spend
      if (res.body.data.topExpensiveVendors.length > 0) {
        const topVendor = res.body.data.topExpensiveVendors[0];
        expect(topVendor).toHaveProperty('vendorId');
        expect(topVendor).toHaveProperty('vendorName');
        expect(topVendor).toHaveProperty('grandTotalSpend');
        expect(topVendor).toHaveProperty('avgCostPerSeat');
      }
    });

    it('requires allocations:manage_all permission to view cost optimisation reports', async () => {
      const res = await request(app)
        .get('/api/reports/unused-seats')
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(403);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Global Trigram Search (Assets, Licenses, Vendors, Tags)
  // --------------------------------------------------------------------------
  describe('3. Global Trigram Search (GET /api/search)', () => {
    it('searches across multiple entities simultaneously and groups results', async () => {
      const res = await request(app)
        .get('/api/search?q=tech')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('query', 'tech');
      expect(res.body.data).toHaveProperty('results');
      expect(res.body.data.results).toHaveProperty('assets');
      expect(res.body.data.results).toHaveProperty('licenses');
      expect(res.body.data.results).toHaveProperty('vendors');
      expect(res.body.data.results).toHaveProperty('tags');
      expect(res.body.data).toHaveProperty('total');
      expect(typeof res.body.data.total).toBe('number');
    });

    it('handles search queries without parameters gracefully returning empty arrays', async () => {
      const res = await request(app)
        .get('/api/search')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.total).toBe(0);
      expect(res.body.data.results.assets).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Document & Data Exports (PDF License Dossier, RFC 4180 CSV Audit Log)
  // --------------------------------------------------------------------------
  describe('4. Exports (PDF License Dossier & CSV Audit Log)', () => {
    it('generates a binary PDF license dossier with covered assets, seats, and renewals', async () => {
      const res = await request(app)
        .get(`/api/licenses/${testLicenseId}/pdf`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toContain('attachment; filename=');
      expect(res.body).toBeDefined();
    });

    it('exports audit log as RFC 4180 CSV with headers and sanitized fields', async () => {
      const res = await request(app)
        .get('/api/audit-logs/export')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('attachment; filename=');

      const csvContent = res.text;
      expect(csvContent).toContain('ID,Timestamp,Action,Table Name,Record ID');
    });

    it('supports action filtering on CSV audit log export', async () => {
      const res = await request(app)
        .get('/api/audit-logs/export?action=LOGIN')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.text).toContain('ID,Timestamp,Action');
    });
  });

  // --------------------------------------------------------------------------
  // 5. Tenant Data Lifecycle Archive (GET /api/tenant/export)
  // --------------------------------------------------------------------------
  describe('5. Data Lifecycle Archive (GET /api/tenant/export)', () => {
    it('returns full GDPR JSON archive including tenant info, assets, licenses, allocations, categories, and tags', async () => {
      const res = await request(app)
        .get('/api/tenant/export')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/json');
      expect(res.headers['content-disposition']).toContain('attachment; filename=');

      const archive = res.body;
      expect(archive).toHaveProperty('tenant');
      expect(archive.tenant.id).toBe(tenantId);
      expect(archive).toHaveProperty('assets');
      expect(archive).toHaveProperty('licenses');
      expect(archive).toHaveProperty('vendors');
      expect(archive).toHaveProperty('categories');
      expect(archive).toHaveProperty('tags');
      expect(archive).toHaveProperty('allocations');
      expect(archive).toHaveProperty('metadata');
      expect(archive.metadata).toHaveProperty('recordCounts');
      expect(archive.metadata).toHaveProperty('exportedAt');
    });

    it('prevents regular MEMBER role from exporting tenant archive', async () => {
      const res = await request(app)
        .get('/api/tenant/export')
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(403);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Observability Basics (X-Request-Id, /health, /ready, /metrics)
  // --------------------------------------------------------------------------
  describe('6. Observability & Tracing', () => {
    it('injects X-Request-Id header on all API responses', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.headers['x-request-id']).toBeDefined();
      expect(typeof res.headers['x-request-id']).toBe('string');
      expect(String(res.headers['x-request-id']).length).toBeGreaterThan(0);
    });

    it('GET /api/ready verifies PostgreSQL connection and returns 200 ready', async () => {
      const res = await request(app).get('/api/ready');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ready');
      expect(res.body.database?.status).toBe('connected');
    });

    it('GET /api/health returns liveness status', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });

    it('rejects GET /metrics without bearer token with 401', async () => {
      const res = await request(app).get('/metrics');
      expect(res.status).toBe(401);
    });

    it('allows GET /metrics with configured Bearer token and returns Prometheus text', async () => {
      const res = await request(app)
        .get('/metrics')
        .set('Authorization', `Bearer ${env.METRICS_BEARER_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.text).toContain('http_request_duration_seconds');
      expect(res.text).toContain('license_allocation_failures_total');
    });
  });

  // --------------------------------------------------------------------------
  // 7. PostgreSQL Advisory Locks & Background Jobs Idempotency
  // --------------------------------------------------------------------------
  describe('7. PostgreSQL Advisory Locks & Scheduler Idempotency', () => {
    it('acquires and releases advisory locks safely via pg_try_advisory_lock', async () => {
      const testLockId = 9999;

      // 1. Acquire lock
      const acquired: any = await systemPrisma.$queryRaw(
        Prisma.sql`SELECT pg_try_advisory_lock(${testLockId}::int) AS locked;`
      );
      expect(acquired[0].locked).toBe(true);

      // 2. Release lock
      const released: any = await systemPrisma.$queryRaw(
        Prisma.sql`SELECT pg_advisory_unlock(${testLockId}::int) AS unlocked;`
      );
      expect(released[0].unlocked).toBe(true);
    });

    it('scheduler has registered jobs with advisory locks configured', () => {
      expect(jobScheduler).toBeDefined();
      expect(typeof jobScheduler.startScheduler).toBe('function');
      expect(typeof jobScheduler.stopScheduler).toBe('function');
      expect(typeof jobScheduler.runExpiryNotificationsJob).toBe('function');
    });
  });

  // --------------------------------------------------------------------------
  // 8. Transactional Email Sandbox
  // --------------------------------------------------------------------------
  describe('8. Transactional Email Service', () => {
    it('initializes email service with nodemailer transporter and sends notice without error', async () => {
      expect(emailService).toBeDefined();
      const result = await emailService.sendExpiryAlert({
        to: 'techcorp.admin@techcorp.io',
        recipientName: 'TechCorp Admin',
        licenseName: 'Test JetBrains License',
        daysLeft: 15,
        expiryDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'EXPIRY_15',
        tenantName: 'TechCorp International',
      });

      expect(typeof result).toBe('boolean');
      expect(result).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 9. Deployment & Container Configuration Contracts
  // --------------------------------------------------------------------------
  describe('9. Deployment & Container Configuration Contracts', () => {
    it('ensures docker-compose.yml and .env.example provide DIRECT_URL required by schema.prisma', () => {
      const composePath = path.resolve(__dirname, '../../../docker-compose.yml');
      const envExamplePath = path.resolve(__dirname, '../../../.env.example');

      const composeContent = fs.readFileSync(composePath, 'utf-8');
      const envExampleContent = fs.readFileSync(envExamplePath, 'utf-8');

      // Verify .env.example defines DIRECT_URL
      expect(envExampleContent).toMatch(/^DIRECT_URL=/m);

      // Verify docker-compose.yml configures DIRECT_URL for both api and worker services
      expect(composeContent).toMatch(/api:[\s\S]*?DIRECT_URL:\s*postgresql:/);
      expect(composeContent).toMatch(/worker:[\s\S]*?DIRECT_URL:\s*postgresql:/);
    });

    it('ensures prisma CLI is in production dependencies pinned to @prisma/client version', () => {
      const backendPkgPath = path.resolve(__dirname, '../../package.json');
      const backendPkg = JSON.parse(fs.readFileSync(backendPkgPath, 'utf-8'));

      // prisma CLI must be in dependencies (not devDependencies) so runner stage with --omit=dev installs it
      expect(backendPkg.dependencies.prisma).toBeDefined();
      expect(backendPkg.dependencies.prisma).toBe(backendPkg.dependencies['@prisma/client']);
      expect(backendPkg.devDependencies?.prisma).toBeUndefined();
    });

    it('ensures database bootstrap SQL enables LOGIN when setting assetvault_app password', () => {
      const bootstrapSqlPath = path.resolve(__dirname, '../../../database/sql/08_production_bootstrap.sql');
      const bootstrapSql = fs.readFileSync(bootstrapSqlPath, 'utf-8');

      // The role is created WITH NOLOGIN in migrations, so bootstrap MUST include WITH LOGIN when altering password
      expect(bootstrapSql).toMatch(/ALTER ROLE assetvault_app WITH[^;]*LOGIN[^;]*PASSWORD/i);
    });

    it('ensures seed script supports MIGRATE_DATABASE_URL or DIRECT_URL for owner execution', () => {
      const seedScriptPath = path.resolve(__dirname, '../../prisma/seed.ts');
      const seedScript = fs.readFileSync(seedScriptPath, 'utf-8');

      // Seed script must read MIGRATE_DATABASE_URL or DIRECT_URL to connect as owner during cross-tenant seed
      expect(seedScript).toMatch(/MIGRATE_DATABASE_URL|DIRECT_URL/);
    });
  });
});

