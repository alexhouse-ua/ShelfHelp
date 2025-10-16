# 8. External API Integration

## Telegram Bot API

- **Purpose:** To handle all user-facing communication.
- **Documentation:** [https://core.telegram.org/bots/api](https://core.telegram.org/bots/api)
- **Integration Method:** Receive data via a single webhook managed by `grammY`; send data via outbound REST API calls.

## Google Gemini API

- **Purpose:** To provide natural language understanding and generation.
- **Documentation:** [https://ai.google.dev/docs](https://ai.google.dev/docs)
- **Integration Method:** Outbound REST API calls via LangChain integration from Supabase Edge Functions.

---

### Gemini Embeddings (Production Baseline)

- **Model:** `text-embedding-004`
- **Dimensions:** 768
- **Endpoint:**
  - `POST https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=GOOGLE_GEMINI_API_KEY`
- **Request schema (camelCase):**
  - `model`: `models/text-embedding-004` (optional when included in path)
  - `content`: `{ parts: [{ text: string }] }`
  - `taskType`: `SEMANTIC_SIMILARITY`
  - `outputDimensionality`: `768`
- **Response shape:** `{ embedding: { values: number[] } }` (length must be 768)
- **Environment:** requires `GOOGLE_GEMINI_API_KEY`
- **Operational policy:**
  - Timeout: 5s per request
  - Retries: Exponential backoff on HTTP 429 (1s, 2s) up to 3 attempts
  - Error taxonomy: `TIMEOUT`, `RATE_LIMIT`, `API_ERROR:<status>`, `NETWORK_ERROR`
  - Structured logs: `operation=generate_embedding`, `moodTextLength`, `durationMs`, `attempt`
- **Rationale:** Migrated from `gemini-embedding-001` to `text-embedding-004` to align with current Gemini API and request field names (`taskType`, `outputDimensionality`).

## Hardcover GraphQL API

**Status:** ✅ ACTIVE (Epic 1.5+)
**Purpose:** Primary data source for books, reading sessions, activities, and list management
**Documentation:** [https://docs.hardcover.app/api/getting-started/](https://docs.hardcover.app/api/getting-started/)
**Console:** [https://cloud.hasura.io/public/graphiql?endpoint=https://api.hardcover.app/v1/graphql](https://cloud.hasura.io/public/graphiql?endpoint=https://api.hardcover.app/v1/graphql)

### API Configuration

- **Endpoint:** `https://api.hardcover.app/v1/graphql`
- **Method:** `POST` (GraphQL over HTTP)
- **Authentication:** Plain token in `authorization` header (NO "Bearer" prefix)
  - ✅ **Correct format:** `authorization: [TOKEN_VALUE]`
  - ❌ **Incorrect format:** `authorization: Bearer [TOKEN_VALUE]` (Hardcover does NOT use Bearer prefix)
  - Token location: https://hardcover.app/account/api
  - Environment variable: `HARDCOVER_API_TOKEN`
  - Token expiry: January 1st annually (auto-reset)

### Rate Limits & Constraints

- **Rate Limit:** 60 requests/minute
- **Daily Max:** 86,400 requests (60/min × 1440 min)
- **Query Timeout:** 30 seconds max
- **Query Depth:** 3 levels max
- **Disabled Operators:** `_like`, `_ilike` (regex operators disabled for performance)

### HTTP Status Codes

```
200: Success
401: Invalid/expired token (check expiry, refresh if needed)
403: Access denied (scope limitation)
404: Not found
429: Rate limited (exponential backoff required)
500: Server error (retry with backoff)
```

### Data Access Scope

- ✅ Your own user data (via `me` query)
- ✅ Public data (books, authors)
- ✅ Followed users' data
- ❌ Other private users

### Client Implementation

**Module:** `supabase/functions/_shared/hardcover-client.ts`

**Caching Strategy:**

```typescript
interface CacheConfig {
  books: { ttl: 24 * 60 * 60 * 1000 },      // 24h - metadata stable
  activities: { ttl: 5 * 60 * 1000 },        // 5min - progress updates
  lists: { ttl: 60 * 60 * 1000 },            // 1h - lists change slowly
  user: { ttl: 60 * 60 * 1000 }              // 1h - profile stable
}
```

**Cache Key Generation:**

- Implementation: Simple hash algorithm (djb2-style) sufficient for this use case
- Approach: Combines GraphQL query string + JSON stringified variables into stable cache key
- Formula: `hash(query + JSON.stringify(variables))`
- Rationale: Fast generation, no external dependencies, acceptable collision rate for API caching
- Future optimization: Can migrate to `crypto.subtle.digest('SHA-256', ...)` if needed for larger scale

**Rate Limit Handling:**

```typescript
// Exponential backoff on 429: 2s, 4s, 8s (3 attempts)
// CRITICAL: No "Bearer" prefix in authorization header
async function callHardcoverAPI<T>(query: string, variables: any, retries = 3): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const response = await fetch("https://api.hardcover.app/v1/graphql", {
      method: "POST",
      headers: {
        // ✅ Plain token (NO "Bearer" prefix) - This is NOT a standard OAuth bearer token
        "authorization": process.env.HARDCOVER_API_TOKEN,
        "content-type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });

    if (response.status === 429) {
      const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
      await sleep(waitTime);
      continue;
    }

    if (response.status === 401) {
      throw new Error("HARDCOVER_TOKEN_EXPIRED");
    }

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return (await response.json()).data;
  }
}
```

**Error Taxonomy:**

- `HARDCOVER_TOKEN_EXPIRED`: Token expired (Jan 1 annual reset)
- `HARDCOVER_RATE_LIMITED`: 429 after max retries
- `HARDCOVER_API_ERROR:<status>`: HTTP error (403, 404, 500)
- `HARDCOVER_NETWORK_ERROR`: Network failure
- `HARDCOVER_TIMEOUT`: Query timeout (>30s)

**Operational Policy:**

- Timeout: 30s per request (API constraint)
- Retries: Exponential backoff on 429 (2s, 4s, 8s) up to 3 attempts
- Structured logs: `operation=hardcover_query`, `queryType`, `cacheHit`, `durationMs`, `attempt`

### Key GraphQL Queries

#### Get Book Details

```graphql
query GetBook($id: Int!) {
  books(where: {id: {_eq: $id}}) {
    id, title, pages, release_date, description,
    isbn_10, isbn_13, moods, content_warnings,
    users_count, ratings_count, lists_count,
    series_name, series_position,
    genres { name },
    authors { name }
  }
}
```

#### Get User Activities (Reading Sessions)

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

#### Get User Lists

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

### Scheduled Sync Strategy

**pg_cron Jobs:**

```sql
-- Activities sync (every 5 minutes)
SELECT cron.schedule(
  'hardcover-activities-sync',
  '*/5 * * * *',
  $$ SELECT net.http_post(
    url := 'https://[project].supabase.co/functions/v1/hardcover-sync',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('vault.service_role_key')),
    body := jsonb_build_object('sync_type', 'activities')
  ); $$
);

-- Full sync (daily at 3 AM UTC)
SELECT cron.schedule(
  'hardcover-full-sync',
  '0 3 * * *',
  $$ SELECT net.http_post(
    url := 'https://[project].supabase.co/functions/v1/hardcover-sync',
    body := jsonb_build_object('sync_type', 'full')
  ); $$
);
```

### Integration Points

**Edge Functions:**

- `hardcover-sync`: Main sync orchestrator (activities, books, lists)
- `_shared/hardcover-client.ts`: Reusable GraphQL client

**Database Tables:**

- `books`: hardcover_id, moods, content_warnings, users_count, ratings_count
- `reading_sessions`: Calculated from Activities API deltas
- `book_activities`: Activity timeline (added, started, finished, rated, progress_update)
- `hardcover_lists` + `hardcover_list_books`: List sync

**Reference:** `docs/architect-research-hardcover-migration.md` (full technical specs)
