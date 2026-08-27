import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (table): void => {
    table.text('clerk_user_id');
  });
  await knex.schema.raw('CREATE UNIQUE INDEX idx_users_clerk_user_id ON users(clerk_user_id);');

  await knex.schema.alterTable('users', (table): void => {
    table.string('password_hash', 255).nullable().alter();
  });

  await knex.schema.dropTableIfExists('token_blacklist');
  await knex.schema.dropTableIfExists('password_reset_tokens');
  await knex.schema.dropTableIfExists('email_verification_tokens');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.createTable('email_verification_tokens', (table): void => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('code', 6).notNullable();
    table.timestamp('expires_at').notNullable();
    table.timestamp('used_at');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.check("code != ''", undefined, 'email_verification_code_not_empty');
  });
  await knex.schema.raw(
    'CREATE INDEX idx_email_verification_tokens_user_id ON email_verification_tokens(user_id);',
  );
  await knex.schema.raw(
    'CREATE INDEX idx_email_verification_tokens_expires_at ON email_verification_tokens(expires_at);',
  );

  await knex.schema.createTable('password_reset_tokens', (table): void => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('code', 32).notNullable().unique();
    table.timestamp('expires_at').notNullable();
    table.timestamp('used_at');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });
  await knex.schema.raw(
    'CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);',
  );
  await knex.schema.raw(
    'CREATE INDEX idx_password_reset_tokens_code ON password_reset_tokens(code);',
  );
  await knex.schema.raw(
    'CREATE INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);',
  );

  await knex.schema.createTable('token_blacklist', (table): void => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('token_jti', 255).notNullable().unique();
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.timestamp('expires_at').notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });
  await knex.schema.raw('CREATE INDEX idx_token_blacklist_user_id ON token_blacklist(user_id);');
  await knex.schema.raw(
    'CREATE INDEX idx_token_blacklist_expires_at ON token_blacklist(expires_at);',
  );

  await knex.schema.alterTable('users', (table): void => {
    table.string('password_hash', 255).notNullable().defaultTo('').alter();
  });

  await knex.schema.raw('DROP INDEX IF EXISTS idx_users_clerk_user_id;');
  await knex.schema.alterTable('users', (table): void => {
    table.dropColumn('clerk_user_id');
  });
}
