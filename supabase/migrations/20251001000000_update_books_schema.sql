-- Update books table schema for Story 1.5
-- 1. Remove user_shelves column (RSS-only, not needed)
-- 2. Expand status field to include both old and new values for compatibility

-- Remove user_shelves column
ALTER TABLE books DROP COLUMN IF EXISTS user_shelves;

-- Drop existing status constraint
DO $$
DECLARE
    constraint_name text;
BEGIN
    FOR constraint_name IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'books'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) LIKE '%status%'
    LOOP
        EXECUTE 'ALTER TABLE books DROP CONSTRAINT IF EXISTS ' || quote_ident(constraint_name);
    END LOOP;
END $$;

-- Add new status constraint with BOTH old and new values for backwards compatibility
-- Keeps 'pending' for compatibility, adds 'to_read', 'currently_reading', 'finished'
ALTER TABLE books ADD CONSTRAINT books_status_check
  CHECK (status IN ('pending', 'to_read', 'currently_reading', 'finished', 'processing', 'enriched', 'failed'));

-- Update existing 'pending' records to 'to_read' (optional migration)
UPDATE books SET status = 'to_read' WHERE status = 'pending';

-- Keep default as 'pending' for now to avoid breaking existing code
-- New code can use 'to_read' explicitly
ALTER TABLE books ALTER COLUMN status SET DEFAULT 'pending';

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
