import type { Knex } from 'knex';

const createUpdatedAtTrigger = async (knex: Knex, tableName: string): Promise<void> => {
  await knex.raw(`
    CREATE TRIGGER ${tableName}_set_updated_at
    BEFORE UPDATE ON ${tableName}
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  `);
};

const commentOnTable = async (knex: Knex, tableName: string, comment: string): Promise<void> => {
  const escapedComment = comment.replaceAll("'", "''");
  await knex.raw(`COMMENT ON TABLE ${tableName} IS '${escapedComment}';`);
};

export async function up(knex: Knex): Promise<void> {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
  await knex.raw('CREATE EXTENSION IF NOT EXISTS cube;');
  await knex.raw('CREATE EXTENSION IF NOT EXISTS earthdistance;');

  await knex.raw(`
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS trigger AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await knex.raw("CREATE TYPE user_type_enum AS ENUM ('BARBER', 'CLIENT', 'ADMIN');");
  await knex.raw("CREATE TYPE subscription_tier_enum AS ENUM ('FREE', 'BASIC', 'PREMIUM');");
  await knex.raw("CREATE TYPE slot_status_enum AS ENUM ('AVAILABLE', 'BOOKED', 'BLOCKED');");
  await knex.raw(`
    CREATE TYPE appointment_status_enum AS ENUM (
      'PENDING',
      'CONFIRMED',
      'IN_PROGRESS',
      'COMPLETED',
      'CANCELLED',
      'NO_SHOW'
    );
  `);
  await knex.raw(
    "CREATE TYPE payment_status_enum AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED');",
  );
  await knex.raw(`
    CREATE TYPE subscription_status_enum AS ENUM (
      'ACTIVE',
      'PAUSED',
      'CANCELLED',
      'EXPIRED'
    );
  `);
  await knex.raw(`
    CREATE TYPE notification_type_enum AS ENUM (
      'APPOINTMENT_CONFIRMED',
      'APPOINTMENT_REMINDER',
      'APPOINTMENT_CANCELLED',
      'REVIEW_REQUEST',
      'SUBSCRIPTION_RENEWAL',
      'SUBSCRIPTION_EXPIRING',
      'PROMOTION',
      'SYSTEM'
    );
  `);

  await knex.schema.createTable('users', (table): void => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('email', 255).notNullable().unique();
    table.string('password_hash', 255).notNullable();
    table.string('phone', 20).unique();
    table.string('first_name', 100).notNullable();
    table.string('last_name', 100).notNullable();
    table.specificType('user_type', 'user_type_enum').notNullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.boolean('email_verified').notNullable().defaultTo(false);
    table.timestamp('email_verified_at');
    table.jsonb('metadata').defaultTo(knex.raw("'{}'::jsonb"));
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('deleted_at');
    table.check("email != ''", undefined, 'email_not_empty');
    table.check('(phone IS NOT NULL OR email IS NOT NULL)', undefined, 'phone_or_email');
  });
  await commentOnTable(
    knex,
    'users',
    'Canonical identity table for clients, barbers, and admins. Uses soft deletes for auditability.',
  );
  await knex.schema.raw('CREATE INDEX idx_users_email ON users(email);');
  await knex.schema.raw('CREATE INDEX idx_users_user_type ON users(user_type);');
  await knex.schema.raw('CREATE INDEX idx_users_created_at ON users(created_at DESC);');
  await knex.schema.raw(
    'CREATE INDEX idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NULL;',
  );
  await createUpdatedAtTrigger(knex, 'users');

  await knex.schema.createTable('barber_profiles', (table): void => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('user_id')
      .notNullable()
      .unique()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table.string('business_name', 255).notNullable();
    table.text('bio');
    table.integer('years_of_experience');
    table.decimal('average_rating', 3, 2).defaultTo(0);
    table.integer('total_reviews').defaultTo(0);
    table.integer('total_clients').defaultTo(0);
    table.decimal('latitude', 10, 8);
    table.decimal('longitude', 11, 8);
    table.text('address');
    table.string('city', 100);
    table.string('state', 50);
    table.string('zip_code', 20);
    table.string('profile_photo_url', 500);
    table.string('profile_photo_key', 500);
    table.specificType('subscription_tier', 'subscription_tier_enum').defaultTo('FREE');
    table.timestamp('subscription_valid_until');
    table.string('stripe_account_id', 255);
    table.boolean('is_verified').defaultTo(false);
    table.timestamp('verified_at');
    table.jsonb('metadata').defaultTo(knex.raw("'{}'::jsonb"));
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.check('(average_rating >= 0 AND average_rating <= 5)', undefined, 'rating_range');
    table.check("business_name != ''", undefined, 'business_name_not_empty');
  });
  await commentOnTable(
    knex,
    'barber_profiles',
    'Business-facing profile data separated from user identity for marketplace querying and subscriptions.',
  );
  await knex.schema.raw('CREATE INDEX idx_barber_profiles_user_id ON barber_profiles(user_id);');
  await knex.schema.raw(
    'CREATE INDEX idx_barber_profiles_average_rating ON barber_profiles(average_rating DESC);',
  );
  await knex.schema.raw(
    'CREATE INDEX idx_barber_profiles_subscription_tier ON barber_profiles(subscription_tier);',
  );
  await knex.schema.raw('CREATE INDEX idx_barber_profiles_city ON barber_profiles(city);');
  await knex.schema.raw(
    'CREATE INDEX idx_barber_profiles_is_verified ON barber_profiles(is_verified);',
  );
  await knex.schema.raw(`
    CREATE INDEX idx_barber_profiles_location
    ON barber_profiles
    USING gist (ll_to_earth(latitude::float8, longitude::float8))
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
  `);
  await createUpdatedAtTrigger(knex, 'barber_profiles');

  await knex.schema.createTable('services', (table): void => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('barber_id')
      .notNullable()
      .references('id')
      .inTable('barber_profiles')
      .onDelete('CASCADE');
    table.string('name', 255).notNullable();
    table.text('description');
    table.decimal('price', 10, 2).notNullable();
    table.integer('duration_minutes').notNullable();
    table.string('category', 50).notNullable();
    table.boolean('is_active').defaultTo(true);
    table.jsonb('metadata').defaultTo(knex.raw("'{}'::jsonb"));
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.check("name != ''", undefined, 'name_not_empty');
    table.check('price > 0', undefined, 'price_positive');
    table.check('duration_minutes > 0', undefined, 'valid_duration');
  });
  await commentOnTable(
    knex,
    'services',
    'Catalog of active and historical barber services with price and duration captured for bookings.',
  );
  await knex.schema.raw('CREATE INDEX idx_services_barber_id ON services(barber_id);');
  await knex.schema.raw('CREATE INDEX idx_services_is_active ON services(is_active);');
  await knex.schema.raw('CREATE INDEX idx_services_category ON services(category);');
  await knex.schema.raw(
    'CREATE INDEX idx_services_barber_id_active ON services(barber_id, is_active);',
  );
  await createUpdatedAtTrigger(knex, 'services');

  await knex.schema.createTable('availability_slots', (table): void => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('barber_id')
      .notNullable()
      .references('id')
      .inTable('barber_profiles')
      .onDelete('CASCADE');
    table.date('slot_date').notNullable();
    table.time('start_time').notNullable();
    table.time('end_time').notNullable();
    table.integer('duration_minutes').notNullable();
    table.specificType('status', 'slot_status_enum').defaultTo('AVAILABLE');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.check('start_time < end_time', undefined, 'start_before_end');
    table.check('duration_minutes > 0', undefined, 'valid_duration');
  });
  await commentOnTable(
    knex,
    'availability_slots',
    'Bookable barber time inventory. Appointment reference is added after appointments to resolve FK order.',
  );
  await knex.schema.raw(
    'CREATE INDEX idx_availability_slots_barber_id ON availability_slots(barber_id);',
  );
  await knex.schema.raw(
    'CREATE INDEX idx_availability_slots_barber_date ON availability_slots(barber_id, slot_date);',
  );
  await knex.schema.raw(
    'CREATE INDEX idx_availability_slots_status ON availability_slots(status);',
  );
  await knex.schema.raw(
    'CREATE INDEX idx_availability_slots_slot_date ON availability_slots(slot_date);',
  );
  await createUpdatedAtTrigger(knex, 'availability_slots');

  await knex.schema.createTable('appointments', (table): void => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('client_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table
      .uuid('barber_id')
      .notNullable()
      .references('id')
      .inTable('barber_profiles')
      .onDelete('RESTRICT');
    table
      .uuid('service_id')
      .notNullable()
      .references('id')
      .inTable('services')
      .onDelete('RESTRICT');
    table
      .uuid('availability_slot_id')
      .references('id')
      .inTable('availability_slots')
      .onDelete('SET NULL');
    table.timestamp('scheduled_at').notNullable();
    table.integer('duration_minutes').notNullable();
    table.specificType('status', 'appointment_status_enum').defaultTo('PENDING');
    table.specificType('payment_status', 'payment_status_enum').defaultTo('PENDING');
    table.text('location_address').notNullable();
    table.decimal('location_latitude', 10, 8);
    table.decimal('location_longitude', 11, 8);
    table.decimal('price_quoted', 10, 2).notNullable();
    table.decimal('price_paid', 10, 2);
    table.text('client_notes');
    table.text('barber_notes');
    table.text('cancellation_reason');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('confirmed_at');
    table.timestamp('completed_at');
    table.timestamp('cancelled_at');
    table.check('price_quoted > 0', undefined, 'price_positive');
    table.check('duration_minutes > 0', undefined, 'valid_duration');
  });
  await commentOnTable(
    knex,
    'appointments',
    'Client bookings with immutable quoted price and operational status for lifecycle workflows.',
  );
  await knex.schema.raw('CREATE INDEX idx_appointments_client_id ON appointments(client_id);');
  await knex.schema.raw('CREATE INDEX idx_appointments_barber_id ON appointments(barber_id);');
  await knex.schema.raw(
    'CREATE INDEX idx_appointments_scheduled_at ON appointments(scheduled_at DESC);',
  );
  await knex.schema.raw('CREATE INDEX idx_appointments_status ON appointments(status);');
  await knex.schema.raw(
    'CREATE INDEX idx_appointments_payment_status ON appointments(payment_status);',
  );
  await knex.schema.raw(
    'CREATE INDEX idx_appointments_client_scheduled ON appointments(client_id, scheduled_at DESC);',
  );
  await knex.schema.raw(
    'CREATE INDEX idx_appointments_barber_scheduled ON appointments(barber_id, scheduled_at DESC);',
  );
  await createUpdatedAtTrigger(knex, 'appointments');

  await knex.schema.alterTable('availability_slots', (table): void => {
    table.uuid('appointment_id').references('id').inTable('appointments').onDelete('SET NULL');
  });
  await knex.schema.raw(
    'CREATE INDEX idx_availability_slots_appointment_id ON availability_slots(appointment_id);',
  );

  await knex.schema.createTable('payments', (table): void => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('appointment_id')
      .notNullable()
      .unique()
      .references('id')
      .inTable('appointments')
      .onDelete('RESTRICT');
    table.uuid('client_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table
      .uuid('barber_id')
      .notNullable()
      .references('id')
      .inTable('barber_profiles')
      .onDelete('RESTRICT');
    table.integer('amount_cents').notNullable();
    table.string('currency', 3).defaultTo('USD');
    table.string('stripe_payment_intent_id', 255).unique();
    table.string('stripe_charge_id', 255).unique();
    table.specificType('status', 'payment_status_enum').defaultTo('PENDING');
    table.integer('refund_amount_cents');
    table.text('refund_reason');
    table.string('refund_stripe_id', 255);
    table.text('last_error_message');
    table.jsonb('error_details');
    table.jsonb('metadata').defaultTo(knex.raw("'{}'::jsonb"));
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('refunded_at');
    table.check('amount_cents > 0', undefined, 'amount_positive');
    table.check(
      '(refund_amount_cents IS NULL OR refund_amount_cents <= amount_cents)',
      undefined,
      'refund_less_than_original',
    );
  });
  await commentOnTable(
    knex,
    'payments',
    'Stripe payment mirror with cents-based accounting to avoid floating-point money errors.',
  );
  await knex.schema.raw('CREATE INDEX idx_payments_appointment_id ON payments(appointment_id);');
  await knex.schema.raw(
    'CREATE INDEX idx_payments_stripe_payment_intent_id ON payments(stripe_payment_intent_id);',
  );
  await knex.schema.raw('CREATE INDEX idx_payments_status ON payments(status);');
  await knex.schema.raw('CREATE INDEX idx_payments_client_id ON payments(client_id);');
  await knex.schema.raw('CREATE INDEX idx_payments_barber_id ON payments(barber_id);');
  await knex.schema.raw('CREATE INDEX idx_payments_created_at ON payments(created_at DESC);');
  await createUpdatedAtTrigger(knex, 'payments');

  await knex.schema.createTable('subscriptions', (table): void => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('barber_id')
      .notNullable()
      .unique()
      .references('id')
      .inTable('barber_profiles')
      .onDelete('CASCADE');
    table.specificType('tier', 'subscription_tier_enum').notNullable();
    table.specificType('status', 'subscription_status_enum').defaultTo('ACTIVE');
    table.string('stripe_subscription_id', 255).unique();
    table.timestamp('billing_cycle_start').notNullable();
    table.timestamp('billing_cycle_end').notNullable();
    table.timestamp('renewal_date');
    table.boolean('auto_renew').defaultTo(true);
    table
      .jsonb('features')
      .notNullable()
      .defaultTo(
        knex.raw(`'{
        "max_services": 5,
        "max_clients": 100,
        "advanced_analytics": false,
        "ai_recommendations": false
      }'::jsonb`),
      );
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('cancelled_at');
    table.check(
      '(renewal_date IS NULL OR renewal_date > billing_cycle_end)',
      undefined,
      'renewal_after_cycle_end',
    );
  });
  await commentOnTable(
    knex,
    'subscriptions',
    'One active subscription record per barber, with JSONB feature gates for evolving SaaS tiers.',
  );
  await knex.schema.raw('CREATE INDEX idx_subscriptions_barber_id ON subscriptions(barber_id);');
  await knex.schema.raw('CREATE INDEX idx_subscriptions_tier ON subscriptions(tier);');
  await knex.schema.raw('CREATE INDEX idx_subscriptions_status ON subscriptions(status);');
  await knex.schema.raw(
    'CREATE INDEX idx_subscriptions_renewal_date ON subscriptions(renewal_date);',
  );
  await createUpdatedAtTrigger(knex, 'subscriptions');

  await knex.schema.createTable('reviews', (table): void => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('appointment_id')
      .notNullable()
      .unique()
      .references('id')
      .inTable('appointments')
      .onDelete('CASCADE');
    table.uuid('client_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table
      .uuid('barber_id')
      .notNullable()
      .references('id')
      .inTable('barber_profiles')
      .onDelete('CASCADE');
    table.integer('rating').notNullable();
    table.string('title', 255);
    table.text('comment');
    table.boolean('is_verified_appointment').defaultTo(true);
    table.integer('helpful_count').defaultTo(0);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.check('(rating >= 1 AND rating <= 5)', undefined, 'rating_range');
  });
  await commentOnTable(
    knex,
    'reviews',
    'Verified client feedback tied one-to-one to completed appointments.',
  );
  await knex.schema.raw('CREATE INDEX idx_reviews_barber_id ON reviews(barber_id);');
  await knex.schema.raw('CREATE INDEX idx_reviews_appointment_id ON reviews(appointment_id);');
  await knex.schema.raw('CREATE INDEX idx_reviews_client_id ON reviews(client_id);');
  await knex.schema.raw('CREATE INDEX idx_reviews_rating ON reviews(rating);');
  await knex.schema.raw('CREATE INDEX idx_reviews_created_at ON reviews(created_at DESC);');
  await knex.schema.raw(
    'CREATE INDEX idx_reviews_barber_created ON reviews(barber_id, created_at DESC);',
  );
  await createUpdatedAtTrigger(knex, 'reviews');

  await knex.schema.createTable('notifications', (table): void => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.specificType('type', 'notification_type_enum').notNullable();
    table.string('title', 255).notNullable();
    table.text('message').notNullable();
    table.jsonb('related_data').defaultTo(knex.raw("'{}'::jsonb"));
    table.boolean('is_read').defaultTo(false);
    table.timestamp('read_at');
    table.boolean('sent_via_email').defaultTo(false);
    table.boolean('sent_via_sms').defaultTo(false);
    table.boolean('sent_via_push').defaultTo(false);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('scheduled_for');
    table.timestamp('sent_at');
  });
  await commentOnTable(
    knex,
    'notifications',
    'Durable notification queue for in-app, email, SMS, and push delivery workflows.',
  );
  await knex.schema.raw('CREATE INDEX idx_notifications_user_id ON notifications(user_id);');
  await knex.schema.raw(
    'CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read);',
  );
  await knex.schema.raw('CREATE INDEX idx_notifications_type ON notifications(type);');
  await knex.schema.raw(
    'CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);',
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('notifications');
  await knex.schema.dropTableIfExists('reviews');
  await knex.schema.dropTableIfExists('subscriptions');
  await knex.schema.dropTableIfExists('payments');
  await knex.schema.alterTable('availability_slots', (table): void => {
    table.dropColumn('appointment_id');
  });
  await knex.schema.dropTableIfExists('appointments');
  await knex.schema.dropTableIfExists('availability_slots');
  await knex.schema.dropTableIfExists('services');
  await knex.schema.dropTableIfExists('barber_profiles');
  await knex.schema.dropTableIfExists('users');

  await knex.raw('DROP TYPE IF EXISTS notification_type_enum;');
  await knex.raw('DROP TYPE IF EXISTS subscription_status_enum;');
  await knex.raw('DROP TYPE IF EXISTS payment_status_enum;');
  await knex.raw('DROP TYPE IF EXISTS appointment_status_enum;');
  await knex.raw('DROP TYPE IF EXISTS slot_status_enum;');
  await knex.raw('DROP TYPE IF EXISTS subscription_tier_enum;');
  await knex.raw('DROP TYPE IF EXISTS user_type_enum;');
  await knex.raw('DROP FUNCTION IF EXISTS set_updated_at();');
}
