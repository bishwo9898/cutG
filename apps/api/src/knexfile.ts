import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { Knex } from 'knex';

import { env } from './config/env';

const compiledExtension = __filename.endsWith('.ts') ? 'ts' : 'js';
const migrationDirectory = resolve(__dirname, 'db/migrations');

class StableCompiledMigrationSource implements Knex.MigrationSource<string> {
  public constructor(private readonly directory: string) {}

  public async getMigrations(loadExtensions: readonly string[]): Promise<string[]> {
    void loadExtensions;
    return (await readdir(this.directory)).filter((filename) => filename.endsWith('.js')).sort();
  }

  public getMigrationName(migration: string): string {
    // Keep the historical TypeScript filename in knex_migrations even when production executes
    // compiled JavaScript. This prevents a database migrated locally from appearing corrupt or
    // attempting to rerun every migration inside the production image.
    return migration.replace(/\.js$/, '.ts');
  }

  public async getMigration(migration: string): Promise<Knex.Migration> {
    return (await import(resolve(this.directory, migration))) as Knex.Migration;
  }
}

const migrations: Knex.MigratorConfig =
  compiledExtension === 'js'
    ? { migrationSource: new StableCompiledMigrationSource(migrationDirectory) }
    : { directory: migrationDirectory, extension: compiledExtension };

const config: Knex.Config = {
  client: 'pg',
  connection: env.DATABASE_URL,
  pool: {
    min: env.DATABASE_POOL_MIN,
    max: env.DATABASE_POOL_MAX,
  },
  migrations,
  seeds: {
    directory: resolve(__dirname, 'db/seeds'),
    extension: compiledExtension,
    loadExtensions: [`.${compiledExtension}`],
  },
};

export default config;
