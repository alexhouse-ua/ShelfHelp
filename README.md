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
   Create a `.env` file with:
   ```env
   TELEGRAM_BOT_TOKEN=<your-bot-token>
   TELEGRAM_WEBHOOK_SECRET=<your-webhook-secret>
   GOOGLE_GEMINI_API_KEY=<your-gemini-key>
   SUPABASE_URL=http://127.0.0.1:54321
   SUPABASE_SERVICE_ROLE_KEY=<from-supabase-start-output>
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

- `tests/book_addition_test.ts` - Integration tests for conversational book addition (11 tests)
- `tests/webhook_test.ts` - Webhook authentication and database tests (3 tests)

### Test Requirements

- Local Supabase must be running (`supabase start`)
- Tests use service role key for database access
- Integration tests validate end-to-end workflows

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
│   │   └── _shared/      # Shared utilities
│   └── migrations/       # Database migrations
├── tests/                # Integration tests
└── docs/                 # Project documentation
```

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
