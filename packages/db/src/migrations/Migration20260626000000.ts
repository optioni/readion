import { Migration } from '@mikro-orm/migrations'

export class Migration20260626000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE user_certifications (
        id uuid NOT NULL,
        user_id uuid NOT NULL,
        certification_id uuid NOT NULL,
        status text NOT NULL DEFAULT 'active',
        enrolled_at timestamptz NOT NULL,
        session_override_duration integer NULL,
        session_override_content_mix text NULL,
        session_override_difficulty text NULL,
        session_override_focus_area text NULL,
        session_override_learning_style text NULL,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL,
        CONSTRAINT user_certifications_pkey PRIMARY KEY (id),
        CONSTRAINT user_certifications_user_id_fkey
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT user_certifications_certification_id_fkey
          FOREIGN KEY (certification_id) REFERENCES certifications(id),
        CONSTRAINT user_certifications_status_check
          CHECK (status IN ('active', 'archived')),
        CONSTRAINT user_certifications_session_override_duration_check
          CHECK (session_override_duration IN (15, 30, 60, 90)),
        CONSTRAINT user_certifications_session_override_content_mix_check
          CHECK (session_override_content_mix IN ('balanced', 'reading-heavy', 'quiz-heavy')),
        CONSTRAINT user_certifications_session_override_difficulty_check
          CHECK (session_override_difficulty IN ('beginner', 'intermediate', 'advanced', 'adaptive')),
        CONSTRAINT user_certifications_session_override_focus_area_check
          CHECK (session_override_focus_area IN ('auto', 'weak-areas', 'new-material', 'review')),
        CONSTRAINT user_certifications_session_override_learning_style_check
          CHECK (session_override_learning_style IN ('weak-area-focus', 'spaced-repetition', 'scenario-based'))
      )
    `)

    this.addSql(
      'CREATE UNIQUE INDEX user_certifications_user_certification_unique ON user_certifications (user_id, certification_id)',
    )
  }

  override async down(): Promise<void> {
    this.addSql('DROP TABLE IF EXISTS user_certifications')
  }
}
