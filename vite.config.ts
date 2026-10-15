import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';
import { BROWSER_UA, isAllowed } from './src/core/allowlist.ts';

/** Dev-server twin of api/proxy.ts so `npm run dev` can reach the job boards. */
function devProxy(): Plugin {
  return {
    name: 'dev-proxy',
    configureServer(server) {
      server.middlewares.use('/api/proxy', async (req, res) => {
        let raw = '';
        for await (const chunk of req) raw += chunk;
        const { url, method, headers, body } = JSON.parse(raw || '{}');
        if (!isAllowed(url)) {
          res.statusCode = 403;
          return res.end('Host not allowed');
        }
        const up = await fetch(url, { method: method ?? 'GET', headers: { 'User-Agent': BROWSER_UA, ...(headers ?? {}) }, body });
        res.statusCode = up.status;
        res.end(await up.text());
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), devProxy()],
  build: { chunkSizeWarningLimit: 2000 },
});
