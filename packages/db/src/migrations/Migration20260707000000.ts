import { Migration } from '@mikro-orm/migrations'

export class Migration20260707000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS digest_opt_out boolean NOT NULL DEFAULT false
    `)
    this.addSql(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS unsubscribe_token text
    `)
    this.addSql(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS last_digest_sent_at timestamptz
    `)
  }

  override async down(): Promise<void> {
    this.addSql('ALTER TABLE users DROP COLUMN IF EXISTS last_digest_sent_at')
    this.addSql('ALTER TABLE users DROP COLUMN IF EXISTS unsubscribe_token')
    this.addSql('ALTER TABLE users DROP COLUMN IF EXISTS digest_opt_out')
  }
}
