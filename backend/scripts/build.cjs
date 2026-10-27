// Cross-platform build script for AssetVault Backend API
// Resolves typescript compiler across monorepo workspace hoisting and isolated rootDir installations,
// while avoiding Windows cmd.exe unquoted '&' directory path parsing bugs.

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function resolveBinary(pkgName, binSubpath) {
  // 1. Check local backend/node_modules
  const local = path.resolve(__dirname, '..', 'node_modules', pkgName, binSubpath);
  if (fs.existsSync(local)) return local;

  // 2. Check monorepo root node_modules
  const root = path.resolve(__dirname, '..', '..', 'node_modules', pkgName, binSubpath);
  if (fs.existsSync(root)) return root;

  return null;
}

const tscPath = resolveBinary('typescript', 'bin/tsc');
const backendDir = path.resolve(__dirname, '..');

const configToUse = fs.existsSync(path.resolve(backendDir, 'tsconfig.build.json'))
  ? 'tsconfig.build.json'
  : 'tsconfig.json';

console.log(`[Backend Build] Compiling TypeScript with ${configToUse}...`);

const result = tscPath
  ? spawnSync(process.execPath, [tscPath, '-p', configToUse], { cwd: backendDir, stdio: 'inherit' })
  : spawnSync('tsc', ['-p', configToUse], { cwd: backendDir, stdio: 'inherit', shell: true });

if (result.status !== 0) {
  process.exit(result.status || 1);
}

console.log('[Backend Build] Compilation completed successfully.');
process.exit(0);
