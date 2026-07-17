import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('availability_slots', (table): void => {
    table.string('travel_buffer_kind', 12);
    table.check(
      "travel_buffer_kind IS NULL OR travel_buffer_kind IN ('OUTBOUND','RETURN')",
      undefined,
      'availability_travel_buffer_kind_valid',
    );
  });
  await knex.schema.raw(
    'CREATE INDEX idx_availability_slots_travel_buffer_kind ON availability_slots(travel_buffer_kind) WHERE travel_buffer_kind IS NOT NULL;',
  );

  await knex.schema.alterTable('appointments', (table): void => {
    table.text('service_address_formatted');
    table.string('service_address_source', 32);
    table.boolean('service_address_is_approximate');
    table.check(
      "service_address_source IS NULL OR service_address_source IN ('google','coordinate_fallback')",
      undefined,
      'appointment_service_address_source_valid',
    );
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw('DROP INDEX IF EXISTS idx_availability_slots_travel_buffer_kind;');
  await knex.schema.alterTable('appointments', (table): void => {
    table.dropColumn('service_address_is_approximate');
    table.dropColumn('service_address_source');
    table.dropColumn('service_address_formatted');
  });
  await knex.schema.alterTable('availability_slots', (table): void => {
    table.dropColumn('travel_buffer_kind');
  });
}
