import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'APPOINTMENT_CREATED';
    ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'JOURNEY_STARTED';
    ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'BARBER_ARRIVED';
    ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'PAYMENT_SUCCEEDED';
    ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'PAYMENT_FAILED';
  `);

  await knex.schema.createTable('mobile_push_devices', (table): void => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('installation_id', 128).notNullable();
    table.string('expo_push_token', 255).notNullable().unique();
    table.string('platform', 16).notNullable();
    table.string('app_version', 40).notNullable();
    table.boolean('is_enabled').notNullable().defaultTo(true);
    table.timestamp('last_seen_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.unique(['user_id', 'installation_id']);
  });
  await knex.schema.raw(
    'CREATE INDEX idx_mobile_push_devices_user_enabled ON mobile_push_devices(user_id,is_enabled);',
  );

  await knex.schema.createTable('mobile_push_deliveries', (table): void => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('notification_id')
      .notNullable()
      .references('id')
      .inTable('notifications')
      .onDelete('CASCADE');
    table
      .uuid('device_id')
      .notNullable()
      .references('id')
      .inTable('mobile_push_devices')
      .onDelete('CASCADE');
    table.string('status', 24).notNullable();
    table.string('error_code', 80);
    table.timestamp('attempted_at').notNullable().defaultTo(knex.fn.now());
    table.unique(['notification_id', 'device_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('mobile_push_deliveries');
  await knex.schema.dropTableIfExists('mobile_push_devices');
}
