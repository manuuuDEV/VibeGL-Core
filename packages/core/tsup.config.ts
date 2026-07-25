import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs', 'iife'],
  dts: {
    resolve: false,
    entry: 'src/index.ts',
  },
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: true,
  target: 'es2022',
  outDir: 'dist',
  platform: 'browser',
  globalName: 'VibeGL',
  external: ['react', 'react-dom', 'three', '@react-three/fiber', '@react-three/drei', '@vibe-gl/math-utils'],
  esbuildOptions(options) {
    options.banner = {
      js: '/*! vibe-gl-core v0.1.0 | MIT License | github.com/manuuuDEV/VibeGL-Core */',
    };
    options.footer = {
      js: 'if (typeof globalThis !== "undefined") globalThis.VibeGL = VibeGL;',
    };
  },
  onSuccess: async () => {
    console.log('vibe-gl-core: Build complete! Output formats: ESM, CJS, IIFE (UMD)');
  },
});