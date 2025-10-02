-- Migration: Fix publication date schema
-- Story: 1.7 Production Deployment - QA Fixes
-- Date: 2025-10-02
--
-- Changes:
-- 1. Rename publication_date to publication_year (integer)
-- 2. Add new publication_date column (nullable date for AI enrichment)
-- 3. Extract year from existing publication_date values

-- Step 1: Add new publication_year column
ALTER TABLE books ADD COLUMN IF NOT EXISTS publication_year INTEGER;

-- Step 2: Migrate existing data (extract year from publication_date)
UPDATE books
SET publication_year = EXTRACT(YEAR FROM publication_date::date)::integer
WHERE publication_date IS NOT NULL;

-- Step 3: Rename old publication_date to publication_date_old (for backup)
ALTER TABLE books RENAME COLUMN publication_date TO publication_date_old;

-- Step 4: Add new publication_date column (nullable, for AI-enriched exact dates)
ALTER TABLE books ADD COLUMN publication_date DATE;

-- Step 5: Add comment for clarity
COMMENT ON COLUMN books.publication_year IS 'Year of publication (from Goodreads/CSV)';
COMMENT ON COLUMN books.publication_date IS 'Exact publication date (to be enriched by AI for queue priority)';
COMMENT ON COLUMN books.publication_date_old IS 'Backup of original publication_date column (YYYY-01-01 format) - safe to drop after verification';

-- Step 6: Create index on publication_year for performance
CREATE INDEX IF NOT EXISTS idx_books_publication_year ON books(publication_year);
