import { Migration } from '@mikro-orm/migrations'

export class Migration20260702000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE review_items (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        user_certification_id uuid NOT NULL
          REFERENCES user_certifications(id) ON DELETE CASCADE,
        anchor_chunk_id uuid NOT NULL
          REFERENCES content_chunks(id) ON DELETE CASCADE,
        box integer NOT NULL DEFAULT 1,
        state text NOT NULL DEFAULT 'active'
          CHECK (state IN ('active', 'mastered', 'suppressed')),
        due_at timestamptz NOT NULL,
        last_reviewed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT review_items_pkey PRIMARY KEY (id),
        CONSTRAINT review_items_concept_unique UNIQUE (user_certification_id, anchor_chunk_id)
      )
    `)

    this.addSql(`
      CREATE INDEX review_items_due_queue_idx
      ON review_items (user_certification_id, state, due_at)
    `)
  }

  override async down(): Promise<void> {
    this.addSql('DROP INDEX IF EXISTS review_items_due_queue_idx')
    this.addSql('DROP TABLE IF EXISTS review_items CASCADE')
  }
}
