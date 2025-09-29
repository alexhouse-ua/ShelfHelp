-- Enable required extensions
-- Note: pgvector extension needs to be enabled manually in production
-- For local development, this will be skipped if not available
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS "pgvector" WITH SCHEMA "extensions";
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pgvector extension not available, skipping for local development';
END $$;

-- Create custom types
CREATE TYPE reading_status AS ENUM ('not_started', 'in_progress', 'completed', 'paused', 'abandoned');
CREATE TYPE book_format AS ENUM ('physical', 'ebook', 'audiobook', 'pdf');

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE,
    display_name TEXT,
    telegram_user_id BIGINT UNIQUE,
    telegram_username TEXT,
    preferred_language TEXT DEFAULT 'en',
    timezone TEXT DEFAULT 'UTC',
    reading_goal_books_per_year INTEGER DEFAULT 12,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Books table
CREATE TABLE IF NOT EXISTS public.books (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    isbn_10 TEXT,
    isbn_13 TEXT,
    publisher TEXT,
    publication_date DATE,
    page_count INTEGER,
    language TEXT DEFAULT 'en',
    description TEXT,
    cover_image_url TEXT,
    format book_format DEFAULT 'physical',
    genres TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure at least one ISBN is provided
    CONSTRAINT books_isbn_check CHECK (isbn_10 IS NOT NULL OR isbn_13 IS NOT NULL)
);

-- Reading sessions table
CREATE TABLE IF NOT EXISTS public.reading_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
    book_id UUID REFERENCES public.books(id) ON DELETE CASCADE NOT NULL,
    status reading_status DEFAULT 'not_started',
    start_date DATE,
    end_date DATE,
    current_page INTEGER DEFAULT 0,
    notes TEXT,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    is_favorite BOOLEAN DEFAULT FALSE,
    reading_goal_year INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Unique constraint to prevent duplicate active sessions
    UNIQUE(user_id, book_id, status) DEFERRABLE INITIALLY DEFERRED
);

-- Book embeddings table for AI features
-- Note: vector column will be created as TEXT if pgvector is not available
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgvector') THEN
        CREATE TABLE IF NOT EXISTS public.book_embeddings (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            book_id UUID REFERENCES public.books(id) ON DELETE CASCADE NOT NULL,
            content_type TEXT NOT NULL, -- 'description', 'summary', 'full_text', etc.
            content_text TEXT NOT NULL,
            embedding vector(1536), -- OpenAI ada-002 embedding size
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMPTZ DEFAULT NOW(),

            UNIQUE(book_id, content_type)
        );
    ELSE
        CREATE TABLE IF NOT EXISTS public.book_embeddings (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            book_id UUID REFERENCES public.books(id) ON DELETE CASCADE NOT NULL,
            content_type TEXT NOT NULL, -- 'description', 'summary', 'full_text', etc.
            content_text TEXT NOT NULL,
            embedding TEXT, -- Fallback for local development without pgvector
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMPTZ DEFAULT NOW(),

            UNIQUE(book_id, content_type)
        );
    END IF;
END $$;

-- User reading statistics view
CREATE OR REPLACE VIEW public.user_reading_stats AS
SELECT
    up.id as user_id,
    up.display_name,
    COUNT(rs.id) as total_books,
    COUNT(CASE WHEN rs.status = 'completed' THEN 1 END) as completed_books,
    COUNT(CASE WHEN rs.status = 'in_progress' THEN 1 END) as currently_reading,
    COUNT(CASE WHEN rs.status = 'paused' THEN 1 END) as paused_books,
    COALESCE(AVG(CASE WHEN rs.rating IS NOT NULL THEN rs.rating END), 0) as average_rating,
    COUNT(CASE WHEN rs.is_favorite = true THEN 1 END) as favorite_books,
    EXTRACT(YEAR FROM NOW()) as current_year,
    COUNT(CASE WHEN rs.status = 'completed' AND EXTRACT(YEAR FROM rs.end_date) = EXTRACT(YEAR FROM NOW()) THEN 1 END) as books_read_this_year,
    up.reading_goal_books_per_year
