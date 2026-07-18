import type { Server } from 'http';

import { app } from './app';
import { APP_NAME, SHUTDOWN_GRACE_PERIOD_MS } from './config/constants';
import { closeDatabase } from './config/database';
import { env } from './config/env';
import { maintainHairStudio } from './services/design/hairStudioService';
import { logger } from './utils/logger';

const server: Server = app.listen(env.PORT, env.HOST, (): void => {
  logger.info(`${APP_NAME} started`, {
    host: env.HOST,
    port: env.PORT,
    nodeEnv: env.NODE_ENV,
  });
});

const maintenanceTimer = setInterval(
  (): void => {
    void maintainHairStudio().catch((error: unknown) => {
      logger.error('Hair Studio maintenance failed', error);
    });
  },
  5 * 60 * 1000,
);
maintenanceTimer.unref();
void maintainHairStudio().catch((error: unknown) => {
  logger.error('Initial Hair Studio maintenance failed', error);
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

    await closeDatabase();
    clearInterval(maintenanceTimer);
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
