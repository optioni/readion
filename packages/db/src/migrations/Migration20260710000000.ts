import { Migration } from '@mikro-orm/migrations'

export class Migration20260710000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      ALTER TABLE session_items
      ADD COLUMN IF NOT EXISTS domain text NOT NULL DEFAULT ''
    `)
  }

  override async down(): Promise<void> {
    this.addSql('ALTER TABLE session_items DROP COLUMN IF EXISTS domain')
  }
}
