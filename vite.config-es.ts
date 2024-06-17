import { resolve } from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

const isProduction = process.env.NODE_ENV === "production";

const plugins = [
  dts({insertTypesEntry: true}),
];


export default defineConfig({
  mode: isProduction ? "production" : "development",
  build: {
    minify: isProduction,
    sourcemap: !isProduction,
    lib: {
      entry: resolve(__dirname, 'src/markerlayout.ts'),
      name: 'maptilermarkerlayout',
      fileName: (format, entryName) => "maptiler-marker-layout.mjs",
      formats: ['es'],
    },
    
    rollupOptions: {
      external: [
        "@maptiler/sdk",
      ],
      output: {
        globals: {},
      },
    },
  },
  plugins,
})