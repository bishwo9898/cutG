import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('services', (table): void => {
    table.text('image_url');
    table.text('image_cloudinary_public_id');
    table.integer('image_cloudinary_version');
    table.string('image_cloudinary_format', 20);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('services', (table): void => {
    table.dropColumn('image_cloudinary_format');
    table.dropColumn('image_cloudinary_version');
    table.dropColumn('image_cloudinary_public_id');
    table.dropColumn('image_url');
  });
}
