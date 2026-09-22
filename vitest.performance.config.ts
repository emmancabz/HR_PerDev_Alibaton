import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: { alias: { '@': fileURLToPath(new URL('./resources/js', import.meta.url)) } },
  test: { environment: 'jsdom', include: ['resources/js/Components/Performance/__tests__/*.test.tsx'] },
});
