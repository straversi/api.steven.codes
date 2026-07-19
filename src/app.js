import express from 'express';
import { fileURLToPath } from 'node:url';

import currentlyPlayingRouter from './routes/currently-playing.js';
import currentlyReadingRouter from './routes/currently-reading.js';
import { createCityFactsRouter } from './routes/city-facts.js';

const CITY_FACTS_PUBLIC_PATH = fileURLToPath(
  new URL('../public/city-facts', import.meta.url)
);

const ALLOWED_ORIGIN_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', 'steven.codes']);

function isAllowedOrigin(origin) {
  if (!origin) {
    return false;
  }

  try {
    return ALLOWED_ORIGIN_HOSTNAMES.has(new URL(origin).hostname);
  } catch {
    return false;
  }
}

export function createApp(options = {}) {
  const app = express();

  app.use((request, response, next) => {
    const origin = request.get('Origin');

    if (isAllowedOrigin(origin)) {
      response.set({
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': request.get('Access-Control-Request-Headers') ?? 'Content-Type',
        Vary: 'Origin'
      });
    }

    if (request.method === 'OPTIONS') {
      response.sendStatus(204);
      return;
    }

    next();
  });

  app.get('/healthz', (_request, response) => {
    response.json({ ok: true });
  });

  app.use('/currently-playing', currentlyPlayingRouter);
  app.use('/currently-reading', currentlyReadingRouter);
  app.use('/city-facts/api', createCityFactsRouter(options));
  app.get('/city-facts', (_request, response) => {
    response.sendFile(`${CITY_FACTS_PUBLIC_PATH}/index.html`);
  });
  app.use('/city-facts', express.static(CITY_FACTS_PUBLIC_PATH));

  app.use((error, _request, response, _next) => {
    const statusCode = error.statusCode ?? (error.type === 'entity.parse.failed' ? 400 : 500);
    const payload = {
      error: statusCode === 500 ? 'Internal server error' : error.message
    };

    if (error.fields) {
      payload.fields = error.fields;
    }

    response.status(statusCode).json(payload);
  });

  return app;
}
