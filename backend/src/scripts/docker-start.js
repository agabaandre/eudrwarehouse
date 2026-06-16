#!/usr/bin/env node
/**
 * Docker container entrypoint — migrate, seed (best-effort), then start API.
 * Seed errors are non-fatal on redeploy when data already exists.
 */
const { migrate } = require('./migrate');
const { seed } = require('./seed');
const { upsertTrainingModules } = require('./upsert-training');

async function main() {
  console.log('Running database migrations...');
  await migrate();

  console.log('Seeding demonstration data (skipped if already present)...');
  try {
    await seed();
  } catch (err) {
    console.warn('Seed skipped or partial:', err.message);
  }

  console.log('Syncing EUDR training videos...');
  try {
    await upsertTrainingModules();
  } catch (err) {
    console.warn('Training video sync skipped:', err.message);
  }

  console.log('Starting API server...');
  require('../server');
}

main().catch((err) => {
  console.error('Startup failed:', err);
  process.exit(1);
});
