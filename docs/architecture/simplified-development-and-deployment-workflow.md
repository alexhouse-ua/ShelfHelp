# 10. Simplified Development and Deployment Workflow

This section outlines the pragmatic, low-friction development and deployment process for this project.

## Guiding Principles

- **Solo-Developer Productivity:** The workflow is optimized for a single developer to minimize time spent debugging the process.
- **Lean & Effective:** We will use the simplest tools and checks necessary to ensure code quality without introducing enterprise-grade complexity.
- **"Shift-Left" Quality:** As many quality checks as possible will be automated to run on the local machine _before_ code is pushed.

## Local Development Workflow

The primary line of defense for code quality will happen locally, managed by **Husky**:

1. **On `git commit`**: **Prettier** and **ESLint** will automatically run to catch formatting and linting errors.
2. **On `git push`**: A quick suite of critical unit tests will run using the **Deno Test Runner** to catch functional bugs.

## Simplified CI/CD Pipeline (GitHub Actions)

1. **Trigger**: The pipeline runs automatically when a Pull Request is opened or updated.
2. **Validation**: It runs the **full test suite** (unit and integration tests) using the Deno Test Runner.
3. **Deployment**: Upon merging a Pull Request to the `main` branch, the pipeline will automatically deploy the updated Supabase Edge Functions.

## Rollback Strategy

- **Rollback Method:** Problematic deployments will be rolled back by reverting the corresponding commit in Git, which automatically triggers a re-deployment of the previous stable version.

---
