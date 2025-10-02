# CSV Re-Import Procedure

**Date:** October 2, 2025
**Story:** 1.7 Production Deployment - QA Fixes
**Purpose:** Safe re-import of historical CSV data with all fixes applied

## Issues Fixed in This Release

1. **[object Object] Titles** - 66 rows had corrupt titles
2. **Improper URL Import** - CDATA wrappers in URLs: `{"__cdata":"https://..."}`
3. **Publication Date Schema** - Changed from `publication_date` (YYYY-01-01) to `publication_year` (integer)
4. **Series Parsing** - Enhanced to handle all Goodreads formats:
   - `(Series, #N)` - Standard with comma
   - `(Series #N)` - Without comma
   - `(Series Book N)` - "Book" keyword
   - `(Series)` - Name only, no number
   - `(Series, #0.1-0.5)` - Range numbers
5. **to-read Misclassification** - Books with ratings marked as to-read

## Pre-Requisites

- ✅ Database migration applied (`20251002140000_fix_publication_date_schema.sql`)
- ✅ Updated `csv-backfill` function deployed with fixes
- ✅ Updated `rss-ingestion` function deployed with matching changes
- ✅ Backup of current production data created

## Step-by-Step Procedure

### Step 1: Apply Database Migration

```bash
# Push new migration to production
supabase db push
```

Expected: Migration `20251002140000_fix_publication_date_schema.sql` applied successfully.

**Migration creates:**

- `publication_year` column (integer)
- `publication_date` column (nullable date)
- `publication_date_old` column (backup of original data)

### Step 2: Run Data Cleanup Script

```bash
# Execute cleanup on production database
psql <production-connection-string> -f scripts/cleanup-bad-import-data.sql
```

**Or via Supabase Dashboard:**

1. Go to Database → SQL Editor
2. Copy contents of `scripts/cleanup-bad-import-data.sql`
3. Execute query

**Cleanup actions:**

- ✅ Creates backup table `books_backup_20251002`
- ✅ Deletes 66 rows with `[object Object]` titles
- ✅ Fixes any CDATA-wrapped URLs (if present)
- ✅ Deletes all CSV-imported books (for clean re-import)
- ✅ Fixes to-read books with ratings → changed to finished

**Verification queries included in script.**

### Step 3: Deploy Updated Functions

```bash
# Deploy both updated functions
supabase functions deploy csv-backfill rss-ingestion
```

**Changes deployed:**

- Enhanced series parser (4 patterns)
- `String()` coercion for [object Object] prevention
- `extractUrl()` helper for CDATA unwrapping
- `publication_year` instead of `publication_date`
- `parseSeriesNumber()` for range handling

### Step 4: Re-Import CSV Data

```bash
# Get production credentials
export PROJECT_REF="wyzuelwotgyoautxjpxv"
export ANON_KEY="<your-anon-key>"

# Invoke csv-backfill function
curl -X POST "https://${PROJECT_REF}.supabase.co/functions/v1/csv-backfill" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  2>/dev/null | jq '.'
```

**Expected response:**

```json
{
  "success": true,
  "booksImported": 421,
  "booksUpdated": 0,
  "booksFiltered": 165,
  "errors": 0,
  "totalRows": 612
}
```

**Note:** `errors` should now be `0` (was 26 before fixes).

### Step 5: Verify Data Quality

```sql
-- Check no [object Object] titles
SELECT COUNT(*) FROM books WHERE title = '[object Object]';
-- Expected: 0

-- Check no CDATA-wrapped URLs
SELECT COUNT(*) FROM books
WHERE cover_image_url LIKE '{%__cdata%'
   OR goodreads_link LIKE '{%__cdata%';
-- Expected: 0

-- Check publication_year populated
SELECT COUNT(*) as with_year,
       COUNT(publication_date) as with_date
FROM books
WHERE goodreads_id IS NOT NULL;
-- Expected: with_year > 0, with_date = 0 (date is for AI enrichment)

-- Check series parsing improved
SELECT
  title,
  series_name,
  series_number
FROM books
WHERE goodreads_id IN ('214568110', '211373244', '176623687');
-- Expected:
-- Flock | The Ravenhood | 1
-- Audacity | Seraph | null
-- The Assassin's Blade | Throne of Glass | 0.1

-- Check total book count
SELECT COUNT(*) as total_books FROM books;
-- Expected: ~430 (421 from CSV + ~9 from RSS)

-- Check status distribution
SELECT status, COUNT(*) as count
FROM books
GROUP BY status
ORDER BY count DESC;
-- Expected: finished > to_read, no misclassified books
```

### Step 6: Test RSS Ingestion

```bash
# Manually trigger RSS ingestion to verify
curl -X POST "https://${PROJECT_REF}.supabase.co/functions/v1/rss-ingestion" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  2>/dev/null | jq '.'
```

**Expected response:**

```json
{
  "success": true,
  "booksAdded": 0,
  "booksUpdated": 100,
  "errors": 0,
  "errorDetails": []
}
```

**Verify:**

- No CDATA errors in cover_image_url
- Series parsing works correctly
- publication_year used instead of publication_date

## Rollback Procedure

If anything goes wrong during re-import:

```sql
-- Restore from backup
DELETE FROM books WHERE goodreads_id IS NOT NULL;
INSERT INTO books SELECT * FROM books_backup_20251002;
```

**To rollback functions:**

```bash
git checkout 54e5ca6  # Last known good commit
supabase functions deploy csv-backfill rss-ingestion
git checkout main
```

**To rollback migration:**

```sql
-- Reverse schema changes
ALTER TABLE books DROP COLUMN IF EXISTS publication_year;
ALTER TABLE books DROP COLUMN IF EXISTS publication_date;
ALTER TABLE books RENAME COLUMN publication_date_old TO publication_date;
```

## Success Criteria

✅ All 421 books imported with `errors: 0`
✅ Zero books with `[object Object]` titles
✅ Zero CDATA-wrapped URLs
✅ All series parsing examples correct
✅ publication_year populated, publication_date NULL
✅ No to-read books with ratings
✅ RSS ingestion works with new schema

## Post-Deployment Monitoring

1. **Check production logs** for csv-backfill errors
2. **Monitor RSS ingestion** at 2 AM UTC tonight
3. **Review book records** for data quality
4. **Verify backup table** can be dropped after 7 days

## Cleanup After Verification

After confirming re-import success (7+ days):

```sql
-- Drop backup table
DROP TABLE IF EXISTS books_backup_20251002;

-- Drop old publication_date_old column
ALTER TABLE books DROP COLUMN IF EXISTS publication_date_old;
```

## Questions About Re-Reads

**Issue:** Some books were read multiple times (e.g., Ravenhood series read twice).

**Current Behavior:** Only one record per `goodreads_id` (UPSERT keeps latest).

**Options:**

1. **Keep current** - UPSERT by goodreads_id, only latest read preserved
2. **Allow duplicates** - Remove unique constraint on goodreads_id, allow multiple reads
3. **Separate table** - Create `book_reads` table for reading history

**Recommendation:** Implement option 3 in future story - separate `book_reads` table with foreign key to `books` table. This preserves reading history while maintaining single source of truth for book metadata.

**For this re-import:** Duplicates will be merged (latest wins). If you want to preserve all reads, we need a new story to add reading history tracking.
