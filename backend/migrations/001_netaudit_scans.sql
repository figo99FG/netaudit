-- Run this once in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/evabailjnhmulnfdjjlb/sql

CREATE TABLE IF NOT EXISTS netaudit_scans (
    scan_id    TEXT        PRIMARY KEY,
    data       JSONB       NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_netaudit_scans_created ON netaudit_scans (created_at);

-- Row-level security: service_role key bypasses RLS so the backend can
-- read/write freely. Public (anon) cannot touch this table.
ALTER TABLE netaudit_scans ENABLE ROW LEVEL SECURITY;
