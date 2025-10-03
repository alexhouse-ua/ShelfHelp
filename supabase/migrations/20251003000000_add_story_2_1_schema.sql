-- Migration for Story 2.1: TBR Queue Prioritization
-- Adds: deadlines table, priority_score, last_score_calculated to books table

-- 1. Create deadlines table for future constraints (book clubs, library holds, etc.)
CREATE TABLE deadlines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID REFERENCES books(id) ON DELETE CASCADE NOT NULL,

    -- Deadline details
    deadline_date TIMESTAMP WITH TIME ZONE NOT NULL,
    deadline_type TEXT NOT NULL CHECK (deadline_type IN ('book_club', 'library_hold', 'reading_challenge', 'personal')),

    -- Metadata
    title TEXT,  -- e.g., "Mystery Book Club", "Main Library"
    description TEXT,  -- Additional context

    -- Status tracking
    status TEXT CHECK (status IN ('active', 'completed', 'cancelled')) DEFAULT 'active',
    completed_at TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for deadline queries
CREATE INDEX idx_deadlines_book_id ON deadlines(book_id);
CREATE INDEX idx_deadlines_date_active ON deadlines(deadline_date) WHERE status = 'active';
CREATE INDEX idx_deadlines_status ON deadlines(status);

-- 2. Add priority scoring fields to books table
ALTER TABLE books
ADD COLUMN priority_score DECIMAL(5,4) CHECK (priority_score >= 0 AND priority_score <= 1),
ADD COLUMN last_score_calculated TIMESTAMP WITH TIME ZONE;

-- Index for priority-based queue queries
CREATE INDEX idx_books_priority_score ON books(priority_score DESC NULLS LAST) WHERE status = 'to_read';

-- 3. Add avg_pages_per_day to user_preferences for reading speed calculation
-- Store as JSONB value under preference_key = 'reading_pace'
-- Example: { "avg_pages_per_day": 50, "last_calculated": "2025-10-03T00:00:00Z", "sample_size": 10 }

-- 4. Add comment documentation
COMMENT ON TABLE deadlines IS 'Tracks future deadlines/commitments for books (book clubs, library holds, etc.)';
COMMENT ON COLUMN deadlines.deadline_type IS 'Type of deadline: book_club, library_hold, reading_challenge, personal';
COMMENT ON COLUMN deadlines.status IS 'Status: active (upcoming), completed (finished), cancelled (no longer relevant)';
COMMENT ON COLUMN books.priority_score IS 'Calculated priority score (0-1) for TBR queue ordering. Higher = higher priority.';
COMMENT ON COLUMN books.last_score_calculated IS 'Timestamp when priority_score was last calculated';
