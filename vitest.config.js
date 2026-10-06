import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { quasar, transformAssetUrls } from "@quasar/vite-plugin";
import jsconfigPaths from "vite-jsconfig-paths";
import { fileURLToPath } from "node:url";

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      "virtual:qr-scanner-worker-url":
        fileURLToPath(new URL("./src/js/qrScannerWorker.ts", import.meta.url)) +
        "?url",
      // Match the browser's ESM entry; the package's CJS entry requires cborg,
      // which is ESM-only.
      "@gandlaf21/bc-ur": fileURLToPath(
        new URL(
          "./node_modules/@gandlaf21/bc-ur/dist/lib/es6/index.js",
          import.meta.url
        )
      ),
    },
  },
  build: {
    target: "esnext",
  },
  optimizeDeps: {
    esbuildOptions: {
      target: "esnext",
    },
  },
  test: {
    environment: "happy-dom",
    setupFiles: "test/vitest/setup-file.js",
    include: [
      // Matches vitest tests in any subfolder of 'src' or into 'test/vitest/__tests__'
      // Matches all files with extension 'js', 'jsx', 'ts' and 'tsx'
      "src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}",
      "test/vitest/__tests__/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}",
    ],
  },
  plugins: [
    vue({
      template: { transformAssetUrls },
    }),
    quasar({
      sassVariables: "src/quasar-variables.scss",
    }),
    jsconfigPaths(),
  ],
});
