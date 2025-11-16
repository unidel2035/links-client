#!/usr/bin/env node

/**
 * Custom changeset version script that ensures package-lock.json is synchronized
 * with package.json after version bumps.
 *
 * This script:
 * 1. Runs `changeset version` to update package versions
 * 2. Runs `npm install` to synchronize package-lock.json with the new versions
 */

import { execSync } from 'child_process';

try {
  console.log('Running changeset version...');
  execSync('npx changeset version', { stdio: 'inherit' });

  console.log('\nSynchronizing package-lock.json...');
  execSync('npm install --package-lock-only', { stdio: 'inherit' });

  console.log('\n✅ Version bump complete with synchronized package-lock.json');
} catch (error) {
  console.error('Error during version bump:', error.message);
  if (process.env.DEBUG) {
    console.error('Stack trace:', error.stack);
  }
  process.exit(1);
}
