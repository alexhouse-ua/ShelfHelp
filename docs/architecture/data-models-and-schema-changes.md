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

## Hardcover Migration Schema Changes

**Migration Date:** Epic 1.5 (2025-10-15)
**Status:** Approved
**Reference:** `docs/architect-research-hardcover-migration.md`

### Books Table Additions

```sql
-- Epic 1.5 Migration 1: Add Hardcover fields
ALTER TABLE books ADD COLUMN IF NOT EXISTS hardcover_id INTEGER UNIQUE;
ALTER TABLE books ADD COLUMN IF NOT EXISTS moods TEXT[];
ALTER TABLE books ADD COLUMN IF NOT EXISTS content_warnings TEXT[];
ALTER TABLE books ADD COLUMN IF NOT EXISTS users_count INTEGER DEFAULT 0;
ALTER TABLE books ADD COLUMN IF NOT EXISTS ratings_count INTEGER DEFAULT 0;
ALTER TABLE books ADD COLUMN IF NOT EXISTS lists_count INTEGER DEFAULT 0;
ALTER TABLE books ADD COLUMN IF NOT EXISTS series_position DECIMAL(4,2);
ALTER TABLE books ADD COLUMN IF NOT EXISTS edition_id INTEGER;
ALTER TABLE books ADD COLUMN IF NOT EXISTS physical_format TEXT;
ALTER TABLE books ADD COLUMN IF NOT EXISTS data_source TEXT DEFAULT 'hardcover';

CREATE INDEX IF NOT EXISTS idx_books_hardcover_id ON books(hardcover_id);
CREATE INDEX IF NOT EXISTS idx_books_users_count ON books(users_count DESC);

COMMENT ON COLUMN books.hardcover_id IS 'Primary key from Hardcover API (books.id)';
COMMENT ON COLUMN books.moods IS 'Native mood tags from Hardcover (TEXT array)';
COMMENT ON COLUMN books.content_warnings IS 'Sensitive content flags from Hardcover';
COMMENT ON COLUMN books.users_count IS 'Community engagement signal (popularity)';
COMMENT ON COLUMN books.data_source IS 'Track origin: goodreads|hardcover|manual';
```

### Reading Sessions Table

```sql
-- Epic 1.5 Migration 2: Reading sessions from KOReader/Hardcover
CREATE TABLE reading_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    hardcover_activity_id INTEGER,
    session_start TIMESTAMP WITH TIME ZONE NOT NULL,
    session_end TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INTEGER NOT NULL,
    pages_read INTEGER NOT NULL,
    start_page INTEGER,
    end_page INTEGER,
    reading_speed_ppm DECIMAL(5,2),
    data_source TEXT DEFAULT 'hardcover',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_reading_sessions_book_id ON reading_sessions(book_id);
CREATE INDEX idx_reading_sessions_start ON reading_sessions(session_start DESC);
CREATE UNIQUE INDEX idx_reading_sessions_activity
    ON reading_sessions(hardcover_activity_id)
    WHERE hardcover_activity_id IS NOT NULL;

COMMENT ON TABLE reading_sessions IS 'Individual reading sessions from KOReader/Hardcover';
COMMENT ON COLUMN reading_sessions.reading_speed_ppm IS 'Pages per minute (calculated)';
COMMENT ON COLUMN reading_sessions.data_source IS 'hardcover|koreader_manual|estimated';
```

### Book Activities Table

```sql
-- Epic 1.5 Migration 3: Activity timeline from Hardcover
CREATE TABLE book_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    hardcover_activity_id INTEGER UNIQUE NOT NULL,
    activity_type TEXT NOT NULL,
    activity_date TIMESTAMP WITH TIME ZONE NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_book_activities_book_id ON book_activities(book_id);
CREATE INDEX idx_book_activities_type ON book_activities(activity_type);
CREATE INDEX idx_book_activities_date ON book_activities(activity_date DESC);
CREATE UNIQUE INDEX idx_book_activities_hardcover ON book_activities(hardcover_activity_id);

COMMENT ON TABLE book_activities IS 'Activity timeline from Hardcover (added, started, finished, rated, etc.)';
COMMENT ON COLUMN book_activities.activity_type IS 'added|started|finished|rated|abandoned|progress_update';
```

### Hardcover Lists Tables

