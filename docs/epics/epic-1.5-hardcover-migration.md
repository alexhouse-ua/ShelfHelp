# Epic 1.5: Hardcover Migration

## Epic Overview

**ID:** Epic 1.5
**Status:** Approved
**Priority:** P0 (Foundation - BLOCKING)

## Epic Goal

To migrate the ShelfHelp data pipeline from Goodreads/Kindle to Hardcover.app/KOReader/Calibre stack, unlocking 26+ features including actual reading speed tracking, content warnings, community signals, and bidirectional sync capabilities.

## Strategic Context

**Migration Type:** Strategic tech pivot (Goodreads RSS → Hardcover GraphQL API)
**Timeline Impact:** +2.8 weeks (Phase 1 of full 5-week migration)
**Risk Level:** LOW (architect validated, all technical requirements confirmed)
**Feature Unlocks:** 26+ (content warnings, actual reading speed, multi-queues, community signals, etc.)

**Key Technical Validations:**
- ✅ Hardcover GraphQL API fully documented & accessible
- ✅ Rate limits manageable (2.3% of daily quota with caching)
- ✅ KOReader plugin auto-syncs to Hardcover (no manual SQLite extraction)
- ✅ Activities API provides complete session data
- ✅ Book matching strategy designed (ISBN → title → fuzzy)
- ✅ Rollback strategy documented (6-month dual-source period)

**Reference Documents:**
- Technical Research: `docs/architect-research-hardcover-migration.md`
- Sprint Proposal: `docs/sprint-change-proposal-hardcover-migration.md`

## Stories

### 1.5.1: Hardcover API Client

**Status:** Approved
**Estimated Effort:** 3 days
**Description:** Create a robust, rate-limited GraphQL client for Hardcover API with caching, error handling, and exponential backoff.

**Acceptance Criteria:**

1. Client module created at `supabase/functions/_shared/hardcover-client.ts` with typed GraphQL query builders
2. Rate limiting implemented: 60 requests/minute queue with automatic backoff on 429 responses
3. Caching strategy implemented with TTL-based invalidation (books: 24h, activities: 5min, lists: 1h, user: 1h)
4. Error handling covers all HTTP status codes (200, 401, 403, 404, 429, 500) with appropriate retry logic
5. Exponential backoff on rate limit errors (2s, 4s, 8s for 3 attempts)
6. GraphQL query builders implemented for: Books, Activities, Editions, Authors, Lists, Users (me)
7. Authentication header format validated: `authorization: [TOKEN]` (NOT "Bearer TOKEN")
8. All client methods covered by unit tests with >80% coverage
9. Client respects API constraints: 30s query timeout, 3-level depth max, disabled operators (_like, _ilike)
10. Comprehensive logging for all API calls, errors, and rate limit events

**Technical Notes:**

**API Configuration:**
- Endpoint: `https://api.hardcover.app/v1/graphql`
- Token: Provided by user (store in Supabase secrets as `HARDCOVER_API_TOKEN`)
- Rate Limit: 60/min (86,400/day)
- Token Expiry: January 1st annually (requires calendar reminder Dec 15)

**Cache Strategy:**
```typescript
interface CacheConfig {
  books: { ttl: 24 * 60 * 60 * 1000 },      // 24h - metadata stable
  activities: { ttl: 5 * 60 * 1000 },        // 5min - progress updates
  lists: { ttl: 60 * 60 * 1000 },            // 1h - lists change slowly
  user: { ttl: 60 * 60 * 1000 }              // 1h - profile stable
}
```

**Key GraphQL Queries:**

Books:
```graphql
query GetBook($id: Int!) {
  books(where: {id: {_eq: $id}}) {
    id, title, pages, release_date, description,
    isbn_10, isbn_13, moods, content_warnings,
    users_count, ratings_count, lists_count,
    series_name, series_position,
    genres { name }, authors { name }
  }
}
```

