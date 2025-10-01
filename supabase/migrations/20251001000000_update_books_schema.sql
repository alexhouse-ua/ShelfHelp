-- Update books table schema for Story 1.5
-- 1. Remove user_shelves column (RSS-only, not needed)
-- 2. Update status field to use 'to_read' instead of 'pending'

-- Remove user_shelves column
ALTER TABLE books DROP COLUMN IF EXISTS user_shelves;

-- Drop existing status constraint
ALTER TABLE books DROP CONSTRAINT IF EXISTS books_status_check;

-- Update status field with new valid values
-- Changed 'pending' to 'to_read', added 'finished' and 'currently_reading'
ALTER TABLE books ADD CONSTRAINT books_status_check
  CHECK (status IN ('to_read', 'currently_reading', 'finished', 'processing', 'enriched', 'failed'));

-- Update existing 'pending' records to 'to_read' (if any exist)
UPDATE books SET status = 'to_read' WHERE status = 'pending';

-- Update default value to 'to_read'
ALTER TABLE books ALTER COLUMN status SET DEFAULT 'to_read';
