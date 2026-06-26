import { Migration } from '@mikro-orm/migrations'

export class Migration20260703000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE mock_exams (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL
          REFERENCES users(id) ON DELETE CASCADE,
        user_certification_id uuid NOT NULL
          REFERENCES user_certifications(id) ON DELETE CASCADE,
        type text NOT NULL DEFAULT 'mock'
          CHECK (type IN ('mock', 'diagnostic')),
        status text NOT NULL DEFAULT 'in_progress'
          CHECK (status IN ('in_progress', 'submitted', 'expired')),
        started_at timestamptz,
        deadline timestamptz,
        score double precision,
        passed boolean,
        domain_breakdown jsonb NOT NULL DEFAULT '{}',
        questions jsonb NOT NULL DEFAULT '[]',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT mock_exams_pkey PRIMARY KEY (id)
      )
    `)

    this.addSql(`
      CREATE INDEX mock_exams_user_certification_id_idx
      ON mock_exams (user_certification_id)
    `)

    this.addSql(`
      CREATE INDEX mock_exams_status_idx
      ON mock_exams (status)
    `)

    this.addSql(`
      CREATE INDEX mock_exams_deadline_idx
      ON mock_exams (deadline)
      WHERE deadline IS NOT NULL
    `)
  }

  override async down(): Promise<void> {
    this.addSql('DROP INDEX IF EXISTS mock_exams_deadline_idx')
    this.addSql('DROP INDEX IF EXISTS mock_exams_status_idx')
    this.addSql('DROP INDEX IF EXISTS mock_exams_user_certification_id_idx')
    this.addSql('DROP TABLE IF EXISTS mock_exams CASCADE')
  }
}
