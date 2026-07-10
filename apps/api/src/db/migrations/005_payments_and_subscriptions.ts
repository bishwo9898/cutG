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
  await knex.schema.createTable('payout_batches', (table): void => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('barber_id')
      .notNullable()
      .references('id')
      .inTable('barber_profiles')
      .onDelete('RESTRICT');
    table.string('stripe_transfer_id', 255).unique();
    table.integer('amount_cents').notNullable();
    table.string('currency', 3).notNullable().defaultTo('usd');
    table.string('status', 20).notNullable().defaultTo('pending');
    table.integer('appointment_count').notNullable().defaultTo(0);
    table.date('period_start').notNullable();
    table.date('period_end').notNullable();
    table.timestamp('paid_at');
    table.text('error_message');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.check('amount_cents > 0', undefined, 'payout_amount_positive');
    table.check("status IN ('pending','paid','failed')", undefined, 'payout_status_valid');
  });
  await knex.schema.raw('CREATE INDEX idx_payout_batches_barber_id ON payout_batches(barber_id);');
  await knex.schema.raw('CREATE INDEX idx_payout_batches_status ON payout_batches(status);');
  await createUpdatedAtTrigger(knex, 'payout_batches');

  await knex.schema.createTable('subscription_events', (table): void => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('barber_id').references('id').inTable('barber_profiles').onDelete('CASCADE');
    table.string('stripe_event_id', 255).notNullable().unique();
    table.string('event_type', 100).notNullable();
    table.string('stripe_subscription_id', 255);
    table.string('tier', 20);
    table.jsonb('data').notNullable().defaultTo(knex.raw("'{}'::jsonb"));
    table.timestamp('processed_at').notNullable().defaultTo(knex.fn.now());
  });
  await knex.schema.raw(
    'CREATE INDEX idx_subscription_events_barber_id ON subscription_events(barber_id);',
  );
  await knex.schema.raw(
    'CREATE INDEX idx_subscription_events_stripe_event_id ON subscription_events(stripe_event_id);',
  );

  await knex.schema.alterTable('payments', (table): void => {
    table.string('stripe_transfer_id', 255);
    table.integer('platform_fee_cents');
    table.integer('barber_payout_cents');
    table.uuid('payout_batch_id').references('id').inTable('payout_batches').onDelete('SET NULL');
    table.string('stripe_refund_id', 255);
    table.timestamp('failed_at');
    table.timestamp('captured_at');
    table.check(
      '(platform_fee_cents IS NULL OR platform_fee_cents >= 0)',
      undefined,
      'platform_fee_nonnegative',
    );
    table.check(
      '(barber_payout_cents IS NULL OR barber_payout_cents >= 0)',
      undefined,
      'barber_payout_nonnegative',
    );
  });
  await knex.schema.raw(
    'CREATE INDEX IF NOT EXISTS idx_payments_payout_batch_id ON payments(payout_batch_id);',
  );

  await knex.schema.alterTable('barber_profiles', (table): void => {
    table.boolean('stripe_onboarding_complete').notNullable().defaultTo(false);
    table.boolean('stripe_charges_enabled').notNullable().defaultTo(false);
    table.boolean('stripe_payouts_enabled').notNullable().defaultTo(false);
  });

  await knex.schema.alterTable('subscriptions', (table): void => {
    table.string('stripe_customer_id', 255);
    table.string('billing_interval', 10);
    table.timestamp('current_period_start');
    table.timestamp('current_period_end');
    table.boolean('cancel_at_period_end').notNullable().defaultTo(false);
    table.check(
      "(billing_interval IS NULL OR billing_interval IN ('month','year'))",
      undefined,
      'billing_interval_valid',
    );
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('subscriptions', (table): void => {
    table.dropChecks(['billing_interval_valid']);
    table.dropColumn('cancel_at_period_end');
    table.dropColumn('current_period_end');
    table.dropColumn('current_period_start');
    table.dropColumn('billing_interval');
    table.dropColumn('stripe_customer_id');
  });

  await knex.schema.alterTable('barber_profiles', (table): void => {
    table.dropColumn('stripe_payouts_enabled');
    table.dropColumn('stripe_charges_enabled');
    table.dropColumn('stripe_onboarding_complete');
  });

  await knex.schema.alterTable('payments', (table): void => {
    table.dropChecks(['platform_fee_nonnegative', 'barber_payout_nonnegative']);
    table.dropColumn('captured_at');
    table.dropColumn('failed_at');
    table.dropColumn('stripe_refund_id');
    table.dropColumn('payout_batch_id');
    table.dropColumn('barber_payout_cents');
    table.dropColumn('platform_fee_cents');
    table.dropColumn('stripe_transfer_id');
  });

  await knex.schema.dropTableIfExists('subscription_events');
  await knex.schema.dropTableIfExists('payout_batches');
}
