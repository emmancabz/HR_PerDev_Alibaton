import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./resources/js', import.meta.url)) } },
  test: {
    environment: 'jsdom', globals: true, setupFiles: ['./resources/js/test/trainingSetup.ts'],
    include: ['resources/js/data/__tests__/succession.domain.test.ts', 'resources/js/test/__tests__/succession.admin.test.tsx'], css: false,
  },
});
