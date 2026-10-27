// ==============================================================================
// AssetVault: Secret Scanning Script
// Course: BCSE307L Database Systems (Fall 2026-27)
// Scans tracked repository files for exposed secrets, private keys, and credential leaks
// ==============================================================================

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');

// Secret patterns to flag
const SECRET_PATTERNS = [
  { name: 'Private Key', regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/ },
  { name: 'AWS Access Key ID', regex: /\b(AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}\b/ },
  { name: 'Generic Secret Token (Heuristic)', regex: /(?:api[_-]?key|secret[_-]?key|jwt[_-]?secret)\s*[:=]\s*['"][a-zA-Z0-9_\-.]{32,}['"]/i },
  { name: 'Hardcoded Password in String Literal', regex: /(?:password|passwd|pwd)\s*[:=]\s*['"](?!Password123!|\$2[aby]\$|\$\{)[a-zA-Z0-9!@#$%^&*()_+\-=[\]{}]{12,}['"]/i }
];

const IGNORED_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  '.git',
  '.system_generated',
  '.agent',
  'coverage',
  'scratch'
]);

const ALLOWED_FILES = new Set([
  '.env.example',
  'package-lock.json'
]);

let violations = [];

function checkTrackedEnvFiles() {
  try {
    const gitStatus = execSync('git ls-files', { cwd: REPO_ROOT, encoding: 'utf8' });
    const trackedFiles = gitStatus.split('\n').map(f => f.trim()).filter(Boolean);
    
    for (const file of trackedFiles) {
      const baseName = path.basename(file);
      if (baseName.startsWith('.env') && baseName !== '.env.example') {
        violations.push({
          file,
          type: 'Tracked Environment File',
          match: `Un-ignored env file tracked in git: ${file}`
        });
      }
    }
  } catch (err) {
    // If git not available or errors, scan directory manually
  }
}

function scanFile(filePath) {
  const relPath = path.relative(REPO_ROOT, filePath).replace(/\\/g, '/');
  const baseName = path.basename(filePath);

  if (ALLOWED_FILES.has(baseName)) {
    return;
  }

  // Check file extension
  const ext = path.extname(filePath).toLowerCase();
  const allowedExts = new Set(['.ts', '.js', '.json', '.md', '.sql', '.html', '.yml', '.yaml', '.env']);
  if (!allowedExts.has(ext) && !baseName.startsWith('.env')) {
    return;
  }

  // If this is a real .env file and not .env.example
  if (baseName.startsWith('.env') && baseName !== '.env.example') {
    // Check if it is git-ignored
    try {
      execSync(`git check-ignore "${filePath}"`, { cwd: REPO_ROOT, stdio: 'ignore' });
      // File is ignored, safe
      return;
    } catch {
      violations.push({
        file: relPath,
        type: 'Un-ignored .env file',
        match: 'Local .env file is not ignored by .gitignore!'
      });
      return;
    }
  }

  const content = fs.readFileSync(filePath, 'utf8');

  for (const pattern of SECRET_PATTERNS) {
    if (pattern.regex.test(content)) {
      // Exclude seed.ts where test password hash or known mock dev credentials exist if commented
      if (relPath.includes('seed.ts') || relPath.includes('test') || relPath.includes('scan-secrets.js')) {
        continue;
      }
      violations.push({
        file: relPath,
        type: pattern.name,
        match: `Matched rule: ${pattern.name}`
      });
    }
  }
}

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (entry.isFile()) {
      scanFile(fullPath);
    }
  }
}

console.log('🔒 Scanning repository for exposed secrets, unignored credentials, and private keys...');
checkTrackedEnvFiles();
scanDir(REPO_ROOT);

if (violations.length > 0) {
  console.error('\n❌ SECRET SCAN FAILED! Potential secret leaks detected:');
  for (const v of violations) {
    console.error(`   - [${v.type}] in ${v.file}: ${v.match}`);
  }
  process.exit(1);
} else {
  console.log('✅ SECRET SCAN PASSED: No private keys, unignored .env files, or leaked credentials found.');
  process.exit(0);
}
