#!/usr/bin/env node
/**
 * Test script to verify logger imports work correctly
 * This script attempts to import all modules that use the logger
 */

import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Testing logger imports...\n');

const testModules = [
  { name: 'logger', path: '../src/utils/logger.js' },
  { name: 'LinkDBService', path: '../src/services/LinkDBService.js' },
  { name: 'AuthStorageService', path: '../src/services/AuthStorageService.js' },
  { name: 'MenuStorageService', path: '../src/services/MenuStorageService.js' },
  { name: 'menuConfigRoutes', path: '../src/api/menuConfigRoutes.js' },
  { name: 'authDataRoutes', path: '../src/api/authDataRoutes.js' }
];

let allPassed = true;

for (const module of testModules) {
  try {
    console.log(`✓ Testing ${module.name}...`);
    const imported = await import(module.path);
    console.log(`  ✓ ${module.name} imported successfully`);

    // Test logger if it's the logger module
    if (module.name === 'logger') {
      const logger = imported.default;
      logger.info('Test info message');
      logger.warn('Test warning message');
      logger.error('Test error message');
      logger.debug('Test debug message (should not appear without DEBUG env var)');
      logger.info({ testKey: 'testValue' }, 'Test structured logging');
      console.log('  ✓ Logger methods work correctly');
    }

    console.log('');
  } catch (error) {
    console.error(`  ✗ ${module.name} import failed: ${error.message}`);
    console.error(`    Stack: ${error.stack}\n`);
    allPassed = false;
  }
}

if (allPassed) {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║      ALL LOGGER IMPORTS WORKING ✓                    ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');
  process.exit(0);
} else {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║      SOME IMPORTS FAILED ✗                           ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');
  process.exit(1);
}
