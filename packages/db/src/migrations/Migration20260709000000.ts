import { Migration } from '@mikro-orm/migrations'

export class Migration20260709000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS quarantined_items (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        certification_id uuid NOT NULL,
        domain text NOT NULL,
        verdict text NOT NULL,
        reason text NOT NULL,
        status text NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'approved', 'rejected')),
        cache_key text NOT NULL,
        provenance jsonb NOT NULL,
        generated_content jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT quarantined_items_pkey PRIMARY KEY (id)
      )
    `)

    this.addSql(`
      CREATE INDEX quarantined_items_certification_id_idx
      ON quarantined_items (certification_id)
    `)

    this.addSql(`
      CREATE INDEX quarantined_items_status_idx
      ON quarantined_items (status)
    `)
  }

  override async down(): Promise<void> {
    this.addSql('DROP INDEX IF EXISTS quarantined_items_status_idx')
    this.addSql('DROP INDEX IF EXISTS quarantined_items_certification_id_idx')
    this.addSql('DROP TABLE IF EXISTS quarantined_items CASCADE')
  }
}
