import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('client_hair_studio_consents', (table): void => {
    table.uuid('client_id').primary().references('id').inTable('users').onDelete('CASCADE');
    table.string('consent_version', 50).notNullable();
    table.boolean('age_confirmed').notNullable();
    table.boolean('face_processing_consented').notNullable();
    table.timestamp('accepted_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.alterTable('client_hair_designs', (table): void => {
    table.text('source_cloudinary_public_id');
    table.integer('source_cloudinary_version');
    table.string('source_cloudinary_format', 20);
    table.text('generated_cloudinary_public_id');
    table.integer('generated_cloudinary_version');
    table.string('generated_cloudinary_format', 20);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('client_hair_designs', (table): void => {
    table.dropColumn('generated_cloudinary_format');
    table.dropColumn('generated_cloudinary_version');
    table.dropColumn('generated_cloudinary_public_id');
    table.dropColumn('source_cloudinary_format');
    table.dropColumn('source_cloudinary_version');
    table.dropColumn('source_cloudinary_public_id');
  });
  await knex.schema.dropTableIfExists('client_hair_studio_consents');
}