```sql
-- Epic 1.5 Migration 4: Hardcover list sync
CREATE TABLE hardcover_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hardcover_list_id INTEGER UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    privacy_setting TEXT,
    books_count INTEGER DEFAULT 0,
    last_synced TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE hardcover_list_books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id UUID NOT NULL REFERENCES hardcover_lists(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    date_added TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(list_id, book_id)
);

CREATE INDEX idx_hardcover_lists_hardcover_id ON hardcover_lists(hardcover_list_id);
CREATE INDEX idx_list_books_list_id ON hardcover_list_books(list_id);
CREATE INDEX idx_list_books_position ON hardcover_list_books(list_id, position);

COMMENT ON TABLE hardcover_lists IS 'Synced lists from Hardcover (TBR queues, custom lists)';
COMMENT ON TABLE hardcover_list_books IS 'Books in lists with position tracking';
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

### RSS Feed Import (DEPRECATED - Epic 1.5)

**Status**: ⏸️ DEPRECATED (replaced by Hardcover GraphQL API in Epic 1.5)
**Source**: Goodreads RSS feed (environment variable `GOODREADS_RSS_FEED_URL_READ`)
**Rollback**: 6-month retention period (until 2025-04-15), cron disabled but archived

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

### Hardcover GraphQL API Import (Active - Epic 1.5+)

**Status**: ✅ ACTIVE (Epic 1.5)
**Endpoint**: `https://api.hardcover.app/v1/graphql`
**Authentication**: Bearer token (env: `HARDCOVER_API_TOKEN`)
**Rate Limit**: 60 req/min (86,400/day) - 24h caching for books, 5min for activities
**Reference**: `docs/architect-research-hardcover-migration.md`

**Sync Frequency**:
- **Activities**: Every 5 minutes (pg_cron: `hardcover-activities-sync`)
- **Full Sync**: Daily at 3 AM UTC (pg_cron: `hardcover-full-sync`)
- **Manual**: User-triggered via `/hardcover-sync?sync_type=manual`

**GraphQL Field Mappings**:

| Hardcover Field | Database Field(s) | Table | Processing |
|----------------|-------------------|-------|------------|
| `books.id` | `hardcover_id` | books | Direct (PRIMARY KEY) |
| `books.title` | `title`, `series_name`, `series_position` | books | Parse series |
| `books.authors.name` | `author` | books | First author or joined |
| `books.isbn_10` / `books.isbn_13` | `isbn` | books | Prefer ISBN-13 |
| `books.pages` | `page_count` | books | Direct |
| `books.release_date` | `publication_date` | books | ISO date |
| `books.moods` | `moods` | books | TEXT[] array |
| `books.content_warnings` | `content_warnings` | books | TEXT[] array |
| `books.users_count` | `users_count` | books | Community signal |
| `books.ratings_count` | `ratings_count` | books | Validation metric |
| `books.lists_count` | `lists_count` | books | Popularity signal |
| `books.series_position` | `series_position` | books | DECIMAL (supports 1.5) |
| `editions.id` | `edition_id` | books | Edition tracking |
| `editions.physical_format` | `physical_format` | books | ebook\|hardcover\|paperback\|audiobook |
| `activities.id` | `hardcover_activity_id` | book_activities | Deduplication key |
| `activities.event` | `activity_type` | book_activities | UserBookActivity types |
| `activities.created_at` | `activity_date` | book_activities | ISO timestamp |
| `activities.data` | `metadata` | book_activities | JSONB (page_progress, rating, etc.) |
| `activities.*` (session calc) | `session_start`, `session_end`, etc. | reading_sessions | Delta calculation |
| `lists.id` | `hardcover_list_id` | hardcover_lists | List sync |
| `list_books.position` | `position` | hardcover_list_books | Queue ordering |

**Activity Event Types**:
- `added`: Book added to library
- `started`: Reading started
- `finished`: Reading completed
- `rated`: User rated book
- `progress_update`: Page progress changed (used for session calculation)
- `abandoned`: Reading abandoned

**Session Calculation**:
Reading sessions are reconstructed from `progress_update` activities by calculating deltas:
```typescript
// Activity 1: page 50 @ 10:00 AM
// Activity 2: page 75 @ 10:30 AM
// → Session: 30min, 25 pages, 0.83 ppm
```

**Book Matching Strategy** (for existing Goodreads books):
1. ISBN match (confidence: 1.0)
2. Exact title + author (confidence: 0.95)
3. Fuzzy title + author (confidence: calculated via pg_trgm)
4. Manual review (confidence: <0.7, flagged in migration_log)

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
