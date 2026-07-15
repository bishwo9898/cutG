import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw("CREATE TYPE appointment_payment_method_enum AS ENUM ('CASH', 'CARD');");
  await knex.schema.alterTable('appointments', (table): void => {
    table
      .specificType('payment_method', 'appointment_payment_method_enum')
      .notNullable()
      .defaultTo('CASH');
  });
  await knex.schema.raw(
    'CREATE INDEX idx_appointments_payment_method ON appointments(payment_method);',
  );

  // Older development seeds used fake Connect account IDs that must never be
  // treated as payment-ready after checkout becomes available.
  await knex('barber_profiles').where('stripe_account_id', 'like', 'acct_test_%').update({
    stripe_account_id: null,
    stripe_charges_enabled: false,
    stripe_onboarding_complete: false,
    stripe_payouts_enabled: false,
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw('DROP INDEX IF EXISTS idx_appointments_payment_method;');
  await knex.schema.alterTable('appointments', (table): void => {
    table.dropColumn('payment_method');
  });
  await knex.raw('DROP TYPE IF EXISTS appointment_payment_method_enum;');
}