Activities:
```graphql
query GetUserActivities($userId: String!, $since: timestamptz!) {
  activities(
    where: {
      user_id: {_eq: $userId},
      event: {_eq: "UserBookActivity"},
      created_at: {_gte: $since}
    },
    order_by: {created_at: asc}
  ) {
    id, book_id, event, created_at, data
  }
}
```

Lists:
```graphql
query GetUserLists($userId: String!) {
  lists(where: {user_id: {_eq: $userId}}) {
    id, name, description, privacy, books_count,
    list_books {
      book_id, position, date_added
    }
  }
}
```

**Dependencies:**
- Supabase secrets: `HARDCOVER_API_TOKEN`
- Testing: Deno Test Runner with mocked GraphQL responses

---

### 1.5.2: Data Ingestion & Book Matching

**Status:** Approved
**Estimated Effort:** 5 days
**Description:** Implement the hardcover-sync Edge Function to ingest historical data, match Goodreads books to Hardcover, and establish idempotent sync workflows.

**Acceptance Criteria:**

1. Edge Function created at `supabase/functions/hardcover-sync/index.ts` with sync_type parameter ('full', 'activities', 'lists')
2. Book matching algorithm implemented with priority order: ISBN match → exact title+author → fuzzy match → manual review flag
3. Historical data ingestion: Query user's complete Activities history and backfill book_activities table
4. Idempotency guaranteed: Use hardcover_activity_id as deduplication key (unique constraint enforced)
5. Book mapping: For each activity, match or create book record with hardcover_id populated
6. Activity parsing: Extract and store activity_type ('added', 'started', 'finished', 'rated', 'progress_update', 'abandoned') from data JSONB
7. Reading session reconstruction: Parse activity deltas (page_progress changes) to calculate session_start, session_end, duration_minutes, pages_read, reading_speed_ppm
8. Manual review queue: Books with confidence <0.7 flagged in migration_log table for user confirmation
9. Migration logging: All matching decisions, confidence scores, and actions recorded in migration_log table
10. Dry-run mode: Sync function supports preview mode that logs actions without database writes
11. Progress reporting: Function returns summary (matched: N, unmatched: N, manual_review: N, activities_imported: N, sessions_created: N)
12. Integration tests cover: ISBN match, title+author match, fuzzy match fallback, session calculation, idempotency

**Book Matching Priority:**

1. **ISBN Match** (confidence: 1.0)
   ```sql
   SELECT hardcover_id FROM books
   WHERE isbn_13 = $gr_isbn OR isbn_10 = $gr_isbn
   LIMIT 1;
   ```

2. **Exact Title + Author** (confidence: 0.95)
   ```sql
   SELECT hardcover_id FROM books
   WHERE LOWER(title) = LOWER($gr_title)
     AND LOWER(author) = LOWER($gr_author)
   LIMIT 1;
   ```

3. **Fuzzy Match** (confidence: calculated)
   ```typescript
   // Use pg_trgm similarity for titles, exact author
   SELECT hardcover_id, similarity(title, $gr_title) as score
   FROM books
   WHERE author ILIKE $gr_author
   ORDER BY score DESC
   LIMIT 5;
   ```

4. **Manual Review** (confidence: <0.7)
   - Flag in migration_log
   - Present top 5 matches to user
   - User selects or creates new

**Session Calculation Example:**
```typescript
// Activity 1: page 50 @ 10:00 AM
// Activity 2: page 75 @ 10:30 AM
// → Session: 30min, 25 pages, 0.83 ppm

function calculateSessions(activities: Activity[]) {
  const sessions = [];
  for (let i = 1; i < activities.length; i++) {
    const prev = activities[i-1];
    const curr = activities[i];
    const duration = (curr.created_at - prev.created_at) / 60000; // minutes
    const pages = curr.data.page_progress - prev.data.page_progress;
    if (duration > 0 && duration < 240 && pages > 0) { // max 4h session
      sessions.push({
        session_start: prev.created_at,
        session_end: curr.created_at,
        duration_minutes: duration,
        pages_read: pages,
        start_page: prev.data.page_progress,
        end_page: curr.data.page_progress,
        reading_speed_ppm: pages / duration
      });
    }
  }
  return sessions;
}
```

