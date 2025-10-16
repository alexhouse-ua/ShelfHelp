# 🏗️ Architect Technical Research: Hardcover Migration

**Date**: 2025-10-15 | **Status**: ✅ Feasibility Confirmed | **Risk**: LOW

**Companion**: `sprint-change-proposal-hardcover-migration.md`

---

## 🎯 Research Objective

Validate technical feasibility of migrating from Goodreads/Kindle to Hardcover.app/KOReader/Calibre stack.

**Conclusion**: ✅ **FEASIBLE** - All technical requirements confirmed, risks mitigated.

---

## 🌐 Hardcover.app GraphQL API - Complete Specs

### Endpoint & Authentication

```
Endpoint: https://api.hardcover.app/v1/graphql
Console: https://cloud.hasura.io/public/graphiql?endpoint=https://api.hardcover.app/v1/graphql

Authentication:
  ✅ Correct:   authorization: [YOUR_API_TOKEN]
  ❌ Incorrect: authorization: Bearer [YOUR_API_TOKEN]

Token Location: https://hardcover.app/account/api
Token Format: Plain API token (NO "Bearer" prefix - Hardcover does NOT use standard OAuth)
```

### Rate Limits & Constraints

```
Rate Limit: 60 requests/minute
Daily Max: 86,400 requests (60/min × 1440 min)
Query Timeout: 30 seconds max
Query Depth: 3 levels max
Token Expiry: January 1st annually (auto-reset)
```

### Data Access Scope

- ✅ Your own user data
- ✅ Public data (books, authors)
- ✅ Followed users' data
- ❌ Other private users

### Disabled Operators

```
_like, _ilike (regex operators disabled for performance)
```

### HTTP Status Codes

```
200: Success
401: Invalid/expired token
403: Access denied
404: Not found
429: Rate limited
500: Server error
```

---

## 📚 API Schema Capabilities

### Books API

**Query**: `books(where: {...}, limit: N, order_by: {...})`

**Available Fields**:

```graphql
{
  id                  # PRIMARY KEY for our hardcover_id
  title
  pages
  release_date
  description
  isbn_10
  isbn_13
  moods               # TEXT[] - Native mood tags
  content_warnings    # TEXT[] - Sensitive content flags
  users_count         # Community engagement signal
  ratings_count       # Validation metric
  lists_count         # Popularity signal
  series_name
  series_position
  genres              # Relationship to genres table
  editions            # Multiple formats/editions
  authors             # Relationship to authors
  contributions       # Author relationships
}
```

**Filters**: genres, moods, authors, release_date, ratings, users_count

---

### Users API

**Query**: `me { ... }` (current user)

**Available Fields**:

```graphql
{
  id                  # USER_ID for activity queries
  username
  location
  pronouns
  birthdate
  books_count         # Total books tracked
  followers_count
  sign_in_count
}
```

---

### Activities API ⚡ **CRITICAL FOR KOREADER**

**Query**: `activities(where: {...}, order_by: {created_at: desc})`

**Available Fields**:

```graphql
{
  id                          # hardcover_activity_id (deduplication key)
  user_id
  book_id
  event                       # "UserBookActivity", "GoalActivity", "ListActivity"
  created_at                  # Activity timestamp
  data                        # JSONB with event-specific data
  likes_count
}
```

**Event Types**:

- `UserBookActivity`: added, started, finished, rated, progress_update
- `GoalActivity`: reading challenges, annual targets
- `ListActivity`: list additions/removals
- `PromptActivity`: journal entries

**KOReader Sync Strategy**:

```typescript
// Query activities to reconstruct reading sessions
activities(
  where: {
    user_id: {_eq: $userId},
    event: {_eq: "UserBookActivity"},
    created_at: {_gte: $lastSync}
  },
  order_by: {created_at: asc}
)

// Parse data.page_progress deltas → calculate sessions
// Example:
//   Activity 1: page 50 @ 10:00 AM
//   Activity 2: page 75 @ 10:30 AM
//   → Session: 30 min, 25 pages, 0.83 pages/min
```

---

### Editions API

