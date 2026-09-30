import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: { outDir: 'dist', target: 'es2022', chunkSizeWarningLimit: 900 },
  server: { port: 5173, strictPort: true },
  // maxWorkers is capped because this machine has 7 GB RAM and several agents test at once.
  test: { include: ['src/**/*.test.ts'], environment: 'node', maxWorkers: 3 },
});
