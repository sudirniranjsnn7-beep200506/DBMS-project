// ==============================================================================
// Autocannon Benchmark Script: GET /api/assets?limit=20
// ==============================================================================

process.env.NODE_ENV = 'test';

import autocannon from 'autocannon';
import request from 'supertest';
import app from './app';
import { startServer } from './server';

async function runBenchmark() {
  const port = 5055;
  const server = await startServer(port);

  // 1. Authenticate to get valid Bearer token
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: process.env.BENCHMARK_EMAIL || 'techcorp.admin@techcorp.io', password: process.env.BENCHMARK_PASSWORD || 'Password123!' });

  if (loginRes.status !== 200) {
    console.error('Login failed for benchmark:', loginRes.body);
    server.close();
    process.exit(1);
  }

  const token = loginRes.body.data.accessToken;

  console.log(`\nStarting autocannon benchmark against http://localhost:${port}/api/assets?limit=20...`);
  console.log(`Connections: 10, Duration: 5s\n`);

  const instance = autocannon(
    {
      url: `http://localhost:${port}/api/assets?limit=20`,
      connections: 10,
      duration: 5,
      pipelining: 1,
      headers: {
        authorization: `Bearer ${token}`,
      },
    },
    (err, result) => {
      if (err) {
        console.error('Autocannon error:', err);
      } else {
        console.log('==============================================================================');
        console.log('AUTOCANNON BENCHMARK RESULTS:');
        console.log('==============================================================================');
        console.log(`Requests/sec (Avg):   ${result.requests.average}`);
        console.log(`Requests/sec (Max):   ${result.requests.max}`);
        console.log(`Total Requests:       ${result.requests.total}`);
        console.log(`Latency (Avg):        ${result.latency.average} ms`);
        console.log(`Latency (p50):        ${result.latency.p50} ms`);
        console.log(`Latency (p90):        ${result.latency.p90} ms`);
        console.log(`Latency (p99):        ${result.latency.p99} ms`);
        console.log(`Throughput (Avg):     ${(result.throughput.average / 1024 / 1024).toFixed(2)} MB/s`);
        console.log(`2xx Responses:        ${result['2xx']}`);
        console.log(`Non-2xx Responses:    ${result.non2xx}`);
        console.log('==============================================================================');
      }

      server.close(() => {
        process.exit(0);
      });
    }
  );

  autocannon.track(instance, { renderProgressBar: false });
}

runBenchmark().catch((err) => {
  console.error(err);
  process.exit(1);
});
