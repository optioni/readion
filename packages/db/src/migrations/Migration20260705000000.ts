import { Migration } from '@mikro-orm/migrations'

export class Migration20260705000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE agent_conversations (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL
          REFERENCES users(id) ON DELETE CASCADE,
        study_session_id uuid,
        certification_id uuid,
        mode text NOT NULL
          CHECK (mode IN ('in_session', 'standalone')),
        last_activity_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT agent_conversations_pkey PRIMARY KEY (id)
      )
    `)

    this.addSql(`
      CREATE INDEX agent_conversations_user_id_idx
      ON agent_conversations (user_id)
    `)

    this.addSql(`
      CREATE INDEX agent_conversations_study_session_id_idx
      ON agent_conversations (study_session_id)
      WHERE study_session_id IS NOT NULL
    `)

    this.addSql(`
      CREATE INDEX agent_conversations_last_activity_at_idx
      ON agent_conversations (last_activity_at)
    `)

    this.addSql(`
      CREATE TABLE agent_messages (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        conversation_id uuid NOT NULL
          REFERENCES agent_conversations(id) ON DELETE CASCADE,
        role text NOT NULL
          CHECK (role IN ('user', 'assistant', 'tool', 'system')),
        content jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT agent_messages_pkey PRIMARY KEY (id)
      )
    `)

    this.addSql(`
      CREATE INDEX agent_messages_conversation_id_created_at_idx
      ON agent_messages (conversation_id, created_at, id)
    `)
  }

  override async down(): Promise<void> {
    this.addSql('DROP INDEX IF EXISTS agent_messages_conversation_id_created_at_idx')
    this.addSql('DROP TABLE IF EXISTS agent_messages CASCADE')
    this.addSql('DROP INDEX IF EXISTS agent_conversations_last_activity_at_idx')
    this.addSql('DROP INDEX IF EXISTS agent_conversations_study_session_id_idx')
    this.addSql('DROP INDEX IF EXISTS agent_conversations_user_id_idx')
    this.addSql('DROP TABLE IF EXISTS agent_conversations CASCADE')
  }
}
