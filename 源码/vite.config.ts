import { defineConfig } from 'vite';
export default defineConfig({
  // Keep CSS readable and avoid an unnecessary native minifier dependency.
  build: { cssMinify: false },
  server: { proxy: { '/api': { target: 'http://127.0.0.1:3001', changeOrigin: true } } },
  preview: { proxy: { '/api': { target: 'http://127.0.0.1:3001', changeOrigin: true } } },
});
