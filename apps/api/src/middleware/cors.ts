import cors from 'cors';
import type { CorsOptions } from 'cors';

import { env } from '../config/env';

const allowedOrigins = new Set([env.WEB_APP_URL]);

export const corsOptions: CorsOptions = {
  credentials: true,
  origin(origin, callback): void {
    if (origin === undefined || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
};

export const corsMiddleware = cors(corsOptions);
