import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    // The client imports message types from stray-bev1/shared (the backend owns them).
    fs: { allow: ['.', '../stray-bev1/shared'] },
  },
});
