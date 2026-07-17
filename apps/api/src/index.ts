import type { Server } from 'http';

import { app } from './app';
import { APP_NAME, SHUTDOWN_GRACE_PERIOD_MS } from './config/constants';
import { closeDatabase } from './config/database';
import { env } from './config/env';
import { closeHairStudioQueue } from './services/design/hairStudioQueue';
import { logger } from './utils/logger';

const server: Server = app.listen(env.PORT, env.HOST, (): void => {
  logger.info(`${APP_NAME} started`, {
    host: env.HOST,
    port: env.PORT,
    nodeEnv: env.NODE_ENV,
  });
});

server.on('error', (error: NodeJS.ErrnoException): void => {
  if (error.code === 'EADDRINUSE') {
    logger.error(`Port ${env.PORT} is already in use`, error, {
      port: env.PORT,
      host: env.HOST,
      action: 'Stop the existing API process or change PORT in .env.',
    });
    process.exit(1);
  }

  logger.error('Server failed to start', error);
  process.exit(1);
});

let isShuttingDown = false;

const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  logger.info('Shutdown signal received', { signal });

  const forceExitTimer = setTimeout((): void => {
    logger.error('Forced shutdown after grace period');
    process.exit(1);
  }, SHUTDOWN_GRACE_PERIOD_MS);

  try {
    await new Promise<void>((resolve, reject): void => {
      server.close((error?: Error): void => {
        if (error !== undefined) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    await closeHairStudioQueue();
    await closeDatabase();
    clearTimeout(forceExitTimer);
    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    clearTimeout(forceExitTimer);
    logger.error('Graceful shutdown failed', error);
    process.exit(1);
  }
};

process.on('SIGTERM', (signal): void => {
  void shutdown(signal);
});

process.on('SIGINT', (signal): void => {
  void shutdown(signal);
});
