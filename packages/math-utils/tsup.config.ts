import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'index': 'src/index.ts',
    'worker/index': 'src/worker/workerSetup.ts'
  },
  format: ['esm', 'cjs', 'iife'],
  dts: {
    resolve: true,
    entry: {
      'index': 'src/index.ts',
      'worker/index': 'src/worker/workerSetup.ts'
    }
  },
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: true,
  target: 'es2022',
  outDir: 'dist',
  platform: 'browser',
  globalName: 'VibeGLMathUtils',
  esbuildOptions(options) {
    options.banner = {
      js: '/*! @vibe-gl/math-utils v0.1.0 | MIT License */',
    };
  },
  onSuccess: async () => {
    console.log('@vibe-gl/math-utils: Build complete! Output formats: ESM, CJS, IIFE (UMD)');
  },
});