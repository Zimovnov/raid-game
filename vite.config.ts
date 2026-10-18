import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  build: {
    outDir: 'dist-web',
    emptyOutDir: true,
    rollupOptions: { input: 'web/index.html' },
  },
  server: { host: '127.0.0.1', port: 5173, proxy: { '/api': 'http://127.0.0.1:8081', '/ws': { target: 'ws://127.0.0.1:8081', ws: true } } },
});
