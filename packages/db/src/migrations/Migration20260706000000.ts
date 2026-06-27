import { Migration } from '@mikro-orm/migrations'

export class Migration20260706000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE audit_logs (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        user_id uuid,
        action text NOT NULL,
        target_type text NOT NULL,
        target_id text NOT NULL,
        before jsonb,
        after jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT audit_logs_pkey PRIMARY KEY (id)
      )
    `)

    this.addSql(`
      CREATE INDEX audit_logs_created_at_idx
      ON audit_logs (created_at)
    `)

    this.addSql(`
      CREATE INDEX audit_logs_user_id_idx
      ON audit_logs (user_id)
    `)
  }

  override async down(): Promise<void> {
    this.addSql('DROP INDEX IF EXISTS audit_logs_user_id_idx')
    this.addSql('DROP INDEX IF EXISTS audit_logs_created_at_idx')
    this.addSql('DROP TABLE IF EXISTS audit_logs CASCADE')
  }
}
