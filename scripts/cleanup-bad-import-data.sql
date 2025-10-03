-- Data Cleanup Script for Bad CSV Import
-- Story: 1.7 Production Deployment - QA Fixes
-- Date: 2025-10-02
--
-- Purpose: Clean up bad data from initial CSV import before re-importing
--
-- Issues Fixed:
-- 1. [object Object] titles
-- 2. CDATA-wrapped URLs
-- 3. publication_date → publication_year schema
-- 4. to-read books that should be finished
-- 5. Incorrect series parsing

-- =============================================================================
-- BACKUP FIRST - Create backup table
-- =============================================================================
CREATE TABLE IF NOT EXISTS books_backup_20251002 AS
SELECT * FROM books
WHERE goodreads_id IS NOT NULL;

-- =============================================================================
-- Step 1: Delete books with [object Object] titles (66 rows)
-- =============================================================================
DELETE FROM books
WHERE title = '[object Object]'
  AND goodreads_id IS NOT NULL;

-- =============================================================================
-- Step 2: Fix CDATA-wrapped URLs (if any exist in production)
-- =============================================================================
-- Note: This was in RSS data, not CSV, so may not be in production yet
-- Keeping for safety in case RSS ingestion added some

UPDATE books
SET cover_image_url =
  CASE
    WHEN cover_image_url LIKE '{%__cdata%'
    THEN (cover_image_url::jsonb->>'__cdata')::text
    ELSE cover_image_url
  END
WHERE cover_image_url LIKE '{%__cdata%';

UPDATE books
SET goodreads_link =
  CASE
    WHEN goodreads_link LIKE '{%__cdata%'
    THEN (goodreads_link::jsonb->>'__cdata')::text
    ELSE goodreads_link
  END
WHERE goodreads_link LIKE '{%__cdata%';

-- =============================================================================
-- Step 3: Delete all books from initial CSV import (safe re-import)
-- =============================================================================
-- This allows clean re-import with fixed parsers
-- Only deletes books that came from CSV (have goodreads_id, no cover_image_url)

DELETE FROM books
WHERE goodreads_id IS NOT NULL
  AND cover_image_url IS NULL  -- CSV imports don't have cover images
  AND created_at < '2025-10-02 23:59:59'::timestamp;  -- Before fix deployment

-- =============================================================================
-- Step 4: Fix incorrectly categorized to-read books
-- =============================================================================
-- Books with user_rating but marked as to_read should be finished
UPDATE books
SET status = 'finished'
WHERE status = 'to_read'
  AND user_rating IS NOT NULL
  AND user_rating BETWEEN 1 AND 5
  AND user_date_finished IS NOT NULL;

-- =============================================================================
-- Step 5: Verify cleanup results
-- =============================================================================
-- Check backup was created
SELECT
  'books_backup_20251002' as table_name,
  COUNT(*) as record_count
FROM books_backup_20251002;

-- Check [object Object] titles removed
SELECT COUNT(*) as object_object_count
FROM books
WHERE title = '[object Object]';

-- Check books ready for re-import
SELECT
  COUNT(*) as remaining_books,
  COUNT(CASE WHEN goodreads_id IS NOT NULL THEN 1 END) as goodreads_books,
  COUNT(CASE WHEN title = '[object Object]' THEN 1 END) as bad_titles
FROM books;

-- =============================================================================
-- ROLLBACK PROCEDURE (if something goes wrong)
-- =============================================================================
-- To restore from backup:
--
-- DELETE FROM books WHERE goodreads_id IS NOT NULL;
-- INSERT INTO books SELECT * FROM books_backup_20251002;
-- DROP TABLE books_backup_20251002;
