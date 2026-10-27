import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prismaForRequest } from '../config/prisma';

const systemPrisma = prismaForRequest({ isSuperAdmin: true });

describe('Search Security, Wildcard Escaping & RBAC Enforcement Suite', () => {
  let memberToken: string;
  let adminToken: string;
  let tenantId: string;
  let sampleLicenseKey: string;
  let sampleLicenseName: string;

  beforeAll(async () => {
    // 1. Authenticate TechCorp Member
    const memberLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'techcorp.dev1@techcorp.io', password: 'Password123!' });
    expect(memberLogin.status).toBe(200);
    memberToken = memberLogin.body.data.accessToken;
    tenantId = memberLogin.body.data.user.tenantId;

    // 2. Authenticate TechCorp Admin
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'techcorp.admin@techcorp.io', password: 'Password123!' });
    expect(adminLogin.status).toBe(200);
    adminToken = adminLogin.body.data.accessToken;

    // 3. Find a license in TechCorp to retrieve its secret license key & name
    const lic = await systemPrisma.license.findFirst({
      where: { tenantId },
    });
    expect(lic).toBeDefined();
    sampleLicenseKey = lic!.licenseKey;
    sampleLicenseName = lic!.name;
    expect(sampleLicenseKey).toContain('LIC-TECHCORP');
    // Ensure the name does not accidentally contain the secret key string
    expect(sampleLicenseName).not.toContain(sampleLicenseKey);
  });

  describe('1. License Key Privacy & Substring Probing Prevention', () => {
    it('proves MEMBER cannot match or probe licenses by secret license key in global search', async () => {
      // Searching explicitly for the secret license key
      const res = await request(app)
        .get(`/api/search?q=${encodeURIComponent(sampleLicenseKey)}`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      // MEMBER must NOT get any license matching by key
      expect(res.body.data.results.licenses).toEqual([]);
    });

    it('proves MEMBER cannot match licenses by secret key in /api/search/licenses', async () => {
      const res = await request(app)
        .get(`/api/search/licenses?q=${encodeURIComponent(sampleLicenseKey)}`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toEqual([]);
    });

    it('allows TENANT_ADMIN to search licenses by secret key with unmasked view', async () => {
      const res = await request(app)
        .get(`/api/search?q=${encodeURIComponent(sampleLicenseKey)}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.results.licenses.length).toBeGreaterThanOrEqual(1);

      const foundLicense = res.body.data.results.licenses.find(
        (l: any) => l.title === sampleLicenseName
      );
      expect(foundLicense).toBeDefined();
      expect(foundLicense.subtitle).toContain(sampleLicenseKey);
    });

    it('masks license key for MEMBER even when license matches by name', async () => {
      const res = await request(app)
        .get(`/api/search?q=${encodeURIComponent(sampleLicenseName)}`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      const foundLicense = res.body.data.results.licenses.find(
        (l: any) => l.title === sampleLicenseName
      );
      expect(foundLicense).toBeDefined();
      // Must NOT reveal raw key; must be masked
      expect(foundLicense.subtitle).not.toContain(sampleLicenseKey);
      expect(foundLicense.subtitle).toContain(`••••••••-${sampleLicenseKey.slice(-4)}`);
    });
  });

  describe('2. Minimum Query Length Enforcement', () => {
    it('rejects single-character query (< 2 chars) with 400 Bad Request', async () => {
      const res = await request(app)
        .get('/api/search?q=a')
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
      expect(res.body.error.message).toContain('at least 2 characters');
    });

    it('rejects single-character query on entity-specific search routes with 400 Bad Request', async () => {
      const resAssets = await request(app)
        .get('/api/search/assets?q=x')
        .set('Authorization', `Bearer ${memberToken}`);
      expect(resAssets.status).toBe(400);
      expect(resAssets.body.status).toBe('error');

      const resLicenses = await request(app)
        .get('/api/search/licenses?q=x')
        .set('Authorization', `Bearer ${memberToken}`);
      expect(resLicenses.status).toBe(400);
      expect(resLicenses.body.status).toBe('error');
    });

    it('gracefully handles empty/missing search query with 200 OK and empty arrays', async () => {
      const res = await request(app)
        .get('/api/search')
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.results.assets).toEqual([]);
      expect(res.body.data.results.licenses).toEqual([]);
      expect(res.body.data.results.vendors).toEqual([]);
      expect(res.body.data.results.tags).toEqual([]);
      expect(res.body.data.total).toBe(0);
    });
  });

  describe('3. Wildcard Escaping (%, _, \\)', () => {
    it('escapes % wildcards so arbitrary substrings do not match', async () => {
      const res = await request(app)
        .get('/api/search?q=%25%25') // "%%"
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.total).toBe(0);
    });

    it('escapes _ wildcards so single-character matching does not probe characters', async () => {
      const res = await request(app)
        .get('/api/search?q=__') // "__"
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.total).toBe(0);
    });
  });

  describe('4. RBAC Authorization per Entity Type', () => {
    it('allows MEMBER to search assets (assets:read)', async () => {
      const res = await request(app)
        .get('/api/search/assets?q=Asset')
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('allows MEMBER to search licenses (licenses:read)', async () => {
      const res = await request(app)
        .get('/api/search/licenses?q=Agreement')
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('allows MEMBER to search tags (tags:read)', async () => {
      const res = await request(app)
        .get('/api/search/tags?q=vector')
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('blocks MEMBER from searching vendors with 403 Forbidden (lacks vendors:read)', async () => {
      const res = await request(app)
        .get('/api/search/vendors?q=Adobe')
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(403);
      expect(res.body.status).toBe('error');
      expect(res.body.error.message).toContain("lacks permission 'vendors:read'");
    });

    it('allows TENANT_ADMIN to search vendors (has vendors:read)', async () => {
      const res = await request(app)
        .get('/api/search/vendors?q=Adobe')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('omits vendors from global search results when caller lacks vendors:read', async () => {
      const res = await request(app)
        .get('/api/search?q=Adobe')
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      // MEMBER cannot read vendors -> vendors array must be empty
      expect(res.body.data.results.vendors).toEqual([]);
    });

    it('includes vendors in global search results when caller has vendors:read', async () => {
      const res = await request(app)
        .get('/api/search?q=Adobe')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.results.vendors.length).toBeGreaterThanOrEqual(1);
    });
  });
});