**Query**: `editions(where: {title: {_eq: "..."}}, ...)`

**Available Fields**:

```graphql
{
  id                  # edition_id for our schema
  book_id
  isbn_10
  isbn_13
  physical_format     # "hardcover", "paperback", "ebook", "audiobook"
  pages
  publisher_id
  release_date
  asin
}
```

**Use Case**: Match Calibre library by ISBN, track multiple formats

---

### Authors API

**Query**: `authors(where: {...})`

**Available Fields**:

```graphql
{
  id
  name
  biography
  born_date
  born_year
  death_date
  death_year
  is_bipoc            # Diversity tracking
  is_lgbtq            # Diversity tracking
  books_count
  contributions       # Author-book relationships
}
```

**Use Case**: Diversity-aware recommendations, author preference learning

---

### Lists API

**Query**: `lists(where: {user_id: {_eq: $userId}})`

**Available Fields**:

```graphql
{
  id                  # hardcover_list_id
  name
  description
  user_id
  privacy             # "public", "followers", "private"
  books_count
  likes_count
  created_at
  list_books {        # Relationship
    book_id
    position
    date_added
  }
}
```

**Mutations Available**:

```graphql
createList(input: {name, description, privacy})
updateList(id, input: {...})
deleteList(id)
addBookToList(list_id, book_id, position)
removeBookFromList(list_id, book_id)
```

**Use Case**: Multiple TBR queues, list-based prioritization, sync with Hardcover

---

## 📖 KOReader Integration Strategy

### **✅ KEY FINDING: No Manual SQLite Extraction Needed**

**Discovery**: User is using Hardcover KOReader plugin → auto-syncs to Hardcover

**Architecture**:

```
KOReader (Boox Palma)
  ↓ (via Hardcover plugin, <1min frequency)
Hardcover API (Activities)
  ↓ (query via our app)
Our Database (reading_sessions table)
```

**NOT**: `KOReader → statistics.sqlite → Manual upload → Our app`

---

### KOReader Plugin Behavior

**Source**: https://github.com/Billiam/hardcoverapp.koplugin

**Sync Frequency**: "No more than once per minute"

**Data Synced**:

- Current page number
- Reading status (reading/finished)
- Started timestamp
- Progress percentage
- Book rating (if set)
- Notes/quotes (if enabled)

**Book Matching**:

1. Try ISBN → Hardcover book_id
2. Fallback: Title + Author search
3. User confirms match in plugin UI

**WiFi Management**:

- Auto-enable WiFi for sync
- Auto-disable after (battery optimization)

---

### statistics.sqlite Schema (Fallback Only)

**Location**: `KOReader/settings/statistics.sqlite`

**Tables**:

```sql
-- Book metadata
CREATE TABLE book (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    authors TEXT,
    md5 TEXT,
    total_read_pages INTEGER,
    total_read_time INTEGER,
    UNIQUE(title, authors, md5)
);

-- Page-level reading data
CREATE TABLE page_stat_data (
    id_book INTEGER,
    page INTEGER NOT NULL DEFAULT 0,
    start_time INTEGER NOT NULL DEFAULT 0,  -- Unix timestamp
    duration INTEGER NOT NULL DEFAULT 0,    -- Seconds
    total_pages INTEGER NOT NULL DEFAULT 0,
    UNIQUE (id_book, page, start_time),
    FOREIGN KEY(id_book) REFERENCES book(id)
);
```

**Query Example**:

```sql
SELECT
    b.title,
    b.authors,
    p.start_time,
    p.duration,
    p.page
FROM page_stat_data p
JOIN book b ON p.id_book = b.id
WHERE b.title = 'My Book'
ORDER BY p.start_time;
```

**Use Case**: Fallback if Activities API data insufficient (manual upload Edge Function)

---

## 🗄️ Database Schema Design

### Migration Sequence

