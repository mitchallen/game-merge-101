import { defineConfig } from 'vite';

// Relative base so the production build works when served from any sub-path.
export default defineConfig({
  base: './',
  server: {
    open: true,
  },
});
