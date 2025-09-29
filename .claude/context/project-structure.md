---
created: 2025-09-28T23:39:01Z
last_updated: 2025-09-29T00:19:33Z
version: 1.1
author: Claude Code PM System
---

# Project Structure

## Current Directory Organization

```
ShelfHelp/
├── .claude/                    # Claude Code configuration
│   ├── context/               # Project context documentation
│   ├── epics/                 # Technical implementation epics (NEW)
│   │   ├── installation-configuration/
│   │   ├── telegram-bot-foundation/
│   │   ├── conversational-book-management/
│   │   ├── data-ingestion-pipeline/
│   │   ├── ai-recommendation-engine/
│   │   ├── post-read-reflection-system/
│   │   └── automated-insights-reporting/
│   ├── prds/                  # Product requirements documents (NEW)
│   ├── hooks/                 # Git hooks and automation
│   └── scripts/               # PM and utility scripts
├── .git/                      # Git repository
├── CLAUDE.md                  # Project instructions and standards
└── project-specs/             # Project specification documents
    ├── architecture.md        # System architecture blueprint
    ├── classifications.yaml   # Book classification schemas
    ├── prd.md                 # Product requirements document
    ├── project-brief.md       # Executive project overview
    ├── recommendation-sources.yaml # Data source configurations
    └── token-efficiency.md    # AI token optimization strategies
```

## Planned Structure (To Be Created)

Based on the architecture document, the following structure will emerge during development:

```
ShelfHelp/
├── src/                       # TypeScript source code
│   ├── functions/             # Supabase Edge Functions
│   ├── types/                 # Shared TypeScript types
│   ├── services/              # Business logic services
│   └── utils/                 # Utility functions
├── database/                  # Database schemas and migrations
├── tests/                     # Test files (unit and integration)
├── docs/                      # Generated documentation
└── config/                    # Configuration files
```

## Key Directories Explained

### `.claude/`
Claude Code configuration directory containing:
- **context/**: Project documentation and context files
- **epics/**: Technical implementation epics with GitHub issue sync
- **prds/**: Product requirements documents for each epic
- **hooks/**: Git automation and workflow scripts
- **scripts/**: Project management and utility scripts

### `project-specs/`
Complete project specification documents:
- **architecture.md**: Technical architecture and component design
- **prd.md**: Detailed product requirements and epic roadmap
- **project-brief.md**: Executive summary and project vision
- **classifications.yaml**: Book genre and metadata schemas
- **recommendation-sources.yaml**: Data source configurations

## File Naming Patterns

### Documentation
- Use kebab-case for markdown files (`project-brief.md`)
- Use descriptive, specific names
- Include file type suffix for clarity

### Code (Planned)
- TypeScript files use camelCase for functions, PascalCase for classes
- Edge Functions use kebab-case directory structure
- Test files follow `*.test.ts` pattern

## Module Organization

The project will use a modular, service-oriented architecture:
- Each Supabase Edge Function is a single-responsibility component
- Shared types ensure type safety across components
- Services encapsulate business logic separate from API handlers