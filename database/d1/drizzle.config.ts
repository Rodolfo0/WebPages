import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  // Drizzle resolves these paths from the repository root, where pnpm runs.
  out: './database/d1/migrations',
  schema: './database/d1/schema.ts',
  dialect: 'sqlite',
});
