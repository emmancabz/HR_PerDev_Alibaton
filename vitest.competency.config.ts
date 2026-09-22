import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./resources/js", import.meta.url)),
        },
    },
    test: {
        environment: "jsdom",
        include: [
            "resources/js/data/__tests__/competency.behavior.test.ts",
            "resources/js/Components/Competency/__tests__/competency.ui.test.tsx",
            "resources/js/Components/Competency/__tests__/competency.modal.test.tsx",
            "resources/js/data/__tests__/competency.server.test.tsx",
        ],
        setupFiles: ["./resources/js/test/competencySetup.ts"],
        clearMocks: true,
        restoreMocks: true,
    },
});
