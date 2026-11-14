import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2020' },
  server: { proxy: { '/api': { target: 'http://127.0.0.1:8787', ws: true } } },
});
