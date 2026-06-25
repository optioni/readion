import { Migration } from '@mikro-orm/migrations'

export class Migration20260630000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE weak_areas (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        user_certification_id uuid NOT NULL
          REFERENCES user_certifications(id) ON DELETE CASCADE,
        domain text NOT NULL,
        score real NOT NULL,
        accuracy real NOT NULL,
        mean_confidence real NOT NULL,
        response_count integer NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT weak_areas_pkey PRIMARY KEY (id),
        CONSTRAINT weak_areas_user_certification_id_domain_unique
          UNIQUE (user_certification_id, domain)
      )
    `)

    this.addSql(`
      CREATE INDEX weak_areas_user_certification_id_idx
      ON weak_areas (user_certification_id)
    `)
  }

  override async down(): Promise<void> {
    this.addSql('DROP INDEX IF EXISTS weak_areas_user_certification_id_idx')
    this.addSql('DROP TABLE IF EXISTS weak_areas CASCADE')
  }
}
