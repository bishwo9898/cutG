import { Pool, type PoolClient, type QueryResultRow } from 'pg';

import { config } from './config';

export const database = new Pool({ connectionString: config.databaseUrl, max: 5 });

export const query = async <T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
  client?: PoolClient,
): Promise<T[]> => {
  const result = await (client ?? database).query<T>(text, values);
  return result.rows;
};

export const transaction = async <T>(work: (client: PoolClient) => Promise<T>): Promise<T> => {
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
