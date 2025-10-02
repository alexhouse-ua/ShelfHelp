-- Add ingestion_source field to books table
-- Story: 1.7 Production Deployment - QA Fixes
-- Date: 2025-10-02
--
-- Purpose: Track the source of each book record for easier debugging and filtering
--
-- Valid values:
-- - 'rss': From Goodreads RSS feed ingestion
-- - 'csv': From historical CSV backfill
-- - 'manual': Manually added via Supabase table editor
-- - 'bot': Added via Telegram bot interaction

-- =============================================================================
-- Add ingestion_source column with enum type
-- =============================================================================

-- Create enum type for ingestion sources
DO $$ BEGIN
  CREATE TYPE ingestion_source_type AS ENUM ('rss', 'csv', 'manual', 'bot');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add column to books table
ALTER TABLE books
ADD COLUMN IF NOT EXISTS ingestion_source ingestion_source_type;

-- Add comment explaining the field
COMMENT ON COLUMN books.ingestion_source IS 'Source of the book record: rss (Goodreads RSS), csv (historical backfill), manual (Supabase editor), bot (Telegram bot)';

-- =============================================================================
-- Set existing records based on current data patterns
-- =============================================================================

-- Mark CSV imports (have goodreads_id, no cover_image_url)
UPDATE books
SET ingestion_source = 'csv'
WHERE ingestion_source IS NULL
  AND goodreads_id IS NOT NULL
  AND cover_image_url IS NULL;

-- Mark RSS imports (have goodreads_id AND cover_image_url)
UPDATE books
SET ingestion_source = 'rss'
WHERE ingestion_source IS NULL
  AND goodreads_id IS NOT NULL
  AND cover_image_url IS NOT NULL;

-- Mark manual entries (no goodreads_id)
UPDATE books
SET ingestion_source = 'manual'
WHERE ingestion_source IS NULL
  AND goodreads_id IS NULL;

-- =============================================================================
-- Create index for filtering by source
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_books_ingestion_source ON books(ingestion_source);

-- =============================================================================
-- Verification queries
-- =============================================================================

-- Check distribution of ingestion sources
SELECT
  ingestion_source,
  COUNT(*) as count
FROM books
GROUP BY ingestion_source
ORDER BY count DESC;

-- Check for any NULL values (should be 0 after backfill)
SELECT COUNT(*) as null_source_count
FROM books
WHERE ingestion_source IS NULL;
