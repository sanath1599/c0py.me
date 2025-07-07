import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // Whether to polyfill `global`
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      // Whether to polyfill specific globals
      protocolImports: true,
    }),
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
    include: ['crypto-browserify'],
  },
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      crypto: 'crypto-browserify',
      stream: 'stream-browserify',
      buffer: 'buffer',
    },
  },
  build: {
    rollupOptions: {
      external: [],
    },
  },
  server: {
    host: '0.0.0.0',
  },
});