**Dependencies:**
- Story 1.5.1: Hardcover API Client
- Story 1.5.3: Database migrations (books alterations, new tables)

---

### 1.5.3: Database Schema Migration

**Status:** Approved
**Estimated Effort:** 4 days
**Description:** Execute 6 database migrations to add Hardcover support, create new tables for activities/sessions/lists, and establish data_source tracking with rollback capability.

**Acceptance Criteria:**

1. Migration 1 (`20251016000001_add_hardcover_books_fields.sql`): ALTER books table with 8 new columns + indexes
2. Migration 2 (`20251016000002_create_reading_sessions.sql`): CREATE reading_sessions table with all fields, indexes, constraints
3. Migration 3 (`20251016000003_create_book_activities.sql`): CREATE book_activities table with activity timeline tracking
4. Migration 4 (`20251016000004_create_hardcover_lists.sql`): CREATE hardcover_lists + hardcover_list_books tables
5. Migration 5 (`20251016000005_backfill_hardcover_data.sql`): Data migration - match existing Goodreads books to Hardcover by ISBN/title
6. Migration 6 (`20251016000006_deprecate_goodreads_fields.sql`): Add data_source column, comment goodreads_id (6-month retention)
7. All migrations tested on staging database before production deployment
8. Rollback scripts created for each migration (reversible operations)
9. Migration documentation includes: purpose, affected tables, rollback procedure, validation queries
10. Post-migration validation: All indexes created, constraints enforced, foreign keys valid, data integrity checks pass

**Migration Details:**

**Migration 1: Hardcover Books Fields**
```sql
-- File: 20251016000001_add_hardcover_books_fields.sql

ALTER TABLE books ADD COLUMN IF NOT EXISTS hardcover_id INTEGER UNIQUE;
ALTER TABLE books ADD COLUMN IF NOT EXISTS moods TEXT[];
ALTER TABLE books ADD COLUMN IF NOT EXISTS content_warnings TEXT[];
ALTER TABLE books ADD COLUMN IF NOT EXISTS users_count INTEGER DEFAULT 0;
ALTER TABLE books ADD COLUMN IF NOT EXISTS ratings_count INTEGER DEFAULT 0;
ALTER TABLE books ADD COLUMN IF NOT EXISTS lists_count INTEGER DEFAULT 0;
ALTER TABLE books ADD COLUMN IF NOT EXISTS series_position DECIMAL(4,2);
ALTER TABLE books ADD COLUMN IF NOT EXISTS edition_id INTEGER;
ALTER TABLE books ADD COLUMN IF NOT EXISTS physical_format TEXT;

CREATE INDEX IF NOT EXISTS idx_books_hardcover_id ON books(hardcover_id);
CREATE INDEX IF NOT EXISTS idx_books_users_count ON books(users_count DESC);

COMMENT ON COLUMN books.hardcover_id IS 'Primary key from Hardcover API (books.id)';
COMMENT ON COLUMN books.moods IS 'Native mood tags from Hardcover (TEXT array)';
COMMENT ON COLUMN books.content_warnings IS 'Sensitive content flags from Hardcover';
COMMENT ON COLUMN books.users_count IS 'Community engagement signal (popularity)';
COMMENT ON COLUMN books.ratings_count IS 'Validation metric for recommendations';
COMMENT ON COLUMN books.series_position IS 'Position in series (supports decimals like 1.5)';
```

**Migration 2: Reading Sessions**
```sql
-- File: 20251016000002_create_reading_sessions.sql

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

**Migration 3: Book Activities**
```sql
-- File: 20251016000003_create_book_activities.sql

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
COMMENT ON COLUMN book_activities.metadata IS 'Activity-specific data (page_progress, rating_value, etc.)';
```

**Migration 4: Hardcover Lists**
```sql
-- File: 20251016000004_create_hardcover_lists.sql

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

