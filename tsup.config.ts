import { defineConfig } from 'tsup';

export default defineConfig([
  {
    name: 'vibe-gl-core',
    entry: ['packages/core/src/index.ts'],
    format: ['esm', 'cjs'],
    dts: {
      resolve: true,
      entry: 'packages/core/src/index.ts',
    },
    splitting: false,
    sourcemap: true,
    clean: true,
    minify: true,
    target: 'es2022',
    outDir: 'dist/core',
    platform: 'browser',
    external: ['@vibe-gl/math-utils', 'three', '@react-three/fiber', 'react', 'react-dom'],
    esbuildOptions(options) {
      options.banner = {
        js: '/*! VibeGL-Core v0.1.0 | MIT License | github.com/manuuuDEV/VibeGL-Core */',
      };
      options.globalName = 'VibeGL';
    },
    onSuccess: async () => {
      console.log('✅ VibeGL Core built: ESM, CJS, IIFE (UMD)');
    },
  },
  {
    name: 'vibe-gl-math-utils',
    entry: ['packages/math-utils/src/index.ts'],
    format: ['esm', 'cjs', 'iife'],
    dts: {
      resolve: true,
      entry: 'packages/math-utils/src/index.ts',
    },
    splitting: false,
    sourcemap: true,
    clean: true,
    minify: true,
    target: 'es2022',
    outDir: 'dist/math-utils',
    platform: 'browser',
    globalName: 'VibeGLMath',
    esbuildOptions(options) {
      options.banner = {
        js: '/*! VibeGL-Math-Utils v0.1.0 | MIT License | github.com/manuuuDEV/VibeGL-Core */',
      };
      options.globalName = 'VibeGLMath';
    },
        external: ['three', 'react'],
        onSuccess: async () => {
      console.log('✅ VibeGL Math Utils built: ESM, CJS, IIFE (UMD)');
    },
  },
]);