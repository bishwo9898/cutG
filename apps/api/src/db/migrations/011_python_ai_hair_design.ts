import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('hair_scan_sessions', (table): void => {
    table.uuid('selected_capture_id').references('id').inTable('hair_scan_captures').onDelete('SET NULL');
    table.jsonb('validation_metrics').notNullable().defaultTo(knex.raw("'{}'::jsonb"));
  });
  await knex.schema.alterTable('hair_design_generations', (table): void => {
    table.string('python_job_id', 255);
    table.text('prompt_text');
    table.integer('retry_count').notNullable().defaultTo(0);
    table.integer('generation_duration_ms');
    table.timestamp('provider_submitted_at');
    table.timestamp('callback_received_at');
  });
  await knex.schema.alterTable('client_hair_designs', (table): void => {
    table.text('source_asset_key');
  });
  await knex.schema.raw(
    'CREATE INDEX idx_hair_generations_python_job ON hair_design_generations(python_job_id) WHERE python_job_id IS NOT NULL;',
  );
  await knex.schema.raw(
    'CREATE INDEX idx_hair_scans_selected_capture ON hair_scan_sessions(selected_capture_id) WHERE selected_capture_id IS NOT NULL;',
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw('DROP INDEX IF EXISTS idx_hair_scans_selected_capture;');
  await knex.schema.raw('DROP INDEX IF EXISTS idx_hair_generations_python_job;');
  await knex.schema.alterTable('client_hair_designs', (table): void => {
    table.dropColumn('source_asset_key');
  });
  await knex.schema.alterTable('hair_design_generations', (table): void => {
    table.dropColumn('callback_received_at');
    table.dropColumn('provider_submitted_at');
    table.dropColumn('generation_duration_ms');
    table.dropColumn('retry_count');
    table.dropColumn('prompt_text');
    table.dropColumn('python_job_id');
  });
  await knex.schema.alterTable('hair_scan_sessions', (table): void => {
    table.dropColumn('validation_metrics');
    table.dropColumn('selected_capture_id');
  });
}