FROM public.user_profiles up
LEFT JOIN public.reading_sessions rs ON up.id = rs.user_id
GROUP BY up.id, up.display_name, up.reading_goal_books_per_year;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_telegram_user_id ON public.user_profiles(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_books_title ON public.books(title);
CREATE INDEX IF NOT EXISTS idx_books_author ON public.books(author);
CREATE INDEX IF NOT EXISTS idx_books_isbn_13 ON public.books(isbn_13);
CREATE INDEX IF NOT EXISTS idx_reading_sessions_user_id ON public.reading_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_reading_sessions_book_id ON public.reading_sessions(book_id);
CREATE INDEX IF NOT EXISTS idx_reading_sessions_status ON public.reading_sessions(status);
CREATE INDEX IF NOT EXISTS idx_reading_sessions_year ON public.reading_sessions(reading_goal_year);
CREATE INDEX IF NOT EXISTS idx_book_embeddings_book_id ON public.book_embeddings(book_id);

-- Create vector similarity search index (only if pgvector is available)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgvector') THEN
        CREATE INDEX IF NOT EXISTS idx_book_embeddings_vector ON public.book_embeddings
        USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
    END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_embeddings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
CREATE POLICY "Users can view their own profile" ON public.user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.user_profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for books (public read, authenticated write)
CREATE POLICY "Anyone can view books" ON public.books
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert books" ON public.books
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update books" ON public.books
    FOR UPDATE USING (auth.role() = 'authenticated');

-- RLS Policies for reading_sessions
CREATE POLICY "Users can view their own reading sessions" ON public.reading_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reading sessions" ON public.reading_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reading sessions" ON public.reading_sessions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reading sessions" ON public.reading_sessions
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for book_embeddings (public read for AI features)
CREATE POLICY "Anyone can view book embeddings" ON public.book_embeddings
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage book embeddings" ON public.book_embeddings
    FOR ALL USING (auth.role() = 'authenticated');

-- Functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_books_updated_at
    BEFORE UPDATE ON public.books
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reading_sessions_updated_at
    BEFORE UPDATE ON public.reading_sessions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to search books by similarity using embeddings (only if pgvector is available)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgvector') THEN
        CREATE OR REPLACE FUNCTION public.search_books_by_embedding(
            query_embedding vector(1536),
            match_threshold float DEFAULT 0.8,
            match_count int DEFAULT 10
        )
        RETURNS TABLE (
            book_id uuid,
            title text,
            author text,
            similarity float
        )
        LANGUAGE sql
        AS $func$
            SELECT
                b.id as book_id,
                b.title,
                b.author,
                1 - (be.embedding <=> query_embedding) as similarity
            FROM public.book_embeddings be
            JOIN public.books b ON be.book_id = b.id
            WHERE be.content_type = 'description'
            AND 1 - (be.embedding <=> query_embedding) > match_threshold
            ORDER BY be.embedding <=> query_embedding
            LIMIT match_count;
        $func$;
    ELSE
        -- Fallback function for local development without pgvector
        CREATE OR REPLACE FUNCTION public.search_books_by_embedding(
            query_embedding text,
            match_threshold float DEFAULT 0.8,
            match_count int DEFAULT 10
        )
        RETURNS TABLE (
            book_id uuid,
            title text,
            author text,
            similarity float
        )
        LANGUAGE sql
        AS $func$
            SELECT
                b.id as book_id,
                b.title,
                b.author,
                0.5 as similarity -- Placeholder similarity for local development
            FROM public.books b
            ORDER BY b.created_at DESC
            LIMIT match_count;
        $func$;
    END IF;
END $$;

-- Function to get user reading recommendations
CREATE OR REPLACE FUNCTION public.get_reading_recommendations(
    user_uuid uuid,
    limit_count int DEFAULT 5
)
RETURNS TABLE (
    book_id uuid,
    title text,
    author text,
    description text,
    similarity_score float
)
LANGUAGE sql
AS $$
    WITH user_books AS (
        SELECT DISTINCT b.id, b.genres, b.tags
        FROM public.books b
        JOIN public.reading_sessions rs ON b.id = rs.book_id
        WHERE rs.user_id = user_uuid
        AND rs.status = 'completed'
        AND rs.rating >= 4
    ),
    similar_genres AS (
        SELECT UNNEST(genres) as genre
        FROM user_books
        GROUP BY genre
        ORDER BY COUNT(*) DESC
        LIMIT 3
    ),
    recommendations AS (
        SELECT DISTINCT
            b.id as book_id,
            b.title,
            b.author,
            b.description,
            b.created_at,
            0.8 as similarity_score -- Placeholder for now
        FROM public.books b
        WHERE EXISTS (
            SELECT 1 FROM similar_genres sg
            WHERE sg.genre = ANY(b.genres)
        )
        AND NOT EXISTS (
            SELECT 1 FROM public.reading_sessions rs
            WHERE rs.book_id = b.id AND rs.user_id = user_uuid
        )
        ORDER BY b.created_at DESC
    )
    SELECT book_id, title, author, description, similarity_score FROM recommendations LIMIT limit_count;
$$;