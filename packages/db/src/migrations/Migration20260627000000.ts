import { Migration } from '@mikro-orm/migrations'

export class Migration20260627000000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE content_sources (
        id uuid NOT NULL,
        certification_id uuid NOT NULL,
        type text NOT NULL,
        url text NOT NULL,
        enabled boolean NOT NULL DEFAULT true,
        last_fetched_at timestamptz NULL,
        recheck_interval_minutes integer NOT NULL,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL,
        CONSTRAINT content_sources_pkey PRIMARY KEY (id),
        CONSTRAINT content_sources_type_check
          CHECK (type IN ('web', 'pdf', 'youtube', 'reddit', 'github', 'podcast', 'anki', 'quizlet'))
      )
    `)

    this.addSql(`
      CREATE TABLE content_chunks (
        id uuid NOT NULL,
        content_source_id uuid NOT NULL,
        certification_id uuid NOT NULL,
        text text NOT NULL,
        content_hash character varying(64) NOT NULL,
        embedding vector(1536) NULL,
        domain_tags jsonb NOT NULL,
        primary_domain text NOT NULL,
        metadata jsonb NOT NULL DEFAULT '{}',
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL,
        CONSTRAINT content_chunks_pkey PRIMARY KEY (id),
        CONSTRAINT content_chunks_content_source_id_fkey
          FOREIGN KEY (content_source_id) REFERENCES content_sources(id) ON DELETE CASCADE,
        CONSTRAINT content_chunks_content_source_hash_unique
          UNIQUE (content_source_id, content_hash)
      )
    `)

    this.addSql(
      'CREATE INDEX content_chunks_embedding_hnsw_idx ON content_chunks USING hnsw (embedding vector_cosine_ops)',
    )
  }

  override async down(): Promise<void> {
    this.addSql('DROP TABLE IF EXISTS content_chunks')
    this.addSql('DROP TABLE IF EXISTS content_sources')
  }
}
