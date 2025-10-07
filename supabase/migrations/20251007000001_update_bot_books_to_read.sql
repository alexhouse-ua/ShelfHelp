-- Update books added via bot from 'pending' to 'to_read'
-- So they appear in /recommend searches

UPDATE books
SET status = 'to_read'
WHERE status = 'pending'
  AND ingestion_source = 'bot';

-- Also update any other pending books that should be in TBR
-- (This ensures backward compatibility with any existing bot-added books)
