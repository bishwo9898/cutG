import { env } from '../config/env';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const shouldLog = (level: LogLevel): boolean => {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[env.LOG_LEVEL];
};

const serializeError = (error: unknown): Record<string, unknown> => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return { error };
};

const write = (level: LogLevel, message: string, context?: Record<string, unknown>): void => {
  if (!shouldLog(level)) {
    return;
  }

  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...context,
  };

  const line = JSON.stringify(payload);

  if (level === 'error') {
    console.error(line);
    return;
  }

  if (level === 'warn') {
    console.warn(line);
    return;
  }

  console.log(line);
};

export const logger = {
  debug(message: string, context?: Record<string, unknown>): void {
    write('debug', message, context);
  },
  info(message: string, context?: Record<string, unknown>): void {
    write('info', message, context);
  },
  warn(message: string, context?: Record<string, unknown>): void {
    write('warn', message, context);
  },
  error(message: string, error?: unknown, context?: Record<string, unknown>): void {
    write('error', message, {
      ...context,
      ...(error === undefined ? {} : serializeError(error)),
    });
  },
};
