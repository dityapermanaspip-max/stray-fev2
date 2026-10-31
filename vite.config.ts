import { defineConfig, loadEnv } from 'vite';

// The production build only takes index.html, so admin.html never ships.
// In dev, /admin-api goes to the local admin lab server (stray-bev1: npm run admin).
// The proxy adds ADMIN_TOKEN from stray-bev1/.env, so the token never reaches the page.
// It only does so for requests marked by the lab page (a custom header needs a same-origin page).
export default defineConfig(({ mode }) => {
  const token = loadEnv(mode, '../stray-bev1', 'ADMIN_').ADMIN_TOKEN ?? '';
  return {
    server: {
      // The client imports message types from stray-bev1/shared (the backend owns them).
      fs: { allow: ['.', '../stray-bev1/shared'] },
      proxy: {
        '/admin-api': {
          target: 'http://127.0.0.1:8787',
          configure: (proxy) => {
            proxy.on('proxyReq', (req, incoming) => {
              if (token && incoming.headers['x-admin-lab'] === '1' && !incoming.headers['x-admin-token']) {
                req.setHeader('x-admin-token', token);
              }
            });
          },
        },
      },
    },
  };
});
