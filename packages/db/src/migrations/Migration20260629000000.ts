import { Migration } from '@mikro-orm/migrations'

export class Migration20260629000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE quiz_responses (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        user_certification_id uuid NOT NULL
          REFERENCES user_certifications(id) ON DELETE CASCADE,
        answer text NOT NULL,
        correct boolean NOT NULL,
        confidence integer NOT NULL CHECK (confidence BETWEEN 1 AND 5),
        time_taken_ms integer NOT NULL CHECK (time_taken_ms >= 0),
        question_snapshot jsonb NOT NULL,
        format text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT quiz_responses_pkey PRIMARY KEY (id)
      )
    `)

    this.addSql(`
      CREATE INDEX quiz_responses_user_certification_id_idx
      ON quiz_responses (user_certification_id)
    `)
  }

  override async down(): Promise<void> {
    this.addSql('DROP INDEX IF EXISTS quiz_responses_user_certification_id_idx')
    this.addSql('DROP TABLE IF EXISTS quiz_responses CASCADE')
  }
}
