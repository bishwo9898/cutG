import type { Knex } from 'knex';

const createUpdatedAtTrigger = async (knex: Knex, tableName: string): Promise<void> => {
  await knex.raw(`
    CREATE TRIGGER ${tableName}_set_updated_at
    BEFORE UPDATE ON ${tableName}
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);
};

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('barber_profiles', (table): void => {
    table.string('headline', 160);
    table.string('business_type', 20).notNullable().defaultTo('INDEPENDENT');
    table.jsonb('languages').notNullable().defaultTo(knex.raw("'[]'::jsonb"));
    table.jsonb('specialties').notNullable().defaultTo(knex.raw("'[]'::jsonb"));
    table.text('banner_url');
    table.string('banner_asset_type', 10);
    table.text('banner_cloudinary_public_id');
    table.integer('banner_cloudinary_version');
    table.string('banner_cloudinary_format', 20);
    table.text('profile_photo_cloudinary_public_id');
    table.integer('profile_photo_cloudinary_version');
    table.string('profile_photo_cloudinary_format', 20);
    table.timestamp('portfolio_completed_at');
    table.check(
      "business_type IN ('INDEPENDENT','SHOP')",
      undefined,
      'barber_profile_business_type_valid',
    );
    table.check(
      "banner_asset_type IS NULL OR banner_asset_type IN ('image','video')",
      undefined,
      'barber_profile_banner_type_valid',
    );
  });
  // Existing businesses keep their current dashboard flow. Profiles created after this migration
  // are routed through the new portfolio-first onboarding.
  await knex.raw(
    'UPDATE barber_profiles SET portfolio_completed_at = CURRENT_TIMESTAMP WHERE portfolio_completed_at IS NULL;',
  );

  await knex.schema.createTable('barber_portfolio_items', (table): void => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('barber_id')
      .notNullable()
      .references('id')
      .inTable('barber_profiles')
      .onDelete('CASCADE');
    table.string('title', 120).notNullable();
    table.text('description');
    table.string('category', 30).notNullable();
    table.string('hair_type', 20).notNullable();
    table.string('hair_density', 20).notNullable();
    table.string('hair_length_before', 80).notNullable();
    table.string('hair_length_after', 80).notNullable();
    table.string('face_shape', 20).notNullable();
    table.string('cut_style', 120).notNullable();
    table.integer('time_taken_minutes').notNullable();
    table.jsonb('products_used').notNullable().defaultTo(knex.raw("'[]'::jsonb"));
    table.string('difficulty', 20).notNullable();
    table.text('before_image_url');
    table.text('before_cloudinary_public_id');
    table.integer('before_cloudinary_version');
    table.string('before_cloudinary_format', 20);
    table.text('after_image_url');
    table.text('after_cloudinary_public_id');
    table.integer('after_cloudinary_version');
    table.string('after_cloudinary_format', 20);
    table.boolean('is_published').notNullable().defaultTo(false);
    table.boolean('is_featured').notNullable().defaultTo(false);
    table.integer('display_order').notNullable().defaultTo(0);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.check(
      "category IN ('BURST_FADE','MID_FADE','LOW_FADE','HIGH_FADE','TAPER','CURLY','AFRO','BEARD','SCISSOR_CUTS','KIDS','LONG_HAIR','DESIGNS')",
      undefined,
      'portfolio_item_category_valid',
    );
    table.check(
      "hair_type IN ('STRAIGHT','WAVY','CURLY','COILY')",
      undefined,
      'portfolio_item_hair_type_valid',
    );
    table.check(
      "hair_density IN ('THIN','MEDIUM','THICK')",
      undefined,
      'portfolio_item_hair_density_valid',
    );
    table.check(
      "face_shape IN ('OVAL','ROUND','SQUARE')",
      undefined,
      'portfolio_item_face_shape_valid',
    );
    table.check(
      "difficulty IN ('FOUNDATIONAL','INTERMEDIATE','ADVANCED')",
      undefined,
      'portfolio_item_difficulty_valid',
    );
    table.check('time_taken_minutes BETWEEN 5 AND 480', undefined, 'portfolio_item_time_valid');
  });
  await knex.schema.raw(
    'CREATE INDEX idx_portfolio_items_barber_published ON barber_portfolio_items(barber_id, is_published, display_order, created_at DESC);',
  );
  await knex.schema.raw(
    'CREATE INDEX idx_portfolio_items_barber_category ON barber_portfolio_items(barber_id, category) WHERE is_published = true;',
  );
  await createUpdatedAtTrigger(knex, 'barber_portfolio_items');

  await knex.schema.createTable('barber_work_experiences', (table): void => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('barber_id')
      .notNullable()
      .references('id')
      .inTable('barber_profiles')
      .onDelete('CASCADE');
    table.string('shop_name', 160).notNullable();
    table.string('title', 120).notNullable();
    table.string('location', 160);
    table.date('start_date').notNullable();
    table.date('end_date');
    table.boolean('is_current').notNullable().defaultTo(false);
    table.text('description');
    table.integer('display_order').notNullable().defaultTo(0);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.check(
      '(is_current = true AND end_date IS NULL) OR (is_current = false)',
      undefined,
      'work_experience_current_end_date_valid',
    );
    table.check(
      'end_date IS NULL OR end_date >= start_date',
      undefined,
      'work_experience_date_range_valid',
    );
  });
  await knex.schema.raw(
    'CREATE INDEX idx_work_experiences_barber ON barber_work_experiences(barber_id, display_order, start_date DESC);',
  );
  await createUpdatedAtTrigger(knex, 'barber_work_experiences');

  await knex.schema.createTable('barber_certifications', (table): void => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('barber_id')
      .notNullable()
      .references('id')
      .inTable('barber_profiles')
      .onDelete('CASCADE');
    table.string('name', 160).notNullable();
    table.string('issuer', 160).notNullable();
    table.date('issue_date');
    table.date('expiration_date');
    table.string('credential_id', 120);
    table.text('credential_url');
    table.integer('display_order').notNullable().defaultTo(0);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.check(
      'expiration_date IS NULL OR issue_date IS NULL OR expiration_date >= issue_date',
      undefined,
      'certification_date_range_valid',
    );
  });
  await knex.schema.raw(
    'CREATE INDEX idx_certifications_barber ON barber_certifications(barber_id, display_order, issue_date DESC);',
  );
  await createUpdatedAtTrigger(knex, 'barber_certifications');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('barber_certifications');
  await knex.schema.dropTableIfExists('barber_work_experiences');
  await knex.schema.dropTableIfExists('barber_portfolio_items');
  await knex.schema.alterTable('barber_profiles', (table): void => {
    table.dropColumn('portfolio_completed_at');
    table.dropColumn('profile_photo_cloudinary_format');
    table.dropColumn('profile_photo_cloudinary_version');
    table.dropColumn('profile_photo_cloudinary_public_id');
    table.dropColumn('banner_cloudinary_format');
    table.dropColumn('banner_cloudinary_version');
    table.dropColumn('banner_cloudinary_public_id');
    table.dropColumn('banner_asset_type');
    table.dropColumn('banner_url');
    table.dropColumn('specialties');
    table.dropColumn('languages');
    table.dropColumn('business_type');
    table.dropColumn('headline');
  });
}
