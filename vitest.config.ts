import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['resources/**/*.test.{ts,tsx}', 'shared/**/*.test.{ts,tsx}'],
    clearMocks: true,
    setupFiles: ['./vitest.setup.ts'],
  },
});
