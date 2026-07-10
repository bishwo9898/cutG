import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('client_saved_barbers', (table): void => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('client_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table
      .uuid('barber_id')
      .notNullable()
      .references('id')
      .inTable('barber_profiles')
      .onDelete('CASCADE');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.unique(['client_id', 'barber_id'], {
      indexName: 'client_saved_barbers_client_barber_unique',
    });
  });

  await knex.schema.raw(
    'CREATE INDEX idx_client_saved_barbers_client_id ON client_saved_barbers(client_id);',
  );
  await knex.schema.raw(
    'CREATE INDEX idx_client_saved_barbers_barber_id ON client_saved_barbers(barber_id);',
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('client_saved_barbers');
}
