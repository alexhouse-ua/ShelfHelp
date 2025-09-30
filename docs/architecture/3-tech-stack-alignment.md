# 3. Tech Stack Alignment

## Approved Foundational Technology Stack

- **Deno is required**: Supabase Edge Functions, which are the core of our backend, are built to run on Deno. It is a required part of the Supabase platform, not an optional tool.
- **Principle**: All technology versions will be pinned to specific numbers (e.g., `v2.5.0`) before development begins to ensure a stable, reproducible build environment.

| Category         | Technology             | Rationale                                             |
| :--------------- | :--------------------- | :---------------------------------------------------- |
| Language         | TypeScript             | The primary language for the project.                 |
| Backend Runtime  | Deno                   | The required runtime for Supabase Edge Functions.     |
| Database         | PostgreSQL w/ pgvector | The core database and vector extension from Supabase. |
| AI Orchestration | LangChain + LangGraph  | The frameworks for building the AI logic.             |
| Scheduling       | pg\_cron               | The native cron job scheduler in Supabase.            |

## New Technology Additions (External Dependencies)

| Technology        | Purpose                                               |
| :---------------- | :---------------------------------------------------- |
| Telegram Bot API  | The API for the primary user interface.               |
| Google Gemini API | The API for natural language generation and analysis. |

## Development, Testing, and Deployment Tooling

| Category          | Technology            | Rationale                                                        |
| :---------------- | :-------------------- | :--------------------------------------------------------------- |
| Node.js Runtime   | Node.js LTS           | Required for the ecosystem of development tools like npm.        |
| Package Manager   | npm                   | For managing development tool dependencies.                      |
| Code Quality      | ESLint & Prettier     | Enforces consistent code style and prevents common errors.       |
| **Git Hooks**     | **Husky**             | **Automates local quality checks before commits and pushes.**    |
| **Bot Framework** | **grammY**            | **Simplifies interaction with the Telegram Bot API.**            |
| Testing           | Deno Test Runner      | The native, built-in solution for testing Deno applications.     |
| CI/CD             | GitHub Actions        | Native integration for deploying to Supabase.                    |
| Local Environment | Supabase CLI & Docker | Essential for emulating the full production environment locally. |
| Version Control   | Git                   | For source code management.                                      |

---
