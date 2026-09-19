import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/semantics/**/*.test.ts', 'tests/unit/**/*.test.ts'],
    // Booting CPython in Pyodide is not fast.
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
})
