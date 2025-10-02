-- Fix series_number to support decimal values
-- Story: 1.7 Production Deployment - QA Fixes
-- Date: 2025-10-02
--
-- Purpose: Change series_number from INTEGER to NUMERIC to support decimal series numbers
--
-- Examples of decimal series numbers:
-- - "Bittersweet Symphony Duet, #2.5" (novella between books 2 and 3)
-- - "Throne of Glass, #0.1-0.5" (prequel collections)

-- =============================================================================
-- Change series_number column type to NUMERIC
-- =============================================================================

-- Drop existing index if it exists
DROP INDEX IF EXISTS idx_books_series;

-- Change column type from INTEGER to NUMERIC(5,2)
-- This supports up to 999.99 for series numbers
ALTER TABLE books
ALTER COLUMN series_number TYPE NUMERIC(5,2)
USING series_number::NUMERIC(5,2);

-- Update column comment
COMMENT ON COLUMN books.series_number IS 'Position in series (supports decimals like 2.5 for novellas)';

-- Recreate index
CREATE INDEX IF NOT EXISTS idx_books_series ON books(series_name, series_number);

-- =============================================================================
-- Verification
-- =============================================================================

-- Check column type changed successfully
SELECT
  column_name,
  data_type,
  numeric_precision,
  numeric_scale
FROM information_schema.columns
WHERE table_name = 'books'
  AND column_name = 'series_number';
-- Expected: data_type = 'numeric', numeric_precision = 5, numeric_scale = 2
