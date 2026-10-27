import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    env: {
      // Connect as non-bypass application role by default to verify strict RLS enforcement
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ||
        process.env.APP_DATABASE_URL ||
        process.env.DATABASE_URL ||
        'postgresql://assetvault_app:app_password@localhost:5432/assetvault_db?schema=public',
      // Provide deterministic secrets so env validation (backend/src/config/env.ts) passes under test
      NODE_ENV: process.env.NODE_ENV || 'test',
      JWT_ACCESS_SECRET:
        process.env.JWT_ACCESS_SECRET || 'test_jwt_access_secret_at_least_32_chars_long',
      JWT_REFRESH_SECRET:
        process.env.JWT_REFRESH_SECRET || 'test_jwt_refresh_secret_at_least_32_chars_long',
      COOKIE_SECRET:
        process.env.COOKIE_SECRET || 'test_cookie_secret_at_least_32_chars_long',
    },
    include: [
      'backend/src/__tests__/**/*.test.ts',
      'src/__tests__/**/*.test.ts',
      'frontend/src/__tests__/**/*.test.ts',
    ],
    fileParallelism: false, // Run integration tests sequentially to avoid DB race conditions
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['backend/src/services/**/*.ts', 'src/services/**/*.ts'],
    },
  },
});
