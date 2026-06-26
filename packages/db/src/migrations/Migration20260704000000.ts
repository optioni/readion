import { Migration } from '@mikro-orm/migrations'

export class Migration20260704000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      ALTER TABLE user_certifications
      ADD COLUMN IF NOT EXISTS diagnostic_re_prompted_at timestamptz
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`
      ALTER TABLE user_certifications
      DROP COLUMN IF EXISTS diagnostic_re_prompted_at
    `)
  }
}
