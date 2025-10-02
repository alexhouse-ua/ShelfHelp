-- Cleanup RSS-Imported Books with Errors
-- Story: 1.7 Production Deployment - QA Fixes
-- Date: 2025-10-02
--
-- Purpose: Delete RSS-imported books so they can be re-imported with fixes
--
-- Issues being fixed:
-- 1. status = 'to_read' should be 'finished' (RSS pulls from "read" shelf)
-- 2. Improved series parsing
-- 3. CDATA URL extraction
-- 4. publication_year schema

-- =============================================================================
-- Delete RSS-imported books (they have cover_image_url, unlike CSV imports)
-- =============================================================================
DELETE FROM books
WHERE goodreads_id IS NOT NULL
  AND cover_image_url IS NOT NULL
  AND created_at < TIMESTAMP '2025-10-02 23:59:59';

-- =============================================================================
-- Verify deletion
-- =============================================================================
SELECT COUNT(*) as remaining_books FROM books;
-- Expected: Should show very few books (maybe some manual additions)
