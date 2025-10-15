# 📋 Sprint Change Proposal: Hardcover Migration

**Status**: ✅ Approved | **Date**: 2025-10-15 | **Agent**: Sarah (PO)

---

## 🎯 Executive Summary

**Change**: Goodreads/Kindle → Hardcover.app/KOReader/Calibre
**Type**: Strategic tech pivot
**Impact**: +5w timeline, +26 features unlocked
**Risk**: LOW (architect validated)
**Decision**: ✅ PROCEED with Option 1 (Full Migration)

---

## 📊 Core Metrics

| Metric | Value | Notes |
|--------|-------|-------|
| Timeline Impact | +5 weeks | Phase 1: 2.8w, Phase 2: 1w, Phase 3: 2.4w |
| New Stories | +6 | Epic 1.5 (4), Phase 2 (2) |
| Modified Stories | 2 | 2.4, 2.5 redesign |
| Optional Enhancements | 3 | 2.1, 2.2, 2.3 |
| 📚 Books Schema Changes | +8 fields | hardcover_id, moods, content_warnings, etc. |
| 🗄️ New Tables | 3 | reading_sessions, book_activities, hardcover_lists |
| Database Migrations | 6 | Schema + data backfill |
| New Features | 26+ | Content warnings, actual speed, community signals |

---

## 🗺️ Implementation Phases

### Phase 1: Migration (Weeks 1-3, BLOCKING)

**Epic 1.5 Stories**:

| Story | Days | Deliverable | File |
|-------|------|-------------|------|
| 1.5.1 | 3 | API client + rate limiting | `_shared/hardcover-client.ts` |
| 1.5.2 | 5 | Data ingestion + book matching | `hardcover-sync/index.ts` |
| 1.5.3 | 4 | 6 migrations + indexes | `migrations/*.sql` |
| 1.5.4 | 2 | Disable RSS, enable sync | Cron config |

**Success Criteria**:
- ✅ All bk have `hardcover_id` (or flagged)
- ✅ Historical data imported (Activities API)
- ✅ Existing features functional
- ✅ Zero data loss

---

### Phase 2: KOReader (Week 4, PARALLEL)

| Story | Days | Deliverable | Method |
|-------|------|-------------|--------|
| 2.6 | 3 | Reading session import | Query Hardcover Activities API |
| 2.7 | 2 | Priority scoring update | Use actual speed vs estimate |

**Calculation**: Parse activity deltas → sessions → speed by genre

---

### Phase 3: Enhancements (Weeks 5-6)

| Story | Days | Type | Change |
|-------|------|------|--------|
| 2.4.1 | 4 | REDESIGN | Preference learning (Hardcover rating + AI) |
| 2.5.1 | 3 | REDESIGN | Discovery (Hardcover API vs web scrape) |
| 2.1.1 | 2 | OPTIONAL | Enhanced queue (actual speed, community signals) |
| 2.2.1 | 3 | OPTIONAL | Mood + content warning filters |

---

## 🗄️ Database Schema Changes

### Books Table Additions
```sql
ALTER TABLE books ADD COLUMN hardcover_id INTEGER UNIQUE;
ALTER TABLE books ADD COLUMN moods TEXT[];
ALTER TABLE books ADD COLUMN content_warnings TEXT[];
ALTER TABLE books ADD COLUMN users_count INTEGER DEFAULT 0;
ALTER TABLE books ADD COLUMN ratings_count INTEGER DEFAULT 0;
ALTER TABLE books ADD COLUMN lists_count INTEGER DEFAULT 0;
ALTER TABLE books ADD COLUMN series_position DECIMAL(4,2);
ALTER TABLE books ADD COLUMN edition_id INTEGER;
ALTER TABLE books ADD COLUMN physical_format TEXT;
```

### New Tables (Full schema in architect-research.md)
- `reading_sessions`: KOReader/Hardcover session data
- `book_activities`: Activity timeline from Hardcover
- `hardcover_lists` + `hardcover_list_books`: List management

---

## 📋 Artifact Updates Required

### PRD (`docs/prd/*.md`)
**Section 1**: Goodreads RSS → Hardcover GraphQL API
**Section 2**: ADD FR-12 (content warnings), FR-13 (actual speed), FR-14 (multi-queues), FR-15 (community signals)
**Section 4**: Update tech constraints (Hardcover/KOReader/Calibre)

