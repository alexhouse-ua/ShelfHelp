# Epic 3: Insights & Production Readiness

## Epic Overview

**ID:** Epic 3
**Status:** Not Started
**Priority:** P2 (Launch Readiness)

## Epic Goal

To deliver valuable insights back to the user through automated reports and to validate and launch the complete, production-ready system.

## Stories

### 3.1: Automated Insight Reports

**Status:** Not Started
**Description:** Implement the automated generation and delivery of weekly and monthly summary reports.
**Acceptance Criteria:**
1. A `pg_cron` job is scheduled to trigger a new `generate-report` Edge Function on a weekly and monthly basis.
2. The function queries the `books` and `reflections` tables to aggregate reading statistics for the given period (e.g., books finished, pages read, genre distribution).
3. The aggregated stats are passed to Gemini Pro to generate a concise, narrative summary of the user's reading habits.
4. The final report (stats + narrative) is delivered to the user via a formatted Telegram message.
5. The report generation logic is covered by an integration test that mocks the date range and verifies the data aggregation.
6. The function includes error handling for database queries and Gemini API calls, and logs all operations.

### 3.2: End-to-End System Validation

**Status:** Not Started
**Description:** Perform a full validation of all user flows and data pipelines.
**Acceptance Criteria:**
1. A comprehensive manual test plan is created in a new document (`docs/qa/manual-test-plan-v1.md`).
2. The test plan documents step-by-step execution for all major user flows, including `/addbook`, `/recommend`, `/discover`, and the post-read reflection workflow.
3. The test plan is executed in a production-like staging or preview environment.
4. All P0 (critical) and P1 (high priority) test cases must pass without errors.
5. Any discovered bugs are documented as new issues and prioritized for a subsequent sprint; they do not need to be fixed within this story.
6. A validation report is produced summarizing the test results, including passed, failed, and skipped tests.

### 3.3: Production Readiness & Launch

**Status:** Not Started
**Description:** Complete final production environment checks and officially launch the bot.
**Acceptance Criteria:**
1. A production readiness checklist is created and completed, covering monitoring, alerting, and final secret rotation.
2. Production monitoring dashboards are configured in Supabase to track Edge Function performance (invocations, errors, duration) and database health.
3. The bot's `/start` and `/help` messages are updated to remove any "beta" or "development" language.
4. The developer performs a final, successful deployment to production using the established CI/CD pipeline.
5. The user confirms the bot is officially "live" and operational.

## Story Progress

- **Total Stories:** 3
- **Completed:** 0
- **In Progress:** 0
- **Not Started:** 3

## Dependencies

- **Epic 1** must be completed (foundation)
- **Epic 2** must be completed (AI features to generate insights)
- All data sources and AI features operational

## Success Criteria

- [ ] Weekly reports generated and delivered automatically
- [ ] Monthly reports generated and delivered automatically
- [ ] All user flows tested and validated end-to-end
- [ ] All data pipelines tested and validated
- [ ] Production environment configured and secured
- [ ] Monitoring and alerting operational
- [ ] System launched and stable

## Notes

This epic completes the V1 product by adding reporting capabilities and ensuring production readiness. The system should be fully operational and delivering value to the user upon completion.
