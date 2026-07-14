import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('barber_location_pings', (table): void => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('appointment_id')
      .notNullable()
      .references('id')
      .inTable('appointments')
      .onDelete('CASCADE');
    table
      .uuid('barber_id')
      .notNullable()
      .references('id')
      .inTable('barber_profiles')
      .onDelete('CASCADE');
    table.decimal('latitude', 10, 8).notNullable();
    table.decimal('longitude', 11, 8).notNullable();
    table.decimal('accuracy_meters', 8, 2);
    table.decimal('heading_degrees', 5, 2);
    table.decimal('speed_ms', 6, 2);
    table.timestamp('recorded_at').notNullable().defaultTo(knex.fn.now());
    table.check('latitude BETWEEN -90 AND 90', undefined, 'location_ping_latitude_valid');
    table.check('longitude BETWEEN -180 AND 180', undefined, 'location_ping_longitude_valid');
    table.check(
      'accuracy_meters IS NULL OR accuracy_meters >= 0',
      undefined,
      'location_ping_accuracy_valid',
    );
    table.check(
      'heading_degrees IS NULL OR heading_degrees BETWEEN 0 AND 360',
      undefined,
      'location_ping_heading_valid',
    );
    table.check('speed_ms IS NULL OR speed_ms >= 0', undefined, 'location_ping_speed_valid');
  });
  await knex.schema.raw(
    'CREATE INDEX idx_location_pings_appointment_id ON barber_location_pings(appointment_id);',
  );
  await knex.schema.raw(
    'CREATE INDEX idx_location_pings_recorded_at ON barber_location_pings(appointment_id, recorded_at DESC);',
  );

  await knex.schema.createTable('client_hair_designs', (table): void => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('client_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('style_name', 100);
    table.string('style_category', 50);
    table.text('description');
    table.text('source_photo_url');
    table.text('generated_preview_url');
    table.uuid('appointment_id').references('id').inTable('appointments').onDelete('SET NULL');
    table.boolean('is_saved').notNullable().defaultTo(true);
    table.string('ai_status', 20).notNullable().defaultTo('placeholder');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.check(
      "ai_status IN ('pending','processing','completed','failed','placeholder')",
      undefined,
      'hair_design_ai_status_valid',
    );
  });
  await knex.schema.raw(
    'CREATE INDEX idx_client_hair_designs_client_id ON client_hair_designs(client_id);',
  );
  await knex.schema.raw(
    'CREATE INDEX idx_client_hair_designs_appointment_id ON client_hair_designs(appointment_id);',
  );
  await knex.raw(`
    CREATE TRIGGER client_hair_designs_set_updated_at
    BEFORE UPDATE ON client_hair_designs
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);

  await knex.schema.alterTable('appointments', (table): void => {
    table
      .uuid('style_reference_id')
      .references('id')
      .inTable('client_hair_designs')
      .onDelete('SET NULL');
    table.text('style_notes');
  });
  await knex.schema.raw(
    'CREATE INDEX idx_appointments_style_reference ON appointments(style_reference_id) WHERE style_reference_id IS NOT NULL;',
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw('DROP INDEX IF EXISTS idx_appointments_style_reference;');
  await knex.schema.alterTable('appointments', (table): void => {
    table.dropColumn('style_notes');
    table.dropColumn('style_reference_id');
  });
  await knex.schema.dropTableIfExists('client_hair_designs');
  await knex.schema.dropTableIfExists('barber_location_pings');
}
