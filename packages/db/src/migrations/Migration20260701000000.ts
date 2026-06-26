import { Migration } from '@mikro-orm/migrations'

export class Migration20260701000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE study_sessions (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        user_certification_id uuid NOT NULL
          REFERENCES user_certifications(id) ON DELETE CASCADE,
        user_id uuid NOT NULL
          REFERENCES users(id) ON DELETE CASCADE,
        kind text NOT NULL DEFAULT 'study'
          CHECK (kind IN ('study', 'review')),
        status text NOT NULL DEFAULT 'active'
          CHECK (status IN ('active', 'completed', 'partial', 'abandoned')),
        duration_minutes integer NOT NULL,
        content_mix text NOT NULL,
        difficulty text NOT NULL,
        focus_area jsonb NOT NULL,
        learning_style text NOT NULL,
        last_item_index integer NOT NULL DEFAULT 0,
        started_at timestamptz NOT NULL,
        ended_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT study_sessions_pkey PRIMARY KEY (id)
      )
    `)

    this.addSql(`
      CREATE UNIQUE INDEX study_sessions_one_active_per_enrollment
      ON study_sessions (user_certification_id)
      WHERE status = 'active'
    `)

    this.addSql(`
      CREATE INDEX study_sessions_user_id_idx
      ON study_sessions (user_id)
    `)

    this.addSql(`
      CREATE INDEX study_sessions_user_certification_id_idx
      ON study_sessions (user_certification_id)
    `)

    this.addSql(`
      CREATE TABLE session_items (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        session_id uuid NOT NULL
          REFERENCES study_sessions(id) ON DELETE CASCADE,
        index integer NOT NULL,
        type text NOT NULL
          CHECK (type IN ('reading', 'quiz', 'video')),
        content text NOT NULL,
        completed boolean NOT NULL DEFAULT false,
        source_chunk_ids jsonb NOT NULL DEFAULT '[]',
        supporting_spans jsonb NOT NULL DEFAULT '[]',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT session_items_pkey PRIMARY KEY (id),
        CONSTRAINT session_items_session_index_unique UNIQUE (session_id, index)
      )
    `)

    this.addSql(`
      CREATE INDEX session_items_session_id_idx
      ON session_items (session_id)
    `)
  }

  override async down(): Promise<void> {
    this.addSql('DROP INDEX IF EXISTS session_items_session_id_idx')
    this.addSql('DROP TABLE IF EXISTS session_items CASCADE')
    this.addSql('DROP INDEX IF EXISTS study_sessions_user_certification_id_idx')
    this.addSql('DROP INDEX IF EXISTS study_sessions_user_id_idx')
    this.addSql('DROP INDEX IF EXISTS study_sessions_one_active_per_enrollment')
    this.addSql('DROP TABLE IF EXISTS study_sessions CASCADE')
  }
}
