import { resolve } from 'path';
import { defineConfig } from 'vite';

const isProduction = process.env.NODE_ENV === "production";

const plugins = [];

export default defineConfig({
  mode: isProduction ? "production" : "development",
  build: {
    outDir: "build",
    minify: isProduction,
    sourcemap: !isProduction,
    lib: {
      entry: resolve(__dirname, "src/markerlayout.ts"),
      name: "maptilermarkerlayout",
      fileName: () => "maptiler-marker-layout.umd.min.js",
      formats: ["umd"],
    },
    rollupOptions: {
      external: [
        "@maptiler/sdk",
      ],
      output: {
        globals: {
          "@maptiler/sdk": "maptilersdk",
        },
      },
    },
  },
  plugins,
})