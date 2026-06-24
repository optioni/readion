import { Migration } from '@mikro-orm/migrations'

export class Migration20260623000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE users (
        id uuid NOT NULL,
        email text NOT NULL,
        password_hash text NOT NULL,
        email_verified boolean NOT NULL DEFAULT false,
        role text NOT NULL DEFAULT 'user',
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL,
        CONSTRAINT users_pkey PRIMARY KEY (id),
        CONSTRAINT users_role_check CHECK (role IN ('user', 'admin'))
      )
    `)
    this.addSql('CREATE UNIQUE INDEX users_email_lower_unique ON users (lower(email))')
  }

  override async down(): Promise<void> {
    this.addSql('DROP TABLE IF EXISTS users')
  }
}
