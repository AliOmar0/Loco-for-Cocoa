CREATE TABLE IF NOT EXISTS archive_state (
  owner_email TEXT PRIMARY KEY,
  recipes JSONB NOT NULL DEFAULT '[]'::jsonb,
  collections JSONB NOT NULL DEFAULT '[]'::jsonb,
  version BIGINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS archive_revisions (
  id BIGSERIAL PRIMARY KEY,
  owner_email TEXT NOT NULL,
  recipes JSONB NOT NULL,
  collections JSONB NOT NULL,
  version BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS archive_revisions_owner_created_idx
  ON archive_revisions (owner_email, created_at DESC);
