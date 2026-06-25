import { Migration } from '@mikro-orm/migrations'

export class Migration20260628000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      ALTER TABLE content_chunks
        ADD COLUMN state text NOT NULL DEFAULT 'active'
          CHECK (state IN ('active', 'superseded')),
        ADD COLUMN superseded_by_id uuid NULL
          REFERENCES content_chunks(id) ON DELETE SET NULL,
        ADD COLUMN superseded_at timestamptz NULL
    `)

    this.addSql(`CREATE INDEX content_chunks_state_idx ON content_chunks (state)`)
  }

  override async down(): Promise<void> {
    this.addSql('DROP INDEX IF EXISTS content_chunks_state_idx')
    this.addSql(`
      ALTER TABLE content_chunks
        DROP COLUMN IF EXISTS state,
        DROP COLUMN IF EXISTS superseded_by_id,
        DROP COLUMN IF EXISTS superseded_at
    `)
  }
}
