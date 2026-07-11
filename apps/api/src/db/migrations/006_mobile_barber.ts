import type { Knex } from 'knex';

const createUpdatedAtTrigger = async (knex: Knex, tableName: string): Promise<void> => {
  await knex.raw(`
    CREATE TRIGGER ${tableName}_set_updated_at
    BEFORE UPDATE ON ${tableName}
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  `);
};

export async function up(knex: Knex): Promise<void> {
  await knex.raw("ALTER TYPE appointment_status_enum ADD VALUE IF NOT EXISTS 'ON_THE_WAY';");
  await knex.raw("ALTER TYPE appointment_status_enum ADD VALUE IF NOT EXISTS 'ARRIVED';");

  await knex.schema.createTable('mobile_barber_config', (table): void => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('barber_id')
      .notNullable()
      .unique()
      .references('id')
      .inTable('barber_profiles')
      .onDelete('CASCADE');
    table.boolean('is_enabled').notNullable().defaultTo(false);
    table.decimal('service_radius_miles', 5, 2).notNullable().defaultTo(10);
    table.string('fee_structure', 10).notNullable().defaultTo('flat');
    table.integer('base_fee_cents').notNullable().defaultTo(0);
    table.integer('per_mile_rate_cents').notNullable().defaultTo(0);
    table.decimal('origin_latitude', 10, 8).notNullable();
    table.decimal('origin_longitude', 11, 8).notNullable();
    table.text('origin_address');
    table.text('mobile_service_notes');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.check(
      'service_radius_miles > 0 AND service_radius_miles <= 50',
      undefined,
      'mobile_radius_valid',
    );
    table.check(
      "fee_structure IN ('flat','per_mile','free')",
      undefined,
      'mobile_fee_structure_valid',
    );
    table.check('base_fee_cents >= 0', undefined, 'mobile_base_fee_nonnegative');
    table.check('per_mile_rate_cents >= 0', undefined, 'mobile_mile_fee_nonnegative');
    table.check(
      'origin_latitude >= -90 AND origin_latitude <= 90',
      undefined,
      'mobile_origin_latitude_valid',
    );
    table.check(
      'origin_longitude >= -180 AND origin_longitude <= 180',
      undefined,
      'mobile_origin_longitude_valid',
    );
  });
  await knex.schema.raw(
    'CREATE INDEX idx_mobile_barber_config_barber_id ON mobile_barber_config(barber_id);',
  );
  await knex.schema.raw(
    'CREATE INDEX idx_mobile_barber_config_is_enabled ON mobile_barber_config(is_enabled);',
  );
  await createUpdatedAtTrigger(knex, 'mobile_barber_config');

  await knex.schema.createTable('client_addresses', (table): void => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('client_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('label', 50).notNullable();
    table.text('address_line1').notNullable();
    table.text('address_line2');
    table.string('city', 100).notNullable();
    table.string('state', 50).notNullable();
    table.string('zip_code', 20).notNullable();
    table.string('country', 3).notNullable().defaultTo('US');
    table.decimal('latitude', 10, 8).notNullable();
    table.decimal('longitude', 11, 8).notNullable();
    table.boolean('is_default').notNullable().defaultTo(false);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.check("label <> ''", undefined, 'client_address_label_not_empty');
    table.check("address_line1 <> ''", undefined, 'client_address_line1_not_empty');
    table.check('latitude >= -90 AND latitude <= 90', undefined, 'client_address_latitude_valid');
    table.check(
      'longitude >= -180 AND longitude <= 180',
      undefined,
      'client_address_longitude_valid',
    );
  });
  await knex.schema.raw(
    'CREATE INDEX idx_client_addresses_client_id ON client_addresses(client_id);',
  );
  await knex.schema.raw(
    'CREATE UNIQUE INDEX idx_client_addresses_one_default ON client_addresses(client_id) WHERE is_default = true;',
  );
  await createUpdatedAtTrigger(knex, 'client_addresses');

  await knex.schema.alterTable('appointments', (table): void => {
    table.boolean('is_mobile_service').notNullable().defaultTo(false);
    table
      .uuid('client_address_id')
      .references('id')
      .inTable('client_addresses')
      .onDelete('SET NULL');
    table.decimal('service_latitude', 10, 8);
    table.decimal('service_longitude', 11, 8);
    table.text('service_address_line1');
    table.string('service_address_city', 100);
    table.string('service_address_state', 50);
    table.string('service_address_zip', 20);
    table.integer('travel_fee_cents').notNullable().defaultTo(0);
    table.integer('estimated_travel_minutes');
    table.decimal('distance_miles', 6, 2);
    table.timestamp('barber_departed_at');
    table.timestamp('barber_arrived_at');
    table.check('travel_fee_cents >= 0', undefined, 'appointment_travel_fee_nonnegative');
    table.check(
      '(estimated_travel_minutes IS NULL OR estimated_travel_minutes >= 0)',
      undefined,
      'appointment_travel_minutes_nonnegative',
    );
    table.check(
      '(distance_miles IS NULL OR distance_miles >= 0)',
      undefined,
      'appointment_distance_nonnegative',
    );
  });
  await knex.schema.raw(
    'CREATE INDEX idx_appointments_mobile_service ON appointments(is_mobile_service) WHERE is_mobile_service = true;',
  );

  await knex.schema.alterTable('availability_slots', (table): void => {
    table.boolean('is_travel_buffer').notNullable().defaultTo(false);
    table.uuid('travel_buffer_for').references('id').inTable('appointments').onDelete('SET NULL');
  });
  await knex.schema.raw(
    'CREATE INDEX idx_availability_slots_travel_buffer ON availability_slots(travel_buffer_for) WHERE is_travel_buffer = true;',
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw('DROP INDEX IF EXISTS idx_availability_slots_travel_buffer;');
  await knex.schema.alterTable('availability_slots', (table): void => {
    table.dropColumn('travel_buffer_for');
    table.dropColumn('is_travel_buffer');
  });
  await knex.schema.raw('DROP INDEX IF EXISTS idx_appointments_mobile_service;');
  await knex.schema.alterTable('appointments', (table): void => {
    table.dropChecks([
      'appointment_travel_fee_nonnegative',
      'appointment_travel_minutes_nonnegative',
      'appointment_distance_nonnegative',
    ]);
    table.dropColumn('barber_arrived_at');
    table.dropColumn('barber_departed_at');
    table.dropColumn('distance_miles');
    table.dropColumn('estimated_travel_minutes');
    table.dropColumn('travel_fee_cents');
    table.dropColumn('service_address_zip');
    table.dropColumn('service_address_state');
    table.dropColumn('service_address_city');
    table.dropColumn('service_address_line1');
    table.dropColumn('service_longitude');
    table.dropColumn('service_latitude');
    table.dropColumn('client_address_id');
    table.dropColumn('is_mobile_service');
  });
  await knex.schema.dropTableIfExists('client_addresses');
  await knex.schema.dropTableIfExists('mobile_barber_config');
  // PostgreSQL enum value removal is intentionally omitted because data may reference it.
}