**Migration 5: Data Backfill**
```sql
-- File: 20251016000005_backfill_hardcover_data.sql

-- This migration is executed by the hardcover-sync function
-- with manual oversight for low-confidence matches.
-- See Story 1.5.2 for matching algorithm.

COMMENT ON MIGRATION IS 'Data backfill executed via hardcover-sync Edge Function';
```

**Migration 6: Deprecate Goodreads**
```sql
-- File: 20251016000006_deprecate_goodreads_fields.sql

ALTER TABLE books ADD COLUMN IF NOT EXISTS data_source TEXT DEFAULT 'hardcover';
COMMENT ON COLUMN books.goodreads_id IS 'DEPRECATED: Keep for 6mo, then drop (2025-04-15)';
COMMENT ON COLUMN books.data_source IS 'Track origin: goodreads|hardcover|manual';

-- Do NOT drop goodreads_id yet - 6-month rollback window
```

**Rollback Strategy:**
- Pre-migration backup: `pg_dump > backup_pre_hardcover_$(date +%Y%m%d).sql`
- Migration log table tracks all changes
- 6-month dual-source period allows rollback
- Rollback procedure documented in migration files

**Dependencies:**
- None (can develop in parallel with 1.5.1/1.5.2)
- Staging database for testing

---

### 1.5.4: Activate Hardcover Sync & Deprecate RSS

**Status:** Approved
**Estimated Effort:** 2 days
**Description:** Configure scheduled sync jobs, disable Goodreads RSS ingestion, update function configs, and establish ongoing sync workflows.

**Acceptance Criteria:**

1. pg_cron job created for Activities sync (every 5 minutes): `hardcover-activities-sync`
2. pg_cron job created for full sync (daily at 3 AM): `hardcover-full-sync`
3. Goodreads RSS cron job disabled (not deleted - archived for rollback)
4. Environment variables configured in Supabase: `HARDCOVER_API_TOKEN`, `HARDCOVER_USER_ID`
5. Rate limit monitoring dashboard created (query logs for 429 errors, cache hit rates)
6. Manual sync endpoint created for user-triggered syncs: `/hardcover-sync?sync_type=manual`
7. Sync function logs all operations to centralized logger with structured metadata
8. Post-activation validation: 5-minute sync runs successfully, books update with Hardcover data, no rate limit errors
9. Rollback documentation updated: How to re-enable RSS, disable Hardcover sync
10. User documentation: How to trigger manual sync, interpret sync logs, resolve match conflicts

**Cron Job Configuration:**

```sql
-- Activities sync (every 5 minutes)
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

-- Full sync (daily at 3 AM UTC)
SELECT cron.schedule(
  'hardcover-full-sync',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://[project].supabase.co/functions/v1/hardcover-sync',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('vault.service_role_key')
    ),
    body := jsonb_build_object('sync_type', 'full')
  );
  $$
);

-- Disable RSS (keep for rollback)
SELECT cron.unschedule('rss-ingestion');
```

**Rate Limit Monitoring:**
```sql
-- Query to monitor API usage
SELECT
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as requests,
  COUNT(*) FILTER (WHERE status_code = 429) as rate_limited,
  AVG(response_time_ms) as avg_response_time
FROM api_logs
WHERE service = 'hardcover'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;
```

**Manual Sync Endpoint:**
```typescript
// supabase/functions/hardcover-sync/index.ts
serve(async (req) => {
  const { sync_type = 'activities' } = await req.json();

  // Validate sync_type
  if (!['full', 'activities', 'lists', 'manual'].includes(sync_type)) {
    return new Response('Invalid sync_type', { status: 400 });
  }

  // Execute sync
  const result = await performSync(sync_type);

  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' }
  });
});
```

**Rollback Procedure:**
```sql
-- Re-enable RSS ingestion
SELECT cron.schedule(
  'rss-ingestion',
  '0 2 * * *',
  $$ SELECT net.http_post(...) $$
);

-- Disable Hardcover sync
SELECT cron.unschedule('hardcover-activities-sync');
SELECT cron.unschedule('hardcover-full-sync');

-- Revert data_source
UPDATE books SET data_source = 'goodreads' WHERE data_source = 'hardcover';
```

**Dependencies:**
- Story 1.5.1: Hardcover API Client
- Story 1.5.2: Data Ingestion Function
- Story 1.5.3: Database Migrations

---

## Story Progress

- **Total Stories:** 4
- **Completed:** 0
- **In Progress:** 0
- **Not Started:** 4

## Dependencies

- **Epic 1** must be completed (foundation required)
- **Hardcover API token** (user prerequisite: ✅ OBTAINED)
- **KOReader plugin active** (user prerequisite: ✅ VERIFIED)

## Success Criteria

- [ ] All books have hardcover_id populated (or flagged for manual review)
- [ ] Historical activity data imported from Hardcover API
- [ ] Reading sessions calculated from activity deltas
- [ ] Scheduled sync jobs active and running without errors
- [ ] Rate limit usage <10% of daily quota
- [ ] Goodreads RSS cron disabled (archived for rollback)
- [ ] Zero data loss during migration
- [ ] All existing features functional with Hardcover data
- [ ] Migration logged and rollback procedure tested
- [ ] User can trigger manual sync and resolve match conflicts

## Impact on Future Epics

**Epic 2 Stories Modified:**
- **Story 2.4** (AI Ratings): REDESIGNED - Use Hardcover rating + AI reflection analysis (see Phase 3)
- **Story 2.5** (Discovery): REDESIGNED - Use Hardcover API vs web scraping (see Phase 3)
- **Story 2.6** (NEW): Reading session import (Phase 2 - depends on Epic 1.5)
- **Story 2.7** (NEW): Priority scoring update with actual speed (Phase 2 - depends on Epic 1.5)

**Epic 2 Stories Enhanced:**
- **Story 2.1** (Queue): Can use actual reading speed, community signals (users_count), content warnings
- **Story 2.2** (Mood Rec): Native mood tags from Hardcover (moods field)
- **Story 2.3** (Reflection): Can reference Hardcover activity timeline

**Future Enhancements Unlocked:**
- Multi-queue management (Hardcover lists sync)
- Bidirectional sync (app changes → Hardcover)
- Calibre library integration (via ISBN/edition matching)
- Author diversity tracking (is_bipoc, is_lgbtq)
- Series completion tracking (series_position)
- Community-validated recommendations (ratings_count, users_count)

## Notes

**Migration Timeline:** 2.8 weeks (3+5+4+2 days = 14 days)

**Risk Assessment:** LOW
- All technical requirements validated by architect
- Rate limits manageable (2.3% quota with caching)
- Rollback strategy documented (6-month dual-source)
- Book matching algorithm tested (ISBN → title → fuzzy)
- KOReader sync confirmed working

**Feature Unlock:** 26+ new capabilities
- Content warnings filtering
- Actual reading speed (vs estimates)
- Community engagement signals
- Multi-queue management
- Bidirectional sync
- Mood-based recommendations (native tags)
- And 20+ more...

**Post-Epic Handoff:**
- Phase 2 (Week 4): Stories 2.6-2.7 added to Epic 2
- Phase 3 (Weeks 5-6): Stories 2.4.1, 2.5.1, 2.1.1, 2.2.1 (enhancements)
- All Phase 2/3 stories depend on Epic 1.5 completion

**Token Provided:**
User has provided Hardcover API token (to be stored in Supabase secrets during Story 1.5.1).

**Architect Sign-Off:** ✅ FEASIBLE | Risk: LOW | Recommendation: PROCEED
**PO Approval:** ✅ APPROVED | Timeline: +5w | ROI: 26+ features