```
1. 20251016000001_add_hardcover_books_fields.sql
   → ALTER TABLE books (add 8 Hardcover fields)

2. 20251016000002_create_reading_sessions.sql
   → CREATE TABLE reading_sessions
   → Indexes: book_id, session_start, hardcover_activity_id

3. 20251016000003_create_book_activities.sql
   → CREATE TABLE book_activities
   → Indexes: book_id, activity_type, activity_date

4. 20251016000004_create_hardcover_lists.sql
   → CREATE TABLE hardcover_lists
   → CREATE TABLE hardcover_list_books
   → Indexes: list_id, position

5. 20251016000005_backfill_hardcover_data.sql
   → Data migration: Match Goodreads → Hardcover by ISBN/title
   → Populate hardcover_id for existing books

6. 20251016000006_deprecate_goodreads_fields.sql
   → Add data_source column (track origin)
   → Comment goodreads_id (keep for 6mo, then drop)
```

---

### Complete Table Schemas

#### books (alterations)

```sql
ALTER TABLE books ADD COLUMN hardcover_id INTEGER UNIQUE;
ALTER TABLE books ADD COLUMN moods TEXT[];
ALTER TABLE books ADD COLUMN content_warnings TEXT[];
ALTER TABLE books ADD COLUMN users_count INTEGER DEFAULT 0;
ALTER TABLE books ADD COLUMN ratings_count INTEGER DEFAULT 0;
ALTER TABLE books ADD COLUMN lists_count INTEGER DEFAULT 0;
ALTER TABLE books ADD COLUMN series_position DECIMAL(4,2);
ALTER TABLE books ADD COLUMN edition_id INTEGER;
ALTER TABLE books ADD COLUMN physical_format TEXT;
ALTER TABLE books ADD COLUMN data_source TEXT DEFAULT 'hardcover';

CREATE INDEX idx_books_hardcover_id ON books(hardcover_id);
CREATE INDEX idx_books_users_count ON books(users_count DESC);
```

---

#### reading_sessions (new)

```sql
CREATE TABLE reading_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    hardcover_activity_id INTEGER,  -- NULL if from statistics.sqlite
    session_start TIMESTAMP WITH TIME ZONE NOT NULL,
    session_end TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INTEGER NOT NULL,
    pages_read INTEGER NOT NULL,
    start_page INTEGER,
    end_page INTEGER,
    reading_speed_ppm DECIMAL(5,2),  -- pages per minute
    data_source TEXT DEFAULT 'hardcover',  -- 'hardcover', 'koreader_manual', 'estimated'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_reading_sessions_book_id ON reading_sessions(book_id);
CREATE INDEX idx_reading_sessions_start ON reading_sessions(session_start DESC);
CREATE UNIQUE INDEX idx_reading_sessions_activity
    ON reading_sessions(hardcover_activity_id)
    WHERE hardcover_activity_id IS NOT NULL;
```

**Query Example**:

```sql
-- Get average reading speed for a book
SELECT
    b.title,
    AVG(rs.reading_speed_ppm) as avg_speed,
    SUM(rs.duration_minutes) as total_time,
    SUM(rs.pages_read) as total_pages
FROM reading_sessions rs
JOIN books b ON rs.book_id = b.id
WHERE b.id = '...'
GROUP BY b.id, b.title;
```

---

#### book_activities (new)

```sql
CREATE TABLE book_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    hardcover_activity_id INTEGER UNIQUE NOT NULL,
    activity_type TEXT NOT NULL,  -- 'added', 'started', 'finished', 'rated', 'abandoned', 'progress_update'
    activity_date TIMESTAMP WITH TIME ZONE NOT NULL,
    metadata JSONB,  -- Activity-specific data (page_progress, rating_value, etc.)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_book_activities_book_id ON book_activities(book_id);
CREATE INDEX idx_book_activities_type ON book_activities(activity_type);
CREATE INDEX idx_book_activities_date ON book_activities(activity_date DESC);
CREATE UNIQUE INDEX idx_book_activities_hardcover ON book_activities(hardcover_activity_id);
```

**Query Example**:

```sql
-- Get reading timeline for a book
SELECT
    activity_type,
    activity_date,
    metadata->>'page_progress' as page
FROM book_activities
WHERE book_id = '...'
ORDER BY activity_date;
```

---

#### hardcover_lists (new)

```sql
CREATE TABLE hardcover_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hardcover_list_id INTEGER UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    privacy_setting TEXT,  -- 'public', 'followers', 'private'
    books_count INTEGER DEFAULT 0,
    last_synced TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_hardcover_lists_hardcover_id ON hardcover_lists(hardcover_list_id);
```

---

#### hardcover_list_books (new)

```sql
CREATE TABLE hardcover_list_books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id UUID NOT NULL REFERENCES hardcover_lists(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    date_added TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(list_id, book_id)
);

CREATE INDEX idx_list_books_list_id ON hardcover_list_books(list_id);
CREATE INDEX idx_list_books_position ON hardcover_list_books(list_id, position);
```

**Query Example**:

```sql
-- Get prioritized TBR queue from Hardcover list
SELECT
    b.title,
    b.author,
    lb.position,
    b.priority_score
FROM hardcover_list_books lb
JOIN books b ON lb.book_id = b.id
JOIN hardcover_lists l ON lb.list_id = l.id
WHERE l.name = 'TBR Queue'
ORDER BY lb.position;
```

---

## ⚡ Rate Limit Architecture

### Projected API Usage

**Daily Quota**: 86,400 requests (60/min × 1440 min)

**Projected Usage**:

```
Activities sync (every 5 min):    288/day
Book metadata refresh (daily):    100/day  (assume 100 books)
List sync (hourly):                24/day
User queries (on-demand):         500/day  (user interactions)
Error retries:                    100/day
Buffer:                         1,000/day
----------------------------------------
TOTAL:                          2,012/day  (2.3% of quota)
```

**Conclusion**: ✅ Rate limit NOT a blocker with proper caching

---

### Caching Strategy

```typescript
interface CacheConfig {
  books: {
    ttl: 24 * 60 * 60 * 1000,      // 24 hours (metadata stable)
    invalidate: ['book_updated']
  },
  activities: {
    ttl: 5 * 60 * 1000,             // 5 minutes (progress updates)
    invalidate: ['session_ended']
  },
  lists: {
    ttl: 60 * 60 * 1000,            // 1 hour (lists change slowly)
    invalidate: ['list_modified']
  },
  user: {
    ttl: 60 * 60 * 1000,            // 1 hour (profile stable)
    invalidate: ['profile_updated']
  }
}
```

**Cache Key Generation:**

- **Implementation**: Simple hash algorithm (djb2-style bitwise hashing)
- **Formula**: `hash(query_string + JSON.stringify(variables))`
- **Performance**: O(n) where n = query+variables string length, typically <1ms
- **Collision Rate**: Acceptable for API caching (cached entries invalidate after TTL anyway)
- **Rationale**: Fast, no external dependencies, sufficient for this use case
- **Future Optimization**: Can migrate to `crypto.subtle.digest('SHA-256')` if scale increases
- **Note**: NOT a cryptographic hash (security-irrelevant use case), only for caching deduplication

---

### Rate Limit Error Handling

```typescript
async function callHardcoverAPI<T>(
  query: string,
  variables: any,
  retries = 3,
): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch("https://api.hardcover.app/v1/graphql", {
        method: "POST",
        headers: {
          // ✅ Plain token - NO "Bearer" prefix (Hardcover does NOT use standard OAuth)
          "authorization": process.env.HARDCOVER_API_TOKEN,
          "content-type": "application/json",
        },
        body: JSON.stringify({ query, variables }),
      });

      if (response.status === 429) {
        // Exponential backoff: 2s, 4s, 8s
        const waitTime = Math.pow(2, attempt) * 1000;
        logger.warn("Rate limited", { attempt, waitTime });
        await sleep(waitTime);
        continue;
      }

      if (response.status === 401) {
        throw new Error("HARDCOVER_TOKEN_EXPIRED");
      }

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      if (attempt === retries) throw error;
      logger.error("API call failed", { attempt, error });
    }
  }
}
```

---

### Scheduled Sync Strategy

```sql
-- pg_cron job for Activities sync (every 5 minutes)
SELECT cron.schedule(
  'hardcover-activities-sync',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://[project].supabase.co/functions/v1/hardcover-sync',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('vault.service_role_key')
    ),
    body := jsonb_build_object('sync_type', 'activities')
  );
  $$
);

-- Daily full sync (3 AM)
SELECT cron.schedule(
  'hardcover-full-sync',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://[project].supabase.co/functions/v1/hardcover-sync',
    body := jsonb_build_object('sync_type', 'full')
  );
  $$
);
```

---

## 🔄 Data Migration Strategy

### Book Matching Algorithm

**Priority Order**:

1. **ISBN Match** (highest confidence)
   ```sql
   SELECT hardcover_id
   FROM hardcover_books_cache
   WHERE isbn_13 = $goodreads_isbn OR isbn_10 = $goodreads_isbn;
   ```

2. **Exact Title + Author Match** (high confidence)
   ```sql
   SELECT hardcover_id
   FROM hardcover_books_cache
   WHERE LOWER(title) = LOWER($goodreads_title)
     AND LOWER(author_name) = LOWER($goodreads_author);
   ```

3. **Fuzzy Title + Author Match** (medium confidence)
   ```typescript
   // Use Levenshtein distance or trigram similarity
   SELECT hardcover_id, similarity(title, $goodreads_title) as score
   FROM hardcover_books_cache
   WHERE author_name ILIKE $goodreads_author
   ORDER BY score DESC
   LIMIT 5;
   ```

4. **Manual Review** (low confidence / no match)
   - Flag book for user confirmation
   - Display: Goodreads title + suggested Hardcover matches
   - User selects correct match or creates new book

---

### Migration Workflow

```typescript
async function migrateGoodreadsToHardcover() {
  const goodreadsBooks = await supabase
    .from("books")
    .select("*")
    .is("hardcover_id", null); // Unmigrated books

  const results = {
    matched: 0,
    unmatched: 0,
    manual_review: [],
  };

  for (const book of goodreadsBooks) {
    // Try ISBN match
    let hardcoverBook = await findByISBN(book.isbn);

    if (!hardcoverBook) {
      // Try title + author
      hardcoverBook = await findByTitleAuthor(book.title, book.author);
    }

    if (hardcoverBook && hardcoverBook.confidence > 0.9) {
      // High confidence: auto-match
      await supabase.from("books").update({
        hardcover_id: hardcoverBook.id,
        moods: hardcoverBook.moods,
        content_warnings: hardcoverBook.content_warnings,
        // ... other Hardcover fields
        data_source: "hardcover",
      }).eq("id", book.id);

      results.matched++;
    } else if (hardcoverBook && hardcoverBook.confidence > 0.7) {
      // Medium confidence: flag for review
      results.manual_review.push({
        goodreads_book: book,
        suggested_match: hardcoverBook,
        confidence: hardcoverBook.confidence,
      });
    } else {
      // No match: create new or manual review
      results.unmatched++;
    }
  }

  return results;
}
```

---

## 🛡️ Rollback Strategy

### Safety Mechanisms

1. **Dual Data Source Period** (6 months)
   ```sql
   -- Keep goodreads_id for rollback
   ALTER TABLE books ADD COLUMN data_source TEXT DEFAULT 'hardcover';
   -- Query: WHERE data_source = 'goodreads' (if rollback needed)
   ```

2. **Pre-Migration Backup**
   ```bash
   # Full database backup before migration
   pg_dump > backup_pre_hardcover_migration_$(date +%Y%m%d).sql
   ```

3. **Migration Checkpoint**
   ```sql
   -- Log migration actions for audit/rollback
   CREATE TABLE migration_log (
       id UUID PRIMARY KEY,
       book_id UUID,
       action TEXT,  -- 'matched', 'updated', 'created'
       old_data JSONB,
       new_data JSONB,
       created_at TIMESTAMPTZ DEFAULT now()
   );
   ```

4. **Rollback Procedure**
   ```sql
   -- Revert to Goodreads data
   UPDATE books
   SET
       data_source = 'goodreads',
       hardcover_id = NULL
   WHERE data_source = 'hardcover';

   -- Re-enable RSS cron
   SELECT cron.schedule('rss-ingestion', ...);
   ```

