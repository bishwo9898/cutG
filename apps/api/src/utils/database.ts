import type { QueryResult, QueryResultRow } from 'pg';

import { HEALTHCHECK_QUERY } from '../config/constants';
import { pool } from '../config/database';

export const query = async <T extends QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> => {
  return pool.query<T>(text, params);
};

export const checkDatabaseHealth = async (): Promise<{
  status: 'ok' | 'error';
  latencyMs?: number;
}> => {
  const startedAt = performance.now();

  try {
    await query(HEALTHCHECK_QUERY);
    return {
      status: 'ok',
      latencyMs: Math.round(performance.now() - startedAt),
    };
  } catch {
    return { status: 'error' };
  }
};
