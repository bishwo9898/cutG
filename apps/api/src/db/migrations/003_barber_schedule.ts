import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw("ALTER TYPE appointment_status_enum ADD VALUE IF NOT EXISTS 'IN_PROGRESS'");

  await knex.raw(`
    WITH ranked_slots AS (
      SELECT id,
        ROW_NUMBER() OVER (
          PARTITION BY barber_id, slot_date, start_time
          ORDER BY
            CASE WHEN appointment_id IS NOT NULL OR status = 'BOOKED' THEN 0 ELSE 1 END,
            created_at,
            id
        ) AS duplicate_rank
      FROM availability_slots
    )
    DELETE FROM availability_slots
    WHERE id IN (SELECT id FROM ranked_slots WHERE duplicate_rank > 1)
  `);

  await knex.schema.alterTable('availability_slots', (table): void => {
    table.unique(['barber_id', 'slot_date', 'start_time'], {
      indexName: 'availability_slots_barber_date_start_unique',
    });
  });

  await knex.schema.createTable('barber_schedules', (table): void => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('barber_id')
      .notNullable()
      .references('id')
      .inTable('barber_profiles')
      .onDelete('CASCADE');
    table.integer('day_of_week').notNullable();
    table.time('start_time').notNullable();
    table.time('end_time').notNullable();
    table.integer('slot_duration_minutes').notNullable().defaultTo(30);
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.unique(['barber_id', 'day_of_week']);
    table.check('day_of_week BETWEEN 1 AND 7', undefined, 'valid_day_of_week');
    table.check('start_time < end_time', undefined, 'schedule_start_before_end');
    table.check(
      'slot_duration_minutes IN (15, 30, 45, 60)',
      undefined,
      'valid_schedule_slot_duration',
    );
  });
  await knex.schema.raw(
    'CREATE INDEX idx_barber_schedules_barber_id ON barber_schedules(barber_id)',
  );
  await knex.schema.raw(
    'CREATE INDEX idx_barber_schedules_day_of_week ON barber_schedules(day_of_week)',
  );
  await knex.schema.raw(`
    CREATE TRIGGER set_barber_schedules_updated_at
    BEFORE UPDATE ON barber_schedules
    FOR EACH ROW EXECUTE FUNCTION set_updated_at()
  `);

  await knex.schema.createTable('barber_blocked_dates', (table): void => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('barber_id')
      .notNullable()
      .references('id')
      .inTable('barber_profiles')
      .onDelete('CASCADE');
    table.date('blocked_date').notNullable();
    table.text('reason');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.unique(['barber_id', 'blocked_date']);
  });
  await knex.schema.raw(
    'CREATE INDEX idx_barber_blocked_dates_barber_id ON barber_blocked_dates(barber_id)',
  );
  await knex.schema.raw(
    'CREATE INDEX idx_barber_blocked_dates_date ON barber_blocked_dates(blocked_date)',
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('barber_blocked_dates');
  await knex.schema.dropTableIfExists('barber_schedules');
  await knex.schema.alterTable('availability_slots', (table): void => {
    table.dropUnique(
      ['barber_id', 'slot_date', 'start_time'],
      'availability_slots_barber_date_start_unique',
    );
  });
}