### Architecture (`docs/architecture/*.md`)
**Section 4**: Add schema changes (8 fields, 3 tables)
**Section 6**: Replace rss-ingestion with hardcover-sync
**Section 8**: ADD Hardcover API section (endpoint, auth, rate limits)

### Epic 2 (`docs/epics/epic-2-*.md`)
- Story 2.4: ⏸️ HOLD → redesign after Phase 1
- Story 2.5: ⏸️ HOLD → redesign after Phase 1

### New Epic 1.5
**Create**: `docs/epics/epic-1.5-hardcover-migration.md`
- 4 stories (1.5.1-1.5.4)
- Timeline: 2.8 weeks

---

## ⚠️ Risk Mitigation

| Risk | Severity | Mitigation | Status |
|------|----------|------------|--------|
| Rate limit exhaust | HIGH | Cache 24h, batch queries, monitor 80% | ✅ MITIGATED |
| Token expiry (Jan 1) | MED | Calendar alert Dec 15, refresh workflow | ⚠️ PLANNED |
| Book matching fail | MED | Multi-strategy (ISBN→title→fuzzy), manual UI | ⚠️ PLANNED |
| KOReader not sync | LOW | Fallback: manual SQLite upload | ✅ MITIGATED |
| Hardcover downtime | HIGH | Serve cached data, queue retries | ⚠️ PLANNED |

---

## 🚀 Next Steps

### User (BEFORE DEV)
1. ⏳ Obtain Hardcover API token: https://hardcover.app/account/api
2. ⏳ Confirm KOReader plugin active (check Hardcover profile)
3. ⏳ Final approval of this proposal

### Sarah (PO) - AFTER APPROVAL
1. Create 6 story cards (Epic 1.5 + Phase 2)
2. Update PRD sections (4 sections)
3. Update Architecture sections (4 sections)
4. Mark Story 2.4/2.5 as HOLD in Epic 2

### James (Dev) - PHASE 1 KICKOFF
1. Implement Story 1.5.1 (Hardcover API Client)
2. Write 6 database migrations
3. Build book matching logic (ISBN → title/author)
4. Set up rate limit monitoring

---

## 📈 Feature Unlocks (26+)

### Rich Statistics (Hardcover + KOReader)
1. Actual reading speed per bk/genre/time
2. Reading streak tracking
3. Genre velocity analysis
4. Session patterns (when/how long)
5. Abandonment detection
6. Monthly/yearly reports

### Enhanced Recommendations
7. Mood-based rec with native tags
8. Content warning filtering
9. Community-validated rec (users_count)
10. Diversity-aware (is_bipoc, is_lgbtq)
11. Series completion tracking
12. Edition-aware suggestions

### Queue Management
13. Multiple dynamic queues
14. List-based prioritization
15. Collaborative lists
16. Bidirectional sync (app ↔ Hardcover)

### Automated Workflows
17. Auto status transitions
18. Progress triggers (80% → prompt)
19. Reading goal tracking
20. Library sync (Calibre → Hardcover → app)

### Reflection & Learning
21. Structured journal (Hardcover prompts)
22. Quote management (KOReader highlights)
23. Rating rationale tracking
24. Preference evolution analysis

### Discovery
25. Trending alerts
26. Similar reader discovery
27. Author event tracking

---

## ✅ Validation Summary

**Technical**: ✅ CONFIRMED (see architect-research.md)
**Business Value**: ✅ HIGH (10x better data, 26+ features)
**Risk**: ✅ LOW-MEDIUM (all mitigations planned)
**User Alignment**: ✅ APPROVED (all decisions confirmed)

---

## 📌 Session Resume Context

**Next Session**:
1. Load: sprint-change-proposal + architect-research.md
2. Confirm: API token, KOReader verification
3. Execute: Story cards, doc updates
4. Handoff: Dev (James) with Epic 1.5

**Key Files to Update**:
- `docs/prd/*.md` (4 sections)
- `docs/architecture/*.md` (4 sections)
- `docs/epics/epic-2-*.md` (mark 2.4/2.5 HOLD)
- `docs/epics/epic-1.5-hardcover-migration.md` (create)
- `docs/stories/1.5.{1-4}.md` (create)
- `docs/stories/2.{6-7}.md` (create)

**Companion Document**: `architect-research-hardcover-migration.md` (technical details)

---

**Status**: 📋 Complete → ⏳ Awaiting Final Approval → 🚀 Ready for Implementation

**Timeline**: 5 weeks from Phase 1 kickoff to Enhanced MVP
