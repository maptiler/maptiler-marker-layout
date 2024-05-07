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
      // Could also be a dictionary or array of multiple entry points
      entry: resolve(__dirname, 'src/maptiler-popup-manager.ts'),
      name: 'maptilerpopupmanager',
      // the proper extensions will be added
      fileName: (format, entryName) => `${entryName}.js`,
      formats: ['es'],
    },
    
    rollupOptions: {
      // make sure to externalize deps that shouldn't be bundled
      // into your library
      external: [
        "@maptiler/sdk",
      ],
      output: {
        // Provide global variables to use in the UMD build
        // for externalized deps
        globals: {},
      },
    },
  },
  plugins,
})