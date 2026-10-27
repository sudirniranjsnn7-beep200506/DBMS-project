// ==============================================================================
// Profiling Script: GET /api/assets?limit=20
// Captures all Prisma queries, set_config calls, and round trips per request
// ==============================================================================

import request from 'supertest';
import app from './app';
import { prisma } from './config/prisma';

interface CapturedQuery {
  query: string;
  params: string;
  duration: number;
}

async function runProfile() {
  const capturedQueries: CapturedQuery[] = [];
  let isCapturing = false;

  (prisma as any).$on('query', (e: any) => {
    if (isCapturing) {
      capturedQueries.push({
        query: e.query,
        params: e.params,
        duration: e.duration,
      });
    }
  });

  // 1. Authenticate to obtain token (do not capture login queries)
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: process.env.PROFILE_EMAIL || 'techcorp.admin@techcorp.io', password: process.env.PROFILE_PASSWORD || 'Password123!' });

  if (loginRes.status !== 200) {
    console.error('Login failed:', loginRes.body);
    process.exit(1);
  }

  const token = loginRes.body.data.accessToken;

  // Warmup run
  await request(app)
    .get('/api/assets?limit=20')
    .set('Authorization', `Bearer ${token}`);

  // 2. Profile GET /api/assets?limit=20
  capturedQueries.length = 0;
  isCapturing = true;
  const startTime = Date.now();

  const res = await request(app)
    .get('/api/assets?limit=20')
    .set('Authorization', `Bearer ${token}`);

  const totalTime = Date.now() - startTime;
  isCapturing = false;

  console.log('==============================================================================');
  console.log(`PROFILING RESULTS: GET /api/assets?limit=20 (Status: ${res.status})`);
  console.log(`Total Request Wall Time: ${totalTime}ms`);
  console.log(`Total Database Queries Executed: ${capturedQueries.length}`);
  console.log('==============================================================================\n');

  let setConfigCount = 0;
  let totalDbDuration = 0;

  capturedQueries.forEach((q, idx) => {
    const isSetConfig = q.query.includes('set_config');
    if (isSetConfig) setConfigCount++;
    totalDbDuration += q.duration;

    console.log(`[Query #${idx + 1}] (${q.duration}ms)`);
    console.log(`  SQL:    ${q.query}`);
    if (q.params && q.params !== '[]') {
      console.log(`  Params: ${q.params}`);
    }
    console.log('');
  });

  console.log('------------------------------------------------------------------------------');
  console.log(`SUMMARY:`);
  console.log(`  - Total Queries:            ${capturedQueries.length}`);
  console.log(`  - set_config Queries:       ${setConfigCount}`);
  console.log(`  - Application Queries:      ${capturedQueries.length - setConfigCount}`);
  console.log(`  - Cumulative DB Time:       ${totalDbDuration}ms`);
  console.log('------------------------------------------------------------------------------');

  process.exit(0);
}

runProfile().catch((err) => {
  console.error(err);
  process.exit(1);
});
