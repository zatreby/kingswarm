import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: { outDir: 'dist', target: 'es2022', chunkSizeWarningLimit: 900 },
  server: { port: 5173, strictPort: true },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
