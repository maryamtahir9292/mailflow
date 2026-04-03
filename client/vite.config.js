import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5176,
    host: true,          // bind to 0.0.0.0 so it's reachable on the local network
    proxy: {
      '/api':  { target: 'http://localhost:3002', changeOrigin: true, secure: false },
      '/auth': { target: 'http://localhost:3002', changeOrigin: true, secure: false },
    },
  },
});
