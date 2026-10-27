// Cross-platform test runner for AssetVault Backend API
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function resolveVitest() {
  const local = path.resolve(__dirname, '..', 'node_modules', 'vitest', 'vitest.mjs');
  if (fs.existsSync(local)) return local;
  const root = path.resolve(__dirname, '..', '..', 'node_modules', 'vitest', 'vitest.mjs');
  if (fs.existsSync(root)) return root;
  return null;
}

const vitestPath = resolveVitest();
const backendDir = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const finalArgs = ['run', '--config', 'vitest.config.ts', ...args];

const result = vitestPath
  ? spawnSync(process.execPath, [vitestPath, ...finalArgs], { cwd: backendDir, stdio: 'inherit' })
  : spawnSync('vitest', finalArgs, { cwd: backendDir, stdio: 'inherit', shell: true });

process.exit(result.status || 0);
