import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from '@playwright/test';
import { loadEnv } from 'vite';

const root = process.cwd();
const testEnvPath = resolve(root, '.env.test.local');

if (!existsSync(testEnvPath)) {
  throw new Error(
    'Missing .env.test.local. Copy .env.test.example and configure a dedicated test Supabase project.',
  );
}

const testEnvFile = readFileSync(testEnvPath, 'utf8');
const requiredProjectKeys = ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY'];
const missingProjectKeys = requiredProjectKeys.filter(
  (key) => !new RegExp(`^\\s*${key}\\s*=`, 'm').test(testEnvFile),
);

if (missingProjectKeys.length > 0) {
  throw new Error(
    `.env.test.local must define: ${missingProjectKeys.join(', ')}.`,
  );
}

const testEnv = loadEnv('test', root, '');
for (const key of [...requiredProjectKeys, 'SUPABASE_E2E_EMAIL', 'SUPABASE_E2E_PASSWORD']) {
  if (!process.env[key] && testEnv[key]) process.env[key] = testEnv[key];
}

for (const key of requiredProjectKeys) {
  if (!process.env[key]) {
    throw new Error(`Set ${key} in .env.test.local before running browser tests.`);
  }
}

const baseURL = 'http://127.0.0.1:5180';
const inheritedEnvironment = Object.fromEntries(
  Object.entries(process.env).filter((entry) => entry[1] !== undefined),
) as Record<string, string>;

export default defineConfig({
  testDir: './resources',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'integration',
      testMatch: '**/*.integration.spec.ts',
    },
    {
      name: 'e2e',
      testMatch: '**/*.e2e.spec.ts',
    },
  ],
  webServer: {
    command: 'pnpm dev --mode test --host 127.0.0.1 --port 5180 --strictPort',
    // Vinext locks by project root; allow this isolated test server beside dev.
    env: { ...inheritedEnvironment, VINEXT_NO_DEV_LOCK: '1' },
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
