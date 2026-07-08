import type { PoolClient, QueryResultRow } from 'pg';

import { pool } from '../../config/database';

export type DatabaseExecutor = Pick<PoolClient, 'query'>;

export const query = async <T extends QueryResultRow>(
  text: string,
  values: unknown[] = [],
  executor: DatabaseExecutor = pool,
): Promise<T[]> => {
  const result = await executor.query<T>(text, values);
  return result.rows;
};

export const withTransaction = async <T>(
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
