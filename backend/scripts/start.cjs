// Production Startup Runner for AssetVault Backend API
// Handles runtime database migrations with directUrl fallback and boots Express server

const { spawnSync, spawn } = require('child_process');
const path = require('path');

// Guarantee DIRECT_URL exists if DATABASE_URL is available
process.env.DIRECT_URL = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (process.env.DATABASE_URL) {
  console.log('[AssetVault API] Verifying and applying production database migrations...');
  try {
    const migrateRes = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit',
      shell: true,
      env: process.env,
    });
    if (migrateRes.status === 0) {
      console.log('[AssetVault API] Database migrations verified/applied successfully.');
    } else {
      console.warn('[AssetVault API] Notice: prisma migrate deploy completed with code:', migrateRes.status);
    }
  } catch (err) {
    console.warn('[AssetVault API] Notice: migration runner caught:', err.message);
  }
}

console.log('[AssetVault API] Launching Express HTTP server...');
const serverProcess = spawn(process.execPath, [path.resolve(__dirname, '..', 'dist', 'server.js')], {
  cwd: path.resolve(__dirname, '..'),
  stdio: 'inherit',
  env: process.env,
});

serverProcess.on('exit', (code) => {
  process.exit(code || 0);
});

// Forward OS signals for graceful shutdown
['SIGINT', 'SIGTERM'].forEach((sig) => {
  process.on(sig, () => {
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill(sig);
    }
  });
});
