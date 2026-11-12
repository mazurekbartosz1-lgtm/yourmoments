import express from 'express';
import path from 'path';
import fs from 'fs';
import { app } from './api/index';
import {
  DAILY_PROMPTS,
  getPromptSlug,
  getPromptBySlug,
  getPromptSeoDetails,
} from './src/data/prompts';

const ROOT_DIR = process.cwd();
const PORT = Number(process.env.PORT) || 3000;

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function injectProgrammaticPromptSeo(rawHtml: string, reqPath: string): string {
  const baseUrl = 'https://www.dailymoments.app';
  if (reqPath === '/prompts' || reqPath === '/prompts/') {
    const title = 'Biblioteka pytań do dziennika i codziennej refleksji (47 Prompts) | Momenty';
    const desc =
      'Odkryj 47 pytań do codziennej refleksji, wdzięczności, uważności i radzenia sobie z wypaleniem (Overcoming Burnout, Evening Gratitude). Zacznij pisać od razu na stronie bez logowania.';
    const canonicalUrl = `${baseUrl}/prompts`;

    const listItemsHtml = DAILY_PROMPTS.map(p => {
      const s = getPromptSlug(p);
      return `<li><a href="/prompts/${escapeHtml(s)}">${escapeHtml(p.promptPl)} — ${escapeHtml(
        p.promptEn
      )}</a></li>`;
    }).join('\n');

    const prerenderedRoot = `<div id="root"><main class="seo-prerender-fallback max-w-5xl mx-auto px-6 py-14 font-serif"><header class="mb-8"><a href="/">← Momenty / Moments</a></header><h1>${escapeHtml(
      title
    )}</h1><p>${escapeHtml(desc)}</p><ul>${listItemsHtml}</ul></main></div>`;

    return rawHtml
      .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`)
      .replace(
        /<meta name="description" content="[^"]*"\s*\/?>/i,
        `<meta name="description" content="${escapeHtml(desc)}" />`
      )
      .replace(
        /<link rel="canonical" href="[^"]*"\s*\/?>/i,
        `<link rel="canonical" href="${canonicalUrl}" />`
      )
      .replace(
        /<meta property="og:title" content="[^"]*"\s*\/?>/i,
        `<meta property="og:title" content="${escapeHtml(title)}" />`
      )
      .replace(
        /<meta property="og:description" content="[^"]*"\s*\/?>/i,
        `<meta property="og:description" content="${escapeHtml(desc)}" />`
      )
      .replace(
        /<meta property="og:url" content="[^"]*"\s*\/?>/i,
        `<meta property="og:url" content="${canonicalUrl}" />`
      )
      .replace(/<div id="root">[\s\S]*?<\/div>\s*(?=<script)/i, `${prerenderedRoot}\n    `);
  }

  if (reqPath.startsWith('/prompts/')) {
    const slug = decodeURIComponent(reqPath.slice('/prompts/'.length).replace(/\/+$/, ''));
    const matched = getPromptBySlug(slug);
    if (matched) {
      const seoPl = getPromptSeoDetails(matched, 'pl');
      const title = `${matched.promptPl} (${matched.promptEn}) | Momenty`;
      const desc = `${matched.hintPl} ${matched.hintEn}`;
      const canonicalUrl = `${baseUrl}/prompts/${seoPl.slug}`;

      const followUpsHtml = seoPl.followUpQuestions
        .map(q => `<li>${escapeHtml(q)}</li>`)
        .join('');

      const prerenderedRoot = `<div id="root"><article class="seo-prerender-fallback max-w-4xl mx-auto px-6 py-14 font-serif"><nav><a href="/">Momenty</a> · <a href="/prompts">Prompts</a> · <span>${escapeHtml(
        seoPl.categoryLabel
      )}</span></nav><h1>${escapeHtml(matched.promptPl)}</h1><h2>${escapeHtml(
        matched.promptEn
      )}</h2><p>${escapeHtml(matched.hintPl)}</p><p>${escapeHtml(
        seoPl.reflectionGuide
      )}</p><h3>Pytania pomocnicze na marginesie:</h3><ul>${followUpsHtml}</ul></article></div>`;

      return rawHtml
        .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`)
        .replace(
          /<meta name="description" content="[^"]*"\s*\/?>/i,
          `<meta name="description" content="${escapeHtml(desc)}" />`
        )
        .replace(
          /<link rel="canonical" href="[^"]*"\s*\/?>/i,
          `<link rel="canonical" href="${canonicalUrl}" />`
        )
        .replace(
          /<meta property="og:title" content="[^"]*"\s*\/?>/i,
          `<meta property="og:title" content="${escapeHtml(title)}" />`
        )
        .replace(
          /<meta property="og:description" content="[^"]*"\s*\/?>/i,
          `<meta property="og:description" content="${escapeHtml(desc)}" />`
        )
        .replace(
          /<meta property="og:url" content="[^"]*"\s*\/?>/i,
          `<meta property="og:url" content="${canonicalUrl}" />`
        )
        .replace(/<div id="root">[\s\S]*?<\/div>\s*(?=<script)/i, `${prerenderedRoot}\n    `);
    }
  }

  return rawHtml;
}

app.get(['/prompts', '/prompts/:slug'], (req, res, next) => {
  const distHtmlPath = path.resolve(ROOT_DIR, 'dist', 'index.html');
  const rootHtmlPath = path.resolve(ROOT_DIR, 'index.html');
  const targetPath = fs.existsSync(distHtmlPath) ? distHtmlPath : rootHtmlPath;

  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    try {
      const rawHtml = fs.readFileSync(targetPath, 'utf-8');
      const injected = injectProgrammaticPromptSeo(rawHtml, req.path);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(injected);
    } catch {
      return next();
    }
  }
  return next();
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vitePkg = 'vite';
    const { createServer: createViteServer } = await import(vitePkg);
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    app.get(['/prompts', '/prompts/:slug'], async (req, res, next) => {
      try {
        const rawHtml = fs.readFileSync(path.resolve(ROOT_DIR, 'index.html'), 'utf-8');
        const transformed = await vite.transformIndexHtml(req.originalUrl, rawHtml);
        const injected = injectProgrammaticPromptSeo(transformed, req.path);
        res.status(200).set({ 'Content-Type': 'text/html; charset=utf-8' }).end(injected);
      } catch (e) {
        next(e);
      }
    });

    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(ROOT_DIR, 'dist')));
    app.get('*', (req, res) => {
      const distHtmlPath = path.resolve(ROOT_DIR, 'dist', 'index.html');
      try {
        const rawHtml = fs.readFileSync(distHtmlPath, 'utf-8');
        const injected = injectProgrammaticPromptSeo(rawHtml, req.path);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(injected);
      } catch {
        return res.sendFile(distHtmlPath);
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

export { app };
export default app;
