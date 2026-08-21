import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('barber_profiles', (table): void => {
    table.boolean('online_payments_enabled').notNullable().defaultTo(true);
  });
  await knex('barber_profiles').update({ online_payments_enabled: true });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('barber_profiles', (table): void => {
    table.dropColumn('online_payments_enabled');
  });
}