---

## ⚠️ Risk Assessment

### Risk Matrix (Final)

| Risk             | Likelihood | Impact   | Mitigation                          | Status       |
| ---------------- | ---------- | -------- | ----------------------------------- | ------------ |
| Rate limit       | LOW        | HIGH     | Cache 24h, 2% quota usage           | ✅ MITIGATED |
| Token expiry     | HIGH       | MED      | Calendar reminder, refresh workflow | ⚠️ PLANNED   |
| Book matching    | MED        | MED      | Multi-strategy, manual review UI    | ⚠️ PLANNED   |
| KOReader no sync | LOW        | LOW      | Fallback SQLite upload              | ✅ MITIGATED |
| Hardcover down   | LOW        | HIGH     | Cache, retry queue                  | ⚠️ PLANNED   |
| Data loss        | LOW        | CRITICAL | Backup, dual source, rollback       | ✅ MITIGATED |

---

## ✅ Feasibility Checklist

**API Capabilities**:

- ✅ GraphQL endpoint documented and tested
- ✅ All required schemas available (Books, Users, Activities, Lists)
- ✅ Rate limits manageable (2% quota)
- ✅ Authentication straightforward (bearer token)

**KOReader Integration**:

- ✅ Plugin auto-syncs to Hardcover (no manual work)
- ✅ Activities API provides session data
- ✅ Fallback: statistics.sqlite parsing (if needed)

**Database Changes**:

- ✅ Schema design complete (6 migrations)
- ✅ Backward compatibility maintained (goodreads_id kept)
- ✅ Rollback strategy documented

**Migration Path**:

- ✅ Book matching algorithm designed (ISBN → title → fuzzy)
- ✅ Data backfill strategy defined
- ✅ Manual review workflow for low-confidence matches

**Risk Mitigation**:

- ✅ All high-severity risks addressed
- ✅ Backup strategy defined
- ✅ Phased approach reduces blast radius

---

## 📋 Implementation Checklist

### Story 1.5.1: Hardcover API Client

- [ ] Create `_shared/hardcover-client.ts`
- [ ] Implement rate limiting (60/min queue)
- [ ] Implement caching (TTL-based)
- [ ] Error handling (401, 429, 500)
- [ ] Exponential backoff on 429
- [ ] GraphQL query builders (Books, Activities, Lists, Users)
- [ ] Unit tests for all methods

### Story 1.5.2: Data Ingestion

- [ ] Query user's Activities history
- [ ] Book matching: ISBN → title → fuzzy
- [ ] Map Hardcover data → our schema
- [ ] Backfill hardcover_id
- [ ] Import book_activities timeline
- [ ] Parse Activities → reading_sessions
- [ ] Idempotency (dedup by hardcover_activity_id)

### Story 1.5.3: Schema Migration

- [ ] Write 6 migration SQL files
- [ ] Test migrations on staging
- [ ] Test rollback procedure
- [ ] Document migration sequence
- [ ] Create indexes for new columns

### Story 1.5.4: Deprecate Goodreads

- [ ] Disable RSS cron job
- [ ] Update all queries to use hardcover_id
- [ ] Archive RSS function (don't delete)
- [ ] Update documentation

---

## 🔗 Reference Links

**Hardcover API**:

- Docs: https://docs.hardcover.app/api/getting-started/
- Console: https://cloud.hasura.io/public/graphiql
- Schemas: https://docs.hardcover.app/api/graphql/schemas/

**KOReader**:

- Wiki: https://github.com/koreader/koreader/wiki
- Plugin: https://github.com/Billiam/hardcoverapp.koplugin
- Dev Docs: https://koreader.rocks/doc/

**Tools**:

- KoInsight (stats viewer): https://github.com/GeorgeSG/KoInsight

---

**Architect Sign-Off**: ✅ FEASIBLE | **Risk**: LOW | **Recommendation**: PROCEED

**Next**: Story card creation (PO) → Implementation (Dev)
