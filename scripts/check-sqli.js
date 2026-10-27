// ==============================================================================
// AssetVault: SQL Injection Prevention CI Rule
// Course: BCSE307L Database Systems (Fall 2026-27)
// Scans source code and fails if $queryRawUnsafe or $executeRawUnsafe are detected
// ==============================================================================

const fs = require('fs');
const path = require('path');

const TARGET_DIR = path.resolve(__dirname, '../backend/src');
const FORBIDDEN_PATTERNS = [
  /\$queryRawUnsafe/g,
  /\$executeRawUnsafe/g,
];

let violations = [];

function scanDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      scanDirectory(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const relativePath = path.relative(path.resolve(__dirname, '..'), fullPath);

      for (const pattern of FORBIDDEN_PATTERNS) {
        const matches = content.match(pattern);
        if (matches) {
          violations.push({
            file: relativePath,
            pattern: pattern.toString(),
            count: matches.length,
          });
        }
      }
    }
  }
}

console.log('🔍 Running SQL Injection static analysis over backend/src...');
scanDirectory(TARGET_DIR);

if (violations.length > 0) {
  console.error('❌ SQL INJECTION CHECK FAILED! Forbidden unsafe raw SQL methods found:');
  violations.forEach((v) => {
    console.error(`   - ${v.file}: ${v.count} occurrence(s) of ${v.pattern}`);
  });
  console.error('\nPolicy: Only Prisma typed methods or Prisma.sql tagged templates with bound parameters are permitted.');
  process.exit(1);
} else {
  console.log('✅ SQL INJECTION CHECK PASSED: Zero instances of $queryRawUnsafe or $executeRawUnsafe.');
  process.exit(0);
}
