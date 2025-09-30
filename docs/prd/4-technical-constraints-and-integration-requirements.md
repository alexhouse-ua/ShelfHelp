# 4. Technical Constraints and Integration Requirements

- **Technology Stack:** The project will be built on TypeScript, Supabase (Postgres, Edge Functions, Cron), LangChain for AI integration, and LangGraph for complex stateful AI workflows.
- **Integration & Deployment:** The project uses a **streamlined CI/CD pipeline** (GitHub Actions) optimized for single-developer productivity. Simplified quality gates focus on essential checks (linting, testing, basic validation).
- **Standards:** The project enforces Conventional Commits and a PR-based workflow. To ensure code quality efficiently, **Husky will be used to manage pre-commit hooks** for formatting and linting, and a **pre-push hook will run a quick suite of unit tests** to catch functional bugs before code reaches the CI/CD pipeline.
