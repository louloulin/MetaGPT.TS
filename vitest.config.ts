import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 90000,
    hookTimeout: 90000,
    teardownTimeout: 90000,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'coverage/**',
        '**/*.d.ts',
        'tests/**'
      ]
    },
    mockReset: true,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true
      }
    },
    retry: 2,
    logHeapUsage: true,
  },
}); 