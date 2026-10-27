// ==============================================================================
// AssetVault - Root Full-Stack Dev Server Entry Point
// Mounts Express REST API and Vite Dev Server on port 3000 (0.0.0.0)
// ==============================================================================

import path from 'path';
import express from 'express';

// Override any legacy container VITE_API_URL (e.g. http://localhost:5000/api)
// so Vite always bundles relative '/api' for the unified server
process.env.VITE_API_URL = '/api';

import app from './backend/src/app';
import { prisma } from './backend/src/config/prisma';

const PORT = 3000;
const HOST = '0.0.0.0';

async function bootstrap() {
  try {
    await prisma.$connect();
    console.log('✅ Connected to PostgreSQL database.');
  } catch (e) {
    console.warn('⚠️ PostgreSQL offline or unconfigured. In-memory resilience layer active.');
  }

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    // Mount Vite dev server middleware for SPA rendering
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
      root: path.resolve(process.cwd(), 'frontend'),
    });

    app.use(vite.middlewares);

    // Fallback for SPA HTML routing
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        const fs = await import('fs/promises');
        const templatePath = path.resolve(process.cwd(), 'frontend/index.html');
        let template = await fs.readFile(templatePath, 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    // Production: serve built static frontend bundles
    const frontendDist = path.resolve(process.cwd(), 'frontend/dist');
    app.use(express.static(frontendDist));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(frontendDist, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`🚀 AssetVault application listening on http://${HOST}:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Fatal startup error:', err);
});
