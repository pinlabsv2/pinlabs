import path from 'path';
import { defineConfig, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';

function devApi(): Plugin {
  return {
    name: 'dev-api',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/api', async (req, res) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const name = url.pathname.replace(/^\//, '').split('/')[0];
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        const rawBody = Buffer.concat(chunks);
        let body: unknown = {};
        try { body = rawBody.length ? JSON.parse(rawBody.toString('utf8')) : {}; } catch { body = {}; }
        const { handle } = await server.ssrLoadModule('/server/handler.ts');
        const requestId = Array.isArray(req.headers['x-request-id']) ? req.headers['x-request-id'][0] : req.headers['x-request-id'];
        const result = await handle({
          name,
          method: req.method ?? 'GET',
          body,
          rawBody,
          headers: req.headers,
          cookie: req.headers.cookie,
          query: Object.fromEntries(url.searchParams),
          requestId,
          ip: req.socket.remoteAddress,
        });
        res.statusCode = result.status;
        for (const [key, value] of Object.entries(result.headers)) res.setHeader(key, value as string | string[]);
        res.end(result.body);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devApi()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  ssr: { external: ['@electric-sql/pglite', 'pg'] },
  server: { port: 3000 },
});
