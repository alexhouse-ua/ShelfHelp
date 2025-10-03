# 9. Source Tree Integration

# 9. Source Tree Integration

## Final Source Tree Pattern (Post-Epic 1)

ShelfHelp's source tree is intentionally simple, modular, and optimized for solo developer maintainability. The structure emerged organically during Epic 1, balancing Deno/Supabase Edge Function conventions, clear separation of concerns, and ease of deployment.

### Top-Level Structure

```
ShelfHelp/
├── .github/              # CI/CD workflows (GitHub Actions)
├── .husky/               # Git hooks (lint, format, test)
├── docs/                 # All project documentation (architecture, PRD, QA, epics, stories)
├── project-specs/        # Data specs, CSVs, YAMLs, project briefs
├── scripts/              # Utility scripts (SQL, TypeScript, shell)
├── supabase/             # Supabase project (Edge Functions, migrations, config)
│   ├── functions/        # Edge Functions (one subfolder per function)
│   │   ├── telegram-webhook/      # Main bot handler
│   │   ├── rss-ingestion/         # Goodreads RSS ingestion
│   │   ├── csv-backfill/          # Historical CSV import
│   │   ├── enrich-metadata/       # AI enrichment
│   │   ├── seed-lookup-data/      # Lookup table seeding
│   │   └── _shared/               # Shared utilities (logger, error-handler, etc.)
│   ├── migrations/        # Database schema migrations
│   └── config.toml        # Static file bundling config
├── tests/                # All test files (unit, integration)
├── package.json, deno.json, etc.  # Tooling configs
└── README.md, LICENSE, etc.
```

### Rationale

- **Edge Functions**: Each function is isolated in its own folder under `supabase/functions/`, with shared code in `_shared/` for DRYness and deployment efficiency.
- **Documentation**: All docs (architecture, PRD, epics, stories, QA) are under `docs/` for discoverability and versioning.
- **Specs & Data**: `project-specs/` holds all static data (YAML, CSV) and project briefs, decoupled from code and functions.
- **Scripts**: Utility scripts for data cleanup, seeding, and verification are in `scripts/`.
- **Tests**: All tests (unit, integration) are in `tests/`, following Deno conventions.
- **Migrations**: Database schema changes are tracked in `supabase/migrations/`.
- **Config**: Tooling and deployment configs are at the root for easy access.

### Key Integration Points

- **Static Data Bundling**: Static files (YAML, CSV) required by Edge Functions are bundled via `supabase/config.toml`.
- **CI/CD**: GitHub Actions workflows in `.github/` validate, test, and deploy on PRs and merges to `main`.
- **Local & Production Parity**: The structure supports seamless local development and production deployment with Supabase CLI.

### Evolution

This structure was validated by the successful completion of Epic 1, which required:

- Telegram bot integration
- Automated RSS ingestion
- Historical data backfill
- Lookup table seeding
- Robust error handling/logging
- End-to-end CI/CD and test automation

The pattern is expected to scale for future epics (AI enrichment, reporting, advanced recommendations) with minimal friction.

---

---
