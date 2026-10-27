// ==============================================================================
// AssetVault: Cross-Platform Backup & Restore Dispatcher
// Automatically switches between PowerShell (.ps1) on Windows and Bash (.sh) on POSIX
// ==============================================================================

const { spawn } = require('child_process');
const path = require('path');

const command = process.argv[2]; // 'backup', 'restore', 'verify-restore'
const extraArgs = process.argv.slice(3);

if (!command) {
  console.error('Usage: node scripts/db-backup-runner.js <backup|restore|verify-restore> [args...]');
  process.exit(1);
}

const isWindows = process.platform === 'win32';
const scriptBase = path.join(__dirname, '..', 'database', 'backup');

let executable = '';
let args = [];

if (isWindows) {
  executable = 'powershell';
  const scriptFile = path.join(scriptBase, `${command}.ps1`);
  args = ['-ExecutionPolicy', 'Bypass', '-File', scriptFile, ...extraArgs];
} else {
  executable = path.join(scriptBase, `${command}.sh`);
  args = extraArgs;
}

const child = spawn(executable, args, {
  stdio: 'inherit',
  shell: false,
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
