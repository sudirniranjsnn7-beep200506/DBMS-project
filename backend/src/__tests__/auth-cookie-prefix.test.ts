// ==============================================================================
// AssetVault: Refresh Token Cookie Path & Dual Prefix (/api vs /api/v1) Suite
// Course: BCSE307L Database Systems (Fall 2026-27)
// Verifies that refreshToken cookie path is '/api' and covers both /api and /api/v1
// prefixes using Supertest with a cookie jar (request.agent).
// ==============================================================================

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';

describe('Refresh Token Cookie Path & Dual Prefix (/api and /api/v1) Suite', () => {
  const credentials = {
    email: 'techcorp.admin@techcorp.io',
    password: 'Password123!',
  };

  it('sets refreshToken cookie with Path=/api on login', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send(credentials);

    expect(res.status).toBe(200);
    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeDefined();

    const cookieStr = Array.isArray(setCookie) ? setCookie.join(';') : (setCookie as string);
    expect(cookieStr).toContain('refreshToken=');
    // Verify Path is /api (not restricted to /api/auth)
    expect(cookieStr).toMatch(/Path=\/api(;|$)/i);
  });

  it('allows token refresh via both /api/auth/refresh and /api/v1/auth/refresh using a supertest cookie jar', async () => {
    // 1. Create agent (supertest cookie jar)
    const agent = request.agent(app);

    // 2. Login via primary prefix /api/auth/login
    const loginRes = await agent
      .post('/api/auth/login')
      .send(credentials);

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data).toHaveProperty('accessToken');
    const initialAccessToken = loginRes.body.data.accessToken;
    expect(initialAccessToken).toBeTruthy();

    // 3. Refresh through /api/auth/refresh using the cookie jar
    const refreshRes1 = await agent
      .post('/api/auth/refresh')
      .send({});

    expect(refreshRes1.status).toBe(200);
    expect(refreshRes1.body.data).toHaveProperty('accessToken');
    const rotatedAccessToken1 = refreshRes1.body.data.accessToken;
    expect(rotatedAccessToken1).toBeTruthy();
    expect(refreshRes1.headers['set-cookie']).toBeDefined();

    // 4. Refresh through /api/v1/auth/refresh using the same cookie jar
    // If cookie path was '/api/auth', the cookie jar would NOT send the cookie to '/api/v1/auth/refresh'
    const refreshRes2 = await agent
      .post('/api/v1/auth/refresh')
      .send({});

    expect(refreshRes2.status).toBe(200);
    expect(refreshRes2.body.data).toHaveProperty('accessToken');
    const rotatedAccessToken2 = refreshRes2.body.data.accessToken;
    expect(rotatedAccessToken2).toBeTruthy();

    // 5. Subsequent refresh back through /api/auth/refresh to prove bi-directional compatibility
    const refreshRes3 = await agent
      .post('/api/auth/refresh')
      .send({});

    expect(refreshRes3.status).toBe(200);
    expect(refreshRes3.body.data).toHaveProperty('accessToken');
  });

  it('allows login via /api/v1/auth/login and subsequent refresh via /api/auth/refresh and /api/v1/auth/refresh', async () => {
    // 1. Create a fresh agent (cookie jar)
    const agent = request.agent(app);

    // 2. Login via /api/v1/auth/login
    const loginRes = await agent
      .post('/api/v1/auth/login')
      .send(credentials);

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data).toHaveProperty('accessToken');

    // Verify Set-Cookie header has Path=/api
    const setCookie = loginRes.headers['set-cookie'];
    const cookieStr = Array.isArray(setCookie) ? setCookie.join(';') : (setCookie as string);
    expect(cookieStr).toMatch(/Path=\/api(;|$)/i);

    // 3. Refresh through /api/v1/auth/refresh
    const refreshV1Res = await agent
      .post('/api/v1/auth/refresh')
      .send({});

    expect(refreshV1Res.status).toBe(200);
    expect(refreshV1Res.body.data).toHaveProperty('accessToken');

    // 4. Refresh through /api/auth/refresh
    const refreshPrimaryRes = await agent
      .post('/api/auth/refresh')
      .send({});

    expect(refreshPrimaryRes.status).toBe(200);
    expect(refreshPrimaryRes.body.data).toHaveProperty('accessToken');
  });

  it('clears refreshToken cookie with Path=/api on logout, blocking subsequent refresh on both prefixes', async () => {
    const agent = request.agent(app);

    // Login
    const loginRes = await agent
      .post('/api/auth/login')
      .send(credentials);
    expect(loginRes.status).toBe(200);

    // Logout
    const logoutRes = await agent
      .post('/api/auth/logout')
      .send({});
    expect(logoutRes.status).toBe(200);

    // Verify clearCookie has Path=/api
    const setCookie = logoutRes.headers['set-cookie'];
    const cookieStr = Array.isArray(setCookie) ? setCookie.join(';') : (setCookie as string);
    expect(cookieStr).toMatch(/Path=\/api(;|$)/i);

    // Subsequent refresh on /api/auth/refresh should fail with 401
    const failRefresh1 = await agent
      .post('/api/auth/refresh')
      .send({});
    expect(failRefresh1.status).toBe(401);

    // Subsequent refresh on /api/v1/auth/refresh should fail with 401
    const failRefresh2 = await agent
      .post('/api/v1/auth/refresh')
      .send({});
    expect(failRefresh2.status).toBe(401);
  });
});
