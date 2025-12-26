import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      crypto: 'crypto-browserify',
      stream: 'stream-browserify',
      buffer: 'buffer',
      '@sharedrop/config': path.resolve(__dirname, '../../packages/config'),
      '@sharedrop/typescript-config': path.resolve(__dirname, '../../tools/typescript-config'),
    },
  },
  build: {
    rollupOptions: {
      external: [],
    },
    commonjsOptions: {
      include: [/packages\/config/, /node_modules/],
    },
  },
});
