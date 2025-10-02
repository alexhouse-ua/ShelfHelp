# ShelfHelp

AI-powered Telegram bot for intelligent book recommendation and library management.

## Overview

ShelfHelp helps readers discover their next great read through conversational AI interactions via Telegram. The system enriches book metadata, understands reading preferences, and provides personalized recommendations.

## Tech Stack

- **Runtime**: Deno (Supabase Edge Functions)
- **Database**: PostgreSQL with pgvector (Supabase)
- **Bot Framework**: grammY
- **AI**: Google Gemini API
- **Testing**: Deno Test Runner
- **CI/CD**: GitHub Actions
- **Code Quality**: ESLint, Prettier, Deno fmt/lint

## Getting Started

### Prerequisites

- [Deno](https://deno.land/) v2.x
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- [Docker](https://www.docker.com/) (for local Supabase)
- [Node.js](https://nodejs.org/) LTS (for development tools)
- Telegram Bot Token (from [@BotFather](https://t.me/botfather))
- Google Gemini API Key

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ShelfHelp
   ```

2. **Install dependencies**
   ```bash
   npm install  # Installs Husky, Prettier, ESLint
   ```

3. **Start local Supabase**
   ```bash
   supabase start
   ```
   This will start all Supabase services (PostgreSQL, PostgREST, Auth, Storage, etc.) in Docker containers.

4. **Configure environment variables**

   **Local Development:**
   ```bash
   # Copy the example file
   cp supabase/.env.local.example supabase/.env.local

   # Edit supabase/.env.local with your actual credentials
   ```

   Required variables:
   - `TELEGRAM_BOT_TOKEN` - Get from [@BotFather](https://t.me/botfather)
   - `TELEGRAM_WEBHOOK_SECRET` - Generate with `openssl rand -hex 32`
   - `GOOGLE_GEMINI_API_KEY` - Get from [Google AI Studio](https://makersuite.google.com/app/apikey)
   - `GOODREADS_RSS_FEED_URL_READ` - See below
   - `SUPABASE_URL` - Use `http://127.0.0.1:54321` for local
   - `SUPABASE_SERVICE_ROLE_KEY` - From `supabase start` output
   - `SUPABASE_ANON_KEY` - From `supabase start` output

   **Getting your Goodreads RSS URL:**
   1. Log in to Goodreads
   2. Go to My Books → Read shelf
   3. Scroll to bottom → RSS feed link
   4. Copy the full URL (includes your user ID and private key)

   **Production Deployment:**

   Set secrets via Supabase CLI (never commit these):
   ```bash
   supabase secrets set TELEGRAM_BOT_TOKEN="<your-token>"
   supabase secrets set GOOGLE_GEMINI_API_KEY="<your-key>"
   supabase secrets set GOODREADS_RSS_FEED_URL_READ="<your-url>"
   ```

   Set Vault secrets for pg_cron authentication (run via Supabase SQL Editor):
   ```sql
   SELECT vault.create_secret('https://your-project-ref.supabase.co', 'project_url');
   SELECT vault.create_secret('your-anon-key', 'anon_key');
   ```

5. **Run the bot locally**
   ```bash
   supabase functions serve
   ```

## Data Loading and Enrichment

### Lookup Data Loading

Populate lookup tables (genres, subgenres, tropes, spice_levels, recommendation_sources) from YAML files:

```bash
# Using Supabase CLI (local or production)
supabase functions invoke seed-lookup-data --env-file supabase/.env.local
```

**Data Sources:**

- `project-specs/classifications.yaml` - Genres, subgenres, tropes, spice levels
- `project-specs/recommendation-sources.yaml` - Book recommendation sources

**Updating YAML Data:**

1. Edit YAML files in `project-specs/`
2. Re-run the `seed-lookup-data` function (UPSERT handles duplicates)

### Historical Data Import

Import historical reading data from Goodreads CSV export:

```bash
# One-time CSV backfill
supabase functions invoke csv-backfill --env-file supabase/.env.local
```

**CSV Column Mappings:**

| Goodreads CSV Column | Database Field       | Notes                                            |
| -------------------- | -------------------- | ------------------------------------------------ |
| `Book Id`            | `goodreads_id`       | Unique identifier                                |
| `Title`              | `title`              | Book title                                       |
| `Author`             | `author`             | Book author                                      |
| `ISBN13` / `ISBN`    | `isbn`               | Prefers ISBN13, falls back to ISBN               |
| `My Rating`          | `user_rating`        | 1-5 rating                                       |
| `Date Read`          | `user_date_finished` | Parsed from MM/DD/YY format                      |
| `Date Added`         | `user_date_added`    | Parsed from MM/DD/YY format                      |
| `Publisher`          | `publisher`          | Publisher name                                   |
| `Number of Pages`    | `page_count`         | Page count                                       |
| `Year Published`     | `publication_date`   | Year only (YYYY-01-01)                           |
| `Status`             | `status`             | Maps: "read" → "finished", "to-read" → "to_read" |

**Date Format:** MM/DD/YY (e.g., "9/20/25" → 2025-09-20)

- Years 00-49 → 2000-2049
- Years 50-99 → 1950-1999

**Idempotency:** Re-running the import updates existing books based on `goodreads_id` (UPSERT).

### Metadata Enrichment

Enrich book records with AI-generated metadata (genres, tropes, themes, pacing, tone, writing style, POV, spice level):

```bash
# Enrich a specific book by ID
curl -X POST https://<project-ref>.supabase.co/functions/v1/enrich-metadata \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"book_id": "<uuid>"}'
```

**Enrichment Fields:**

- `genres_primary` (array) - Primary genres
- `genres_secondary` (array) - Secondary genres
- `tropes` (array) - Story tropes
- `themes` (array) - Thematic elements
- `pacing` (string) - slow/medium/fast
- `tone` (string) - light/dark/mixed
- `writing_style` (string) - descriptive/minimalist/lyrical/etc
- `pov_type` (string) - first-person/third-person-limited/etc
- `pov_gender` (string) - male/female/multiple/neutral/unknown
- `spice_level` (string) - none/low/medium/high

**API Requirements:**

- Requires `GOOGLE_GEMINI_API_KEY` environment variable
- Uses Gemini 1.5 Pro for complex metadata analysis
- Retry logic with exponential backoff for rate limits

### Troubleshooting

**CSV Import Issues:**

- **Invalid date format**: Ensure dates are in MM/DD/YY format
- **Missing goodreads_id**: Rows without Book Id are skipped
- **Duplicate imports**: UPSERT prevents duplicates; check response summary for `booksUpdated` count

**YAML Seeding Issues:**

- **Invalid YAML structure**: Validate YAML syntax at [yamllint.com](http://www.yamllint.com/)
- **Missing required fields**: Ensure `Genres`, `Spice_Levels`, `Tropes` sections exist in classifications.yaml
- **Foreign key errors**: Genres must be seeded before tropes/subgenres

**Enrichment Issues:**

- **API rate limits**: Gemini API has rate limits; retry logic handles this automatically
- **Invalid JSON response**: Check Gemini API status and model availability
- **Missing API key**: Ensure `GOOGLE_GEMINI_API_KEY` is set in environment

## Testing

### Running Tests Locally

```bash
# Run all tests
deno test -A

# Run specific test file
deno test -A tests/book_addition_test.ts

# Run with watch mode
deno test -A --watch
```

### Test Structure

**Unit Tests (Fast, No External Dependencies):**

- `tests/rss_ingestion.unit.test.ts` - RSS ingestion logic with mocked dependencies (9 tests)
  - Always runs in CI
  - No production credentials required
  - Covers parsing, error handling, field mapping

**Integration Tests (Require Running Services):**

- `tests/book_addition_test.ts` - Conversational book addition end-to-end (11 tests)
- `tests/webhook_test.ts` - Webhook authentication and database (3 tests)
- `tests/rss_ingestion.integration.test.ts` - RSS ingestion against live Supabase (optional, 2 tests)
  - Skipped by default in CI
  - Run manually with local Supabase or `TEST_RSS_INGESTION_LIVE=1`

### Test Requirements

**Unit Tests:**

- No external services required
- Run with: `deno test -A tests/*.unit.test.ts`

**Integration Tests:**

- Local Supabase must be running (`supabase start`)
- Tests use service role key for database access
- Run with: `deno test -A tests/*.test.ts`

**Running RSS Integration Tests (Optional):**

```bash
# 1. Start local Supabase
supabase start

# 2. Configure environment (see .env.local.example)
cp supabase/.env.local.example supabase/.env.local
# Edit supabase/.env.local with local credentials

# 3. Run integration tests
deno test -A tests/rss_ingestion.integration.test.ts
```

## Error Handling & Logging Standards

ShelfHelp uses centralized error handling and logging utilities for consistent, traceable operations across all Edge Functions.

### Logger Usage

**Import and create logger instance:**

```typescript
import { createLogger, generateRequestId } from "../_shared/logger.ts";

const requestId = generateRequestId();
const logger = createLogger(requestId);
```

**Log levels and when to use them:**

- **info**: Normal operation events (request received, operation completed, data processed)
- **warn**: Recoverable issues that may require attention (rate limit approaching, fallback used, deprecated feature)
- **error**: Failures requiring investigation (API errors, database errors, validation failures)
- **debug**: Detailed debugging information for development (variable states, intermediate results)

**Usage examples:**

```typescript
// Info logging
logger.info("Processing book addition", {
  chatId: 12345,
  bookTitle: "Example Book",
});

// Error logging
logger.error("Failed to save book to database", {
  error: error.message,
  bookId: "abc-123",
});

// Warning logging
logger.warn("Rate limit approaching", {
  remaining: 10,
  resetTime: new Date().toISOString(),
});

// Debug logging
logger.debug("Gemini API response received", {
  model: "gemini-1.5-pro",
  tokensUsed: 450,
});
```

**Log output format:**

```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "level": "info",
  "message": "Book saved successfully",
  "timestamp": "2025-10-02T00:00:00.000Z",
  "context": {
    "chatId": 12345,
    "bookId": "abc-123"
  }
}
```

### Error Handler Usage

**Import error handlers:**

```typescript
import {
  badRequest,
  forbidden,
  internalError,
  notFound,
  unauthorized,
} from "../_shared/error-handler.ts";
```

**HTTP error helper functions:**

| Function          | Status | Use Case                                       |
| ----------------- | ------ | ---------------------------------------------- |
| `badRequest()`    | 400    | Invalid input, malformed requests              |
| `unauthorized()`  | 401    | Missing or invalid authentication              |
| `forbidden()`     | 403    | Valid auth, insufficient permissions           |
| `notFound()`      | 404    | Resource doesn't exist                         |
| `internalError()` | 500    | Unexpected server errors, unhandled exceptions |

**Usage examples:**

```typescript
// Validation error
if (!bookId) {
  return badRequest("Missing required parameter: book_id", requestId);
}

// Authentication error
if (!isAuthorized(token)) {
  return unauthorized("Invalid or expired token", requestId);
}

// Resource not found
if (!book) {
  return notFound("Book not found", requestId, { bookId });
}

// Internal server error
try {
  // ... operation
} catch (error) {
  logger.error("Unexpected error", { error: error.message });
  return internalError("An unexpected error occurred", requestId);
}
```

**Error response format:**

```json
{
  "error": "Book not found",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "details": {
    "bookId": "abc-123"
  }
}
```

### Best Practices

**DO:**

- ✅ Always generate a unique `requestId` at the start of each function
- ✅ Create a logger instance using `createLogger(requestId)`
- ✅ Use structured context objects for rich logging data
- ✅ Use appropriate log levels (info/warn/error/debug)
- ✅ Include the `requestId` in all error responses for traceability
- ✅ Use error handler helpers instead of manual Response objects

**DON'T:**

- ❌ Log sensitive data (tokens, secrets, passwords, API keys, personal information)
- ❌ Use `console.log()` directly - always use the logger utility
- ❌ Create manual error Response objects - use error handler helpers
- ❌ Skip context objects - they're essential for debugging
- ❌ Use generic error messages - be specific and actionable

**Example Edge Function structure:**

```typescript
import { createLogger, generateRequestId } from "../_shared/logger.ts";
import { badRequest, internalError } from "../_shared/error-handler.ts";

Deno.serve(async (req: Request) => {
  const requestId = generateRequestId();
  const logger = createLogger(requestId);

  logger.info("Function invoked", { method: req.method });

  try {
    // Validate input
    const body = await req.json();
    if (!body.bookId) {
      return badRequest("Missing book_id", requestId);
    }

    // Process request
    logger.info("Processing book", { bookId: body.bookId });
    const result = await processBook(body.bookId, logger);

    logger.info("Function completed successfully");
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    logger.error("Function failed", {
      error: error.message,
      stack: error.stack,
    });
    return internalError(error.message, requestId);
  }
});
```

### Troubleshooting

**Common logging issues:**

- **Logs not appearing**: Check Edge Function logs with `supabase functions logs <function-name>`
- **Missing requestId**: Ensure you're creating logger with `createLogger(requestId)`
- **Malformed JSON logs**: Verify context objects don't contain circular references
- **Sensitive data in logs**: Review context objects and remove tokens/secrets/passwords

**Common error handling issues:**

- **Inconsistent error format**: Always use error handler helpers, not manual Response objects
- **Missing requestId in errors**: Pass `requestId` to all error handler functions
- **Generic error messages**: Provide specific, actionable error messages for debugging
- **Leaked error details**: Avoid exposing internal implementation details in production errors

## Code Quality

### Linting

```bash
# Run Deno linter
deno lint

# Run ESLint (if applicable)
npx eslint .
```

### Formatting

```bash
# Check formatting
deno fmt --check

# Auto-format code
deno fmt

# Format with Prettier
npx prettier --write .
```

### Git Hooks (Husky)

Pre-commit hooks automatically run:

- Prettier
- ESLint
- Deno fmt
- Deno lint

Pre-push hooks automatically run:

- Full Deno test suite (`deno test -A`)

## CI/CD Pipeline

### Continuous Integration (Pull Requests)

Triggers on all pull requests. Steps:

1. Checkout code
2. Setup Deno
3. Run `deno lint`
4. Run `deno fmt --check`
5. Start local Supabase
6. Run `deno test -A`

### Continuous Deployment (Main Branch)

Triggers on push to `main`. Steps:

1. Checkout code
2. Setup Supabase CLI
3. Deploy Edge Functions to production

### Required GitHub Secrets

Configure these in your GitHub repository settings (Settings → Secrets and variables → Actions):

- `SUPABASE_ACCESS_TOKEN` - Personal access token from Supabase dashboard
- `SUPABASE_PROJECT_ID` - Project reference ID from Supabase project settings

## Project Structure

```text
ShelfHelp/
├── .github/workflows/     # GitHub Actions CI/CD
│   ├── ci.yml            # Pull request validation
│   └── deploy.yml        # Production deployment
├── .husky/               # Git hooks
│   ├── pre-commit        # Linting and formatting
│   └── pre-push          # Test execution
├── supabase/
│   ├── functions/        # Edge Functions
│   │   ├── telegram-webhook/  # Main bot handler
│   │   ├── rss-ingestion/     # Goodreads RSS feed ingestion
│   │   └── _shared/      # Shared utilities
│   └── migrations/       # Database migrations
├── tests/                # Integration tests
└── docs/                 # Project documentation
```

## Features

### Automated RSS Ingestion

ShelfHelp automatically syncs your Goodreads "read" shelf via RSS feeds.

**How it works:**

- A `pg_cron` job runs daily at 2 AM UTC
- Fetches your Goodreads RSS feed
- Parses book metadata (title, author, rating, dates, etc.)
- Upserts books to database (new books inserted, existing books updated)
- No duplicates - matched by `goodreads_id`

**Manual Trigger (Testing):**

```bash
# Using curl
curl -X POST http://127.0.0.1:54321/functions/v1/rss-ingestion \
  -H "Authorization: Bearer <your-anon-key>" \
  -H "Content-Type: application/json"

# Or via Supabase CLI
supabase functions invoke rss-ingestion --env-file supabase/.env.local
```

**Monitoring:**

- Check Edge Function logs: `supabase functions logs rss-ingestion`
- Query ingestion results: `SELECT * FROM books WHERE goodreads_id IS NOT NULL ORDER BY created_at DESC LIMIT 10;`

**Troubleshooting:**

- **RSS feed not configured**: Set `GOODREADS_RSS_FEED_URL_READ` in `.env` (local) or Supabase secrets (production)
- **Cron job not running**: Verify pg_cron extension enabled and job scheduled: `SELECT jobname, schedule FROM cron.job;`
- **Books not appearing**: Check Edge Function logs for parsing errors or XML format changes

## Development Workflow

1. Create feature branch from `main`
2. Make changes (hooks will run on commit)
3. Push changes (tests will run automatically)
4. Create pull request (CI will validate)
5. Merge to `main` (CD will deploy)

## Troubleshooting

### Tests Failing Locally

- **Supabase not running**: Run `supabase start`
- **Schema out of sync**: Run `supabase db reset`
- **Port conflicts**: Stop conflicting services or run `supabase stop` then `supabase start`

### CI/CD Failures

- **Lint errors**: Run `deno fmt` and `deno lint` locally
- **Test failures**: Verify tests pass locally with `deno test -A`
- **Deployment failures**: Check GitHub Secrets are configured correctly

### Database Issues

- **Tables not found**: Run database migrations with `supabase db reset`
- **Permission denied**: Verify service role key is correct in `.env`

## License

MIT

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
