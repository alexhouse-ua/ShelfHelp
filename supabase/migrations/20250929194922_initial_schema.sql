-- Enable pgvector extension for embedding storage
CREATE EXTENSION IF NOT EXISTS vector;

-- Books table: Core bibliographic and enrichment data
CREATE TABLE books (
    -- Core Identifiers
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goodreads_id INTEGER UNIQUE,
    isbn TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

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
    status TEXT CHECK (status IN ('pending', 'processing', 'enriched', 'failed')) DEFAULT 'pending',
    queue_position INTEGER,
    availability TEXT,
    hype_flag BOOLEAN DEFAULT FALSE,
    ai_summary TEXT,
    ai_rating DECIMAL(3,2),
    embedding VECTOR(768)
);

-- Create indexes for common queries
CREATE INDEX idx_books_goodreads_id ON books(goodreads_id);
CREATE INDEX idx_books_status ON books(status);
CREATE INDEX idx_books_queue_position ON books(queue_position);
CREATE INDEX idx_books_user_shelves ON books USING GIN(user_shelves);

-- Reflections table: User journal entries
CREATE TABLE reflections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID REFERENCES books(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    content TEXT NOT NULL,
    reflection_type TEXT CHECK (reflection_type IN ('thought', 'quote', 'question', 'analysis')),
    page_reference INTEGER,
    embedding VECTOR(768)
);

CREATE INDEX idx_reflections_book_id ON reflections(book_id);
CREATE INDEX idx_reflections_created_at ON reflections(created_at DESC);

-- User preferences table: Personalization settings
CREATE TABLE user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    preference_key TEXT UNIQUE NOT NULL,
    preference_value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_user_preferences_key ON user_preferences(preference_key);

-- Conversational state table: Track bot conversation context
CREATE TABLE conversational_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id BIGINT UNIQUE NOT NULL,
    current_context TEXT,
    last_book_id UUID REFERENCES books(id) ON DELETE SET NULL,
    last_interaction TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    state_data JSONB DEFAULT '{}'::JSONB
);

CREATE INDEX idx_conversational_state_chat_id ON conversational_state(chat_id);
CREATE INDEX idx_conversational_state_last_interaction ON conversational_state(last_interaction DESC);

-- Book events table: Track book-related actions and history
CREATE TABLE book_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID REFERENCES books(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('added', 'enriched', 'queued', 'started', 'finished', 'rated', 'reflected')),
    event_data JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_book_events_book_id ON book_events(book_id);
CREATE INDEX idx_book_events_type ON book_events(event_type);
CREATE INDEX idx_book_events_created_at ON book_events(created_at DESC);