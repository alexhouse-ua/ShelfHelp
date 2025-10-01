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
