import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import config from './config.json';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: config.ports.devServer || 5173,
    strictPort: true,
  },
});
