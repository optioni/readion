import { Migration } from '@mikro-orm/migrations'

export class Migration20260625000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE certifications (
        id uuid NOT NULL,
        name text NOT NULL,
        provider text NOT NULL,
        code text NOT NULL,
        domains jsonb NOT NULL,
        question_count integer NOT NULL,
        passing_score real NOT NULL,
        time_limit_minutes integer NOT NULL,
        state text NOT NULL DEFAULT 'draft',
        provenance jsonb NOT NULL,
        verified_at timestamptz NULL,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL,
        CONSTRAINT certifications_pkey PRIMARY KEY (id),
        CONSTRAINT certifications_state_check CHECK (state IN ('draft', 'live'))
      )
    `)
    this.addSql('CREATE UNIQUE INDEX certifications_code_unique ON certifications (code)')
  }

  override async down(): Promise<void> {
    this.addSql('DROP TABLE IF EXISTS certifications')
  }
}
