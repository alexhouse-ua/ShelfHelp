-- Story 1.5.2: Hardcover Migration Schema Changes
-- Creates tables and fields needed for Hardcover data ingestion and book matching

-- ============================================================================
-- ALTER BOOKS TABLE: Add Hardcover Integration Fields
-- ============================================================================

-- Add Hardcover-specific identifiers and enrichment fields
ALTER TABLE books
ADD COLUMN IF NOT EXISTS hardcover_id INTEGER UNIQUE,
ADD COLUMN IF NOT EXISTS moods TEXT[],
ADD COLUMN IF NOT EXISTS content_warnings TEXT[],
ADD COLUMN IF NOT EXISTS users_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ratings_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS lists_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS series_position DECIMAL(4,2),
ADD COLUMN IF NOT EXISTS edition_id INTEGER,
ADD COLUMN IF NOT EXISTS physical_format TEXT,
ADD COLUMN IF NOT EXISTS data_source TEXT DEFAULT 'goodreads';

-- Create index for Hardcover lookups
CREATE INDEX IF NOT EXISTS idx_books_hardcover_id ON books(hardcover_id);

-- ============================================================================
-- READING SESSIONS TABLE: Track calculated reading sessions
-- ============================================================================

CREATE TABLE IF NOT EXISTS reading_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    hardcover_activity_id TEXT,  -- Reference to source activity (if from Hardcover)
    session_start TIMESTAMP WITH TIME ZONE NOT NULL,
    session_end TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
    pages_read INTEGER NOT NULL CHECK (pages_read > 0),
    start_page INTEGER,
    end_page INTEGER,
    reading_speed_ppm DECIMAL(5,2),  -- Pages per minute
    data_source TEXT DEFAULT 'hardcover',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reading_sessions_book_id ON reading_sessions(book_id);
CREATE INDEX IF NOT EXISTS idx_reading_sessions_start ON reading_sessions(session_start DESC);
CREATE INDEX IF NOT EXISTS idx_reading_sessions_hardcover_activity_id ON reading_sessions(hardcover_activity_id);

-- ============================================================================
-- BOOK ACTIVITIES TABLE: Raw activity timeline from Hardcover
-- ============================================================================

CREATE TABLE IF NOT EXISTS book_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    hardcover_activity_id TEXT UNIQUE NOT NULL,  -- Deduplication key
    activity_type TEXT NOT NULL CHECK (activity_type IN (
        'added', 'started', 'finished', 'rated', 'abandoned', 'progress_update'
    )),
    activity_date TIMESTAMP WITH TIME ZONE NOT NULL,
    metadata JSONB,  -- Stores page_progress, rating_value, status, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_book_activities_book_id ON book_activities(book_id);
CREATE INDEX IF NOT EXISTS idx_book_activities_date ON book_activities(activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_book_activities_type ON book_activities(activity_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_book_activities_hardcover_id ON book_activities(hardcover_activity_id);

-- ============================================================================
-- HARDCOVER LISTS TABLE: User's Hardcover lists
-- ============================================================================

CREATE TABLE IF NOT EXISTS hardcover_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hardcover_list_id INTEGER UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hardcover_lists_hardcover_id ON hardcover_lists(hardcover_list_id);

-- ============================================================================
-- HARDCOVER LIST BOOKS TABLE: Books in Hardcover lists
-- ============================================================================

CREATE TABLE IF NOT EXISTS hardcover_list_books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id UUID NOT NULL REFERENCES hardcover_lists(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    position INTEGER,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(list_id, book_id)  -- Prevent duplicate book entries in same list
);

CREATE INDEX IF NOT EXISTS idx_hardcover_list_books_list_id ON hardcover_list_books(list_id);
CREATE INDEX IF NOT EXISTS idx_hardcover_list_books_book_id ON hardcover_list_books(book_id);

-- ============================================================================
-- MIGRATION LOG TABLE: Track book matching decisions and manual review queue
-- ============================================================================

CREATE TABLE IF NOT EXISTS migration_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'manual_review', 'failed')),
    goodreads_book_id INTEGER,
    hardcover_book_id INTEGER,
    match_method TEXT,  -- 'isbn', 'exact', 'fuzzy'
    confidence DECIMAL(3,2),  -- 0.00 to 1.00
    fuzzy_matches JSONB,  -- Top 5 fuzzy match candidates for manual review
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_migration_log_status ON migration_log(status);
CREATE INDEX IF NOT EXISTS idx_migration_log_goodreads_id ON migration_log(goodreads_book_id);
CREATE INDEX IF NOT EXISTS idx_migration_log_hardcover_id ON migration_log(hardcover_book_id);
CREATE INDEX IF NOT EXISTS idx_migration_log_created_at ON migration_log(created_at DESC);

-- ============================================================================
-- ENABLE POSTGRESQL TRIGRAM EXTENSION: For fuzzy book matching
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- FUZZY BOOK MATCH FUNCTION: For book matching with pg_trgm similarity
-- ============================================================================

CREATE OR REPLACE FUNCTION fuzzy_book_match(
  search_title TEXT,
  search_author TEXT,
  match_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  id INTEGER,
  title TEXT,
  score REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    hardcover_id::INTEGER as id,
    books.title,
    similarity(books.title, search_title) as score
  FROM books
  WHERE
    hardcover_id IS NOT NULL
    AND books.author ILIKE '%' || search_author || '%'
    AND similarity(books.title, search_title) > 0.3
  ORDER BY score DESC
  LIMIT match_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

COMMENT ON TABLE reading_sessions IS 'Story 1.5.2: Calculated reading sessions from activity deltas';
COMMENT ON TABLE book_activities IS 'Story 1.5.2: Raw activity timeline from Hardcover API';
COMMENT ON TABLE hardcover_lists IS 'Story 1.5.2: User lists from Hardcover';
COMMENT ON TABLE hardcover_list_books IS 'Story 1.5.2: Books in Hardcover lists';
COMMENT ON TABLE migration_log IS 'Story 1.5.2: Book matching decisions and manual review queue';
