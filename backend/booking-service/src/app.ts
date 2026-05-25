import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { config, loadSecrets } from './config';
import { initializeDatabase } from './models/database';
import router from './routes';
import logger from './utils/logger';

const app = express();

app.use(cors({ origin: config.cors.origin }));
app.use(express.json());
app.use(morgan('combined', {
  stream: { write: (msg: string) => logger.http(msg.trim()) },
}));

app.use('/', router);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'booking-service', mode: config.mode });
});

async function bootstrap() {
  await loadSecrets();
  await initializeDatabase();
  app.listen(config.port, () => {
    logger.info('booking-service started', { port: config.port, mode: config.mode });
  });
}

bootstrap().catch(err => {
  logger.error('Failed to start booking-service', { err });
  process.exit(1);
});
