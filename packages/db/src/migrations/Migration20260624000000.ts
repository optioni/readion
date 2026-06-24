import { Migration } from '@mikro-orm/migrations'

export class Migration20260624000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      ALTER TABLE users
      ADD COLUMN display_timezone text NOT NULL DEFAULT 'Europe/Helsinki',
      ADD COLUMN session_default_duration integer NOT NULL DEFAULT 30,
      ADD COLUMN session_default_content_mix text NOT NULL DEFAULT 'balanced',
      ADD COLUMN session_default_difficulty text NOT NULL DEFAULT 'intermediate',
      ADD COLUMN session_default_focus_area text NOT NULL DEFAULT 'auto',
      ADD COLUMN session_default_learning_style text NOT NULL DEFAULT 'weak-area-focus',
      ADD COLUMN deleted_at timestamptz NULL
    `)

    this.addSql(`
      ALTER TABLE users
      ADD CONSTRAINT users_session_default_duration_check
      CHECK (session_default_duration IN (15, 30, 60, 90))
    `)
    this.addSql(`
      ALTER TABLE users
      ADD CONSTRAINT users_session_default_content_mix_check
      CHECK (session_default_content_mix IN ('balanced', 'reading-heavy', 'quiz-heavy'))
    `)
    this.addSql(`
      ALTER TABLE users
      ADD CONSTRAINT users_session_default_difficulty_check
      CHECK (session_default_difficulty IN ('beginner', 'intermediate', 'advanced', 'adaptive'))
    `)
    this.addSql(`
      ALTER TABLE users
      ADD CONSTRAINT users_session_default_focus_area_check
      CHECK (session_default_focus_area IN ('auto', 'weak-areas', 'new-material', 'review'))
    `)
    this.addSql(`
      ALTER TABLE users
      ADD CONSTRAINT users_session_default_learning_style_check
      CHECK (session_default_learning_style IN ('weak-area-focus', 'spaced-repetition', 'scenario-based'))
    `)

    this.addSql('DROP INDEX IF EXISTS users_email_lower_unique')
    this.addSql(
      'CREATE UNIQUE INDEX users_email_lower_active_unique ON users (lower(email)) WHERE deleted_at IS NULL',
    )
  }

  override async down(): Promise<void> {
    this.addSql('DROP INDEX IF EXISTS users_email_lower_active_unique')
    this.addSql('CREATE UNIQUE INDEX users_email_lower_unique ON users (lower(email))')
    this.addSql(`
      ALTER TABLE users
      DROP CONSTRAINT IF EXISTS users_session_default_learning_style_check,
      DROP CONSTRAINT IF EXISTS users_session_default_focus_area_check,
      DROP CONSTRAINT IF EXISTS users_session_default_difficulty_check,
      DROP CONSTRAINT IF EXISTS users_session_default_content_mix_check,
      DROP CONSTRAINT IF EXISTS users_session_default_duration_check,
      DROP COLUMN IF EXISTS deleted_at,
      DROP COLUMN IF EXISTS session_default_learning_style,
      DROP COLUMN IF EXISTS session_default_focus_area,
      DROP COLUMN IF EXISTS session_default_difficulty,
      DROP COLUMN IF EXISTS session_default_content_mix,
      DROP COLUMN IF EXISTS session_default_duration,
      DROP COLUMN IF EXISTS display_timezone
    `)
  }
}
