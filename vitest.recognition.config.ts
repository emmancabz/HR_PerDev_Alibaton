import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
    resolve: { alias: { '@': path.resolve(__dirname, 'resources/js') } },
    test: {
        environment: 'jsdom',
        setupFiles: ['resources/js/test/recognitionSetup.ts'],
        include: [
            'resources/js/data/__tests__/recognition.domain.test.ts',
            'resources/js/test/__tests__/recognition.admin.test.tsx',
        ],
    },
});
