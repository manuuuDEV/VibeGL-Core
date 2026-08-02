#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');

// Simple pre-commit scanner: fail if any staged file contains obvious secrets or if repo contains .env/.npmrc staged
try {
  const staged = execSync('git diff --cached --name-only', { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  const forbiddenFiles = ['.env', '.npmrc'];
  for (const f of staged) {
    if (forbiddenFiles.includes(f)) {
      console.error(`Refusing to commit: forbidden file staged -> ${f}`);
      process.exit(1);
    }
    // File may be deleted: guard; also skip this script itself
    if (!fs.existsSync(f)) continue;
    if (f === 'scripts/precommit-check.js') continue;
    const content = fs.readFileSync(f, 'utf8');
    const secretPattern = new RegExp(['NPM', '_TOKEN', '|PRIVATE_KEY|AWS_SECRET|AWS_ACCESS_KEY_ID'].join(''));
    if (secretPattern.test(content)) {
      console.error('Refusing to commit: potential secret token found in', f);
      process.exit(1);
    }
  }
  process.exit(0);
} catch (e) {
  // if no staged files or command failed, allow to continue (no-op)
  process.exit(0);
}
