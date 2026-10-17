import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
    assetsInlineLimit: 2048,
    cssCodeSplit: false,
  },
  server: {
    port: 5199,
    strictPort: true,
  },
});
