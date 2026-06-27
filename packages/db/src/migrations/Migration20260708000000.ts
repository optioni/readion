import { Migration } from '@mikro-orm/migrations'

export class Migration20260708000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      ALTER TABLE user_certifications
      ADD COLUMN IF NOT EXISTS last_digest_readiness real
    `)
    this.addSql(`
      ALTER TABLE user_certifications
      ADD COLUMN IF NOT EXISTS exam_outcome_nudge_sent_at timestamptz
    `)
    this.addSql(`
      ALTER TABLE user_certifications
      ADD COLUMN IF NOT EXISTS exam_outcome_nudge_count int NOT NULL DEFAULT 0
    `)
    this.addSql(`
      ALTER TABLE user_certifications
      ADD COLUMN IF NOT EXISTS exam_outcome_response text
        CHECK (exam_outcome_response IN ('passed', 'did_not_pass', 'not_yet', 'dismissed'))
    `)
    this.addSql(`
      ALTER TABLE user_certifications
      ADD COLUMN IF NOT EXISTS exam_outcome_responded_at timestamptz
    `)
  }

  override async down(): Promise<void> {
    this.addSql('ALTER TABLE user_certifications DROP COLUMN IF EXISTS exam_outcome_responded_at')
    this.addSql('ALTER TABLE user_certifications DROP COLUMN IF EXISTS exam_outcome_response')
    this.addSql('ALTER TABLE user_certifications DROP COLUMN IF EXISTS exam_outcome_nudge_count')
    this.addSql('ALTER TABLE user_certifications DROP COLUMN IF EXISTS exam_outcome_nudge_sent_at')
    this.addSql('ALTER TABLE user_certifications DROP COLUMN IF EXISTS last_digest_readiness')
  }
}
