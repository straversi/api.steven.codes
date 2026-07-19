import 'dotenv/config';
import { createApp } from './app.js';
import { createFactRepository } from './db.js';

const {
  DATABASE_URL,
  HOST = '0.0.0.0',
  PORT = 3000
} = process.env;

const factRepository = createFactRepository(DATABASE_URL);
await factRepository.initialize();

const app = createApp({ factRepository });
const server = app.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
});

async function shutDown() {
  server.close(async () => {
    await factRepository.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutDown);
process.on('SIGTERM', shutDown);
