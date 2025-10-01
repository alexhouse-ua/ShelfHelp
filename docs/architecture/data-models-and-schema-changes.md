# 4. Data Models and Schema Changes

## Complete Database Schema

### Lookup Tables

These tables store controlled vocabularies for genres, subgenres, tropes, spice levels, and recommendation sources. They enable dynamic querying, filtering, and enrichment.

```sql
CREATE TABLE genres (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL
);

CREATE TABLE subgenres (
    id SERIAL PRIMARY KEY,
    genre_id INTEGER REFERENCES genres(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    UNIQUE (genre_id, name)
);

CREATE TABLE tropes (
    id SERIAL PRIMARY KEY,
    genre_id INTEGER REFERENCES genres(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    UNIQUE (genre_id, name)
);

CREATE TABLE spice_levels (
    id SERIAL PRIMARY KEY,
    label TEXT UNIQUE NOT NULL,
    description TEXT
);

CREATE TABLE recommendation_sources (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    url TEXT,
    scope TEXT,
    categories TEXT[],
    priority INTEGER
);
```

#### Relationships

- `books.genres_primary` and `books.genres_secondary` can reference `genres.id` (or store as arrays of genre IDs)
- `books.tropes` can reference `tropes.id` (or store as arrays of trope IDs)
- `books.spice_level` can reference `spice_levels.id`
- Recommendation sources can be joined for analytics or enrichment

### `books` Table

**Core table for storing all book information from RSS feeds and AI enrichment.**

```sql
CREATE TABLE books (
    -- Core Identifiers
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goodreads_id INTEGER UNIQUE,
    isbn TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    id (UUID): Primary key, auto-generated
    goodreads_id (INTEGER): Unique identifier from Goodreads
    isbn (TEXT): ISBN-10 or ISBN-13, nullable if not available
    created_at (TIMESTAMP): Auto-generated creation timestamp
    page_count INTEGER,
    pov_type` (TEXT): Point of view (first person, third person, first person dual, third person single, etc.)
    publication_date DATE,
    series_name TEXT,
    series_number INTEGER,
    cover_image_url TEXT,
    goodreads_link TEXT,

    -- User Data
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
    pov_type TEXT, -- e.g., first person, third person, first person dual, third person single, etc.
    pov_gender TEXT,
    spice_level TEXT,

    -- System & AI-Generated Data
    status TEXT CHECK (status IN ('to_read', 'currently_reading', 'finished', 'processing', 'enriched', 'failed')) DEFAULT 'to_read',
    queue_position INTEGER,
    availability TEXT,
    hype_flag BOOLEAN DEFAULT false,
    ai_summary TEXT,
    ai_rating DECIMAL(3,2) CHECK (ai_rating >= 0 AND ai_rating <= 10),
    embedding VECTOR(768) -- Google Gemini embeddings with 768 dimensions
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

### Indexes and Performance

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

## Data Import Sources

### CSV Import (Historical Backfill)

**Source**: `project-specs/goodreads_read_history.csv`

**Filtering**: Only books with status `"read"` are imported (filters out `to-read`, `currently-reading`)

**Field Mappings**:

| CSV Column        | Database Field(s)                       | Processing                                 |
| ----------------- | --------------------------------------- | ------------------------------------------ |
| `Book Id`         | `goodreads_id`                          | `parseInt()`                               |
| `Title`           | `title`, `series_name`, `series_number` | Regex parse: `"Title (Series, #N)"`        |
| `Author`          | `author`                                | Direct                                     |
| `ISBN13` / `ISBN` | `isbn`                                  | Prefers ISBN13                             |
| `My Rating`       | `user_rating`                           | `parseInt()` 1-5                           |
| `Publisher`       | `publisher`                             | Direct                                     |
| `Number of Pages` | `page_count`                            | `parseInt()`                               |
| `Year Published`  | `publication_date`                      | `YYYY-01-01`                               |
| `Date Read`       | `user_date_finished`                    | MM/DD/YY → ISO                             |
| `Date Added`      | `user_date_added`                       | MM/DD/YY → ISO                             |
| `Status`          | _(filter only)_                         | Only `"read"` imported                     |
| _(constructed)_   | `goodreads_link`                        | `https://www.goodreads.com/book/show/{id}` |
| _(hardcoded)_     | `status`                                | `"finished"`                               |

**Date Format**: MM/DD/YY with 2-digit year conversion (00-49 → 2000-2049, 50-99 → 1950-1999)

### RSS Feed Import (Ongoing Sync)

**Source**: Goodreads RSS feed (environment variable `GOODREADS_RSS_FEED_URL_READ`)

**Filtering**: None - imports all books from any shelf

**Field Mappings**:

| RSS Field                                 | Database Field(s)                       | Processing                          |
| ----------------------------------------- | --------------------------------------- | ----------------------------------- |
| `book_id`                                 | `goodreads_id`                          | `parseInt()`                        |
| `title`                                   | `title`, `series_name`, `series_number` | Regex parse: `"Title (Series, #N)"` |
| `author_name`                             | `author`                                | Direct                              |
| `isbn`                                    | `isbn`                                  | Direct                              |
| `book_published`                          | `publication_date`                      | `YYYY-01-01`                        |
| `book.num_pages`                          | `page_count`                            | `parseInt()`                        |
| `publisher`                               | `publisher`                             | Direct                              |
| `book_large_image_url` / `book_image_url` | `cover_image_url`                       | Prefers large                       |
| `link`                                    | `goodreads_link`                        | Direct URL                          |
| `user_rating`                             | `user_rating`                           | `parseInt()` 1-5 validated          |
| `user_read_at`                            | `user_date_finished`                    | ISO → ISO                           |
| `user_date_added`                         | `user_date_added`                       | ISO → ISO                           |
| _(hardcoded)_                             | `status`                                | `"to_read"`                         |

**Note**: RSS `book_description` is NOT mapped to `ai_summary` - summaries require AI processing via the enrichment pipeline.

## Data Constraints and Business Rules

1. **Book Uniqueness**: Books are uniquely identified by `goodreads_id` when available (UPSERT on conflict)
2. **Rating Ranges**: User ratings (1-5), AI ratings (0-10)
3. **Status Values**: Valid statuses are `'to_read'`, `'currently_reading'`, `'finished'`, `'processing'`, `'enriched'`, `'failed'` (default: `'to_read'`)
4. **Series Parsing**: Both CSV and RSS parse series info from title using pattern `"Book Title (Series Name, #N)"`
5. **Vector Dimensions**: Embeddings use 768-dimensional vectors (Google Gemini compatible)
6. **Cascading Deletes**: Book deletion removes associated reflections and events
7. **Import Idempotency**: Both CSV and RSS imports use UPSERT on `goodreads_id` for safe re-runs

## Column Details Reference

### Lookup Fields

- `genres_primary` (INTEGER[]): Array of genre IDs from `genres` table
- `genres_secondary` (INTEGER[]): Array of genre IDs from `genres` table
- `tropes` (INTEGER[]): Array of trope IDs from `tropes` table
- `spice_level` (INTEGER): ID from `spice_levels` table
- `recommendation_source` (INTEGER): ID from `recommendation_sources` table (if tracked per book)

**Note:** Allowed values for genres, subgenres, tropes, and spice levels are managed in their respective tables. See `classifications.yaml` for initial data population.

### Core Identifiers

- `id` (UUID): Primary key, auto-generated
- `goodreads_id` (INTEGER): Unique identifier from Goodreads
- `isbn` (TEXT): ISBN-10 or ISBN-13, nullable if not available
- `created_at` (TIMESTAMP): Auto-generated creation timestamp

### Bibliographic Data

- `title` (TEXT): Required, original full title from RSS
- `author` (TEXT): Required, primary author name
- `page_count` (INTEGER): Book length in pages
- `publisher` (TEXT): Publishing house name
- `publication_date` (DATE): Book's original publication date
- `series_name` (TEXT): Series title if part of a series
- `series_number` (INTEGER): Position within series
- `cover_image_url` (TEXT): Link to book cover image
- `goodreads_link` (TEXT): Canonical Goodreads URL

### User Data (from RSS and CSV sources)

- `user_rating` (INTEGER): User's 1-5 star rating, nullable
- `user_date_added` (TIMESTAMP): When book was added to shelf/library
- `user_date_finished` (TIMESTAMP): When user finished reading

**Note**: `user_shelves` field was removed in migration `20251001000000_update_books_schema.sql` as shelf information is implicit from the `status` field.

### Classification & Thematic Data (AI-Enriched)

- `genres_primary` (TEXT[]): Primary genre classifications
- `genres_secondary` (TEXT[]): Secondary genre tags
- `tropes` (TEXT[]): Common story tropes (enemies-to-lovers, etc.)
- `themes` (TEXT[]): Major thematic elements
- `keywords` (TEXT[]): Searchable keywords and tags
- `target_audience` (TEXT): Intended reader demographic

### Stylistic & Structural Data (AI-Enriched)

- `pacing` (TEXT): Story pacing description
- `tone` (TEXT): Overall tone and mood
- `writing_style` (TEXT): Author's writing style characteristics
- `pov_type` (TEXT): Point of view (first person, third person, first person dual, third person single etc.)
- `pov_gender` (TEXT): Gender of protagonist/POV character
- `spice_level` (TEXT): Content rating for mature themes

### System & AI-Generated Data

- `status` (TEXT): Reading status with check constraint
- `queue_position` (INTEGER): Position in reading queue
- `availability` (TEXT): Where book can be acquired
- `hype_flag` (BOOLEAN): Whether book is trending/hyped
- `ai_summary` (TEXT): AI-generated book summary
- `ai_rating` (DECIMAL): AI-predicted rating (0-10 scale)
- `embedding` (VECTOR): 768-dimensional vector for similarity search

---
