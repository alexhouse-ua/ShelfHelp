# Database Schema

This section defines the concrete PostgreSQL database schema for the AI Reading Sommelier.

## Core Tables

### books Table

```sql
CREATE TABLE books (
    -- Core Identifiers
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goodreads_id TEXT UNIQUE,
    isbn TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

    -- Bibliographic Data
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    page_count INTEGER,
    publisher TEXT,
    publication_date DATE,
    series_name TEXT,
    series_number INTEGER,
    cover_image_url TEXT,
    goodreads_link TEXT,

    -- User Data (from Goodreads RSS)
    user_shelves TEXT[],
    user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5),
    user_date_added TIMESTAMP WITH TIME ZONE,
    user_date_finished TIMESTAMP WITH TIME ZONE,

    -- Classification & Thematic Data (Enriched)
    genres_primary TEXT[],
    genres_secondary TEXT[],
    tropes TEXT[],
    themes TEXT[],
    keywords TEXT[],
    target_audience TEXT,

    -- Stylistic & Structural Data (Enriched)
    pacing TEXT,
    tone TEXT,
    writing_style TEXT,
    pov_type TEXT,
    pov_gender TEXT,
    spice_level TEXT,

    -- System & AI-Generated Data
    status TEXT CHECK (status IN ('to_read', 'currently_reading', 'finished', 'dnf')),
    queue_position INTEGER,
    availability TEXT,
    hype_flag BOOLEAN DEFAULT false,
    ai_summary TEXT,
    ai_rating DECIMAL(3,2) CHECK (ai_rating >= 0 AND ai_rating <= 10),
    embedding VECTOR(768) -- For Google Gemini embeddings
);
```

### Supporting Tables

```sql
CREATE TABLE reflections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID REFERENCES books(id) ON DELETE CASCADE,
    user_reflection TEXT NOT NULL,
    ai_analysis JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    preference_type TEXT NOT NULL,
    preference_value JSONB NOT NULL,
    confidence_score DECIMAL(3,2),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE conversational_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    state_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE book_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID REFERENCES books(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    event_data JSONB,
    occurred_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

## Indexes and Performance

```sql
-- Core search indexes
CREATE INDEX idx_books_title ON books USING GIN (to_tsvector('english', title));
CREATE INDEX idx_books_author ON books USING GIN (to_tsvector('english', author));
CREATE INDEX idx_books_status ON books (status);
CREATE INDEX idx_books_queue_position ON books (queue_position) WHERE queue_position IS NOT NULL;

-- Vector similarity search
CREATE INDEX idx_books_embedding ON books USING ivfflat (embedding vector_cosine_ops);

-- Foreign key indexes
CREATE INDEX idx_reflections_book_id ON reflections (book_id);
CREATE INDEX idx_book_events_book_id ON book_events (book_id);

-- Session management
CREATE INDEX idx_conversational_state_session ON conversational_state (session_id);
CREATE INDEX idx_conversational_state_expires ON conversational_state (expires_at);
```

## Data Constraints and Business Rules

1. **Book Uniqueness**: Books are uniquely identified by `goodreads_id` when available
2. **Rating Ranges**: User ratings (1-5), AI ratings (0-10)
3. **Status Transitions**: Only valid status transitions are enforced at application level
4. **Vector Dimensions**: Embeddings use 768-dimensional vectors (Google Gemini compatible)
5. **Cascading Deletes**: Book deletion removes associated reflections and events
