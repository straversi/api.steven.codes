import 'dotenv/config';
import express from 'express';
import currentlyPlayingRouter from './routes/currently-playing.js';
import currentlyReadingRouter from './routes/currently-reading.js';

const app = express();

const {
  HOST = '0.0.0.0',
  PORT = 3000
} = process.env;

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

app.use((error, _request, response, _next) => {
  const statusCode = error.statusCode ?? 500;

  response.status(statusCode).json({
    error: error.message
  });
});

app.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
});
