import type { Knex } from 'knex';

const createUpdatedAtTrigger = async (knex: Knex, tableName: string): Promise<void> => {
  await knex.raw(`
    CREATE TRIGGER ${tableName}_set_updated_at
    BEFORE UPDATE ON ${tableName}
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
};

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('hair_scan_sessions', (table): void => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('client_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('consent_version', 50).notNullable();
    table.timestamp('consent_accepted_at').notNullable().defaultTo(knex.fn.now());
    table.boolean('age_confirmed').notNullable();
    table.string('status', 20).notNullable().defaultTo('CAPTURING');
    table.string('analysis_status', 20).notNullable().defaultTo('NOT_STARTED');
    table.jsonb('preferences').notNullable().defaultTo(knex.raw("'{}'::jsonb"));
    table.jsonb('suggestions').notNullable().defaultTo(knex.raw("'[]'::jsonb"));
    table.text('analysis_error');
    table.timestamp('expires_at').notNullable();
    table.timestamp('deleted_at');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.check(
      "status IN ('CAPTURING','READY','EXPIRED','DELETED')",
      undefined,
      'hair_scan_status_valid',
    );
    table.check(
      "analysis_status IN ('NOT_STARTED','QUEUED','PROCESSING','COMPLETED','FAILED')",
      undefined,
      'hair_scan_analysis_status_valid',
    );
  });
  await knex.schema.raw(
    'CREATE INDEX idx_hair_scan_sessions_client ON hair_scan_sessions(client_id, created_at DESC);',
  );
  await knex.schema.raw(
    "CREATE INDEX idx_hair_scan_sessions_expiry ON hair_scan_sessions(expires_at) WHERE status NOT IN ('EXPIRED','DELETED');",
  );
  await createUpdatedAtTrigger(knex, 'hair_scan_sessions');

  await knex.schema.createTable('hair_scan_captures', (table): void => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('scan_session_id')
      .notNullable()
      .references('id')
      .inTable('hair_scan_sessions')
      .onDelete('CASCADE');
    table.string('angle', 10).notNullable();
    table.text('object_key').notNullable().unique();
    table.string('mime_type', 50).notNullable();
    table.integer('size_bytes').notNullable();
    table.string('checksum_sha256', 64).notNullable();
    table.integer('width');
    table.integer('height');
    table.decimal('brightness', 8, 2);
    table.decimal('sharpness', 12, 2);
    table.integer('face_count');
    table.decimal('pose_score', 5, 4);
    table.string('upload_status', 20).notNullable().defaultTo('PENDING');
    table.timestamp('delete_after').notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.unique(['scan_session_id', 'angle'], {
      indexName: 'hair_scan_captures_session_angle_unique',
    });
    table.check("angle IN ('FRONT','LEFT','RIGHT')", undefined, 'hair_capture_angle_valid');
    table.check(
      "upload_status IN ('PENDING','VERIFIED')",
      undefined,
      'hair_capture_upload_status_valid',
    );
    table.check('size_bytes BETWEEN 10000 AND 3000000', undefined, 'hair_capture_size_valid');
  });
  await knex.schema.raw(
    'CREATE INDEX idx_hair_scan_captures_session ON hair_scan_captures(scan_session_id);',
  );
  await knex.schema.raw(
    'CREATE INDEX idx_hair_scan_captures_cleanup ON hair_scan_captures(delete_after);',
  );
  await createUpdatedAtTrigger(knex, 'hair_scan_captures');

  await knex.schema.createTable('hair_design_generations', (table): void => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('design_id')
      .notNullable()
      .references('id')
      .inTable('client_hair_designs')
      .onDelete('CASCADE');
    table
      .uuid('scan_session_id')
      .references('id')
      .inTable('hair_scan_sessions')
      .onDelete('SET NULL');
    table.string('provider', 30).notNullable();
    table.string('model', 100).notNullable();
    table.string('status', 20).notNullable().defaultTo('QUEUED');
    table.string('prompt_version', 30).notNullable();
    table.uuid('idempotency_key').notNullable().unique();
    table.integer('progress').notNullable().defaultTo(0);
    table.string('provider_request_id', 255);
    table.text('output_object_key');
    table.string('output_mime_type', 50);
    table.integer('output_width');
    table.integer('output_height');
    table.jsonb('usage').notNullable().defaultTo(knex.raw("'{}'::jsonb"));
    table.decimal('estimated_cost_cents', 10, 4).notNullable().defaultTo(0);
    table.string('error_code', 80);
    table.text('error_message');
    table
      .uuid('retry_of_id')
      .references('id')
      .inTable('hair_design_generations')
      .onDelete('SET NULL');
    table.timestamp('started_at');
    table.timestamp('completed_at');
    table.timestamp('failed_at');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.check(
      "status IN ('QUEUED','PROCESSING','COMPLETED','FAILED','CANCELLED')",
      undefined,
      'hair_generation_status_valid',
    );
    table.check('progress BETWEEN 0 AND 100', undefined, 'hair_generation_progress_valid');
  });
  await knex.schema.raw(
    'CREATE INDEX idx_hair_generations_design ON hair_design_generations(design_id, created_at DESC);',
  );
  await knex.schema.raw(
    "CREATE INDEX idx_hair_generations_active ON hair_design_generations(status) WHERE status IN ('QUEUED','PROCESSING');",
  );
  await createUpdatedAtTrigger(knex, 'hair_design_generations');

  await knex.schema.createTable('ai_usage_events', (table): void => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('client_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table
      .uuid('generation_id')
      .references('id')
      .inTable('hair_design_generations')
      .onDelete('SET NULL');
    table.string('provider', 30).notNullable();
    table.string('model', 100).notNullable();
    table.string('event_type', 30).notNullable();
    table.integer('input_units').notNullable().defaultTo(0);
    table.integer('output_units').notNullable().defaultTo(0);
    table.decimal('estimated_cost_cents', 10, 4).notNullable().defaultTo(0);
    table.jsonb('metadata').notNullable().defaultTo(knex.raw("'{}'::jsonb"));
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });
  await knex.schema.raw(
    'CREATE INDEX idx_ai_usage_client_created ON ai_usage_events(client_id, created_at DESC);',
  );
  await knex.schema.raw('CREATE INDEX idx_ai_usage_created ON ai_usage_events(created_at DESC);');

  await knex.schema.alterTable('client_hair_designs', (table): void => {
    table
      .uuid('current_generation_id')
      .references('id')
      .inTable('hair_design_generations')
      .onDelete('SET NULL');
    table.text('generated_asset_key');
    table.string('ai_error_code', 80);
    table.text('ai_error_message');
    table.timestamp('deleted_at');
  });
  await knex.schema.raw(
    'ALTER TABLE client_hair_designs DROP CONSTRAINT IF EXISTS hair_design_ai_status_valid;',
  );
  await knex.schema.raw(`
    ALTER TABLE client_hair_designs
    ADD CONSTRAINT hair_design_ai_status_valid
    CHECK (ai_status IN ('pending','queued','processing','completed','failed','cancelled','placeholder'));
  `);
  await knex.schema.raw(
    'CREATE INDEX idx_hair_designs_current_generation ON client_hair_designs(current_generation_id) WHERE current_generation_id IS NOT NULL;',
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw('DROP INDEX IF EXISTS idx_hair_designs_current_generation;');
  await knex.schema.alterTable('client_hair_designs', (table): void => {
    table.dropColumn('deleted_at');
    table.dropColumn('ai_error_message');
    table.dropColumn('ai_error_code');
    table.dropColumn('generated_asset_key');
    table.dropColumn('current_generation_id');
  });
  await knex.schema.raw(
    'ALTER TABLE client_hair_designs DROP CONSTRAINT IF EXISTS hair_design_ai_status_valid;',
  );
  await knex.schema.raw(`
    ALTER TABLE client_hair_designs
    ADD CONSTRAINT hair_design_ai_status_valid
    CHECK (ai_status IN ('pending','processing','completed','failed','placeholder'));
  `);
  await knex.schema.dropTableIfExists('ai_usage_events');
  await knex.schema.dropTableIfExists('hair_design_generations');
  await knex.schema.dropTableIfExists('hair_scan_captures');
  await knex.schema.dropTableIfExists('hair_scan_sessions');
}
