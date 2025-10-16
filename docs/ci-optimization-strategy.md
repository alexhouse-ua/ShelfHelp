# CI/CD Optimization Strategy

**Date:** 2025-10-16
**Status:** ✅ ACTIVE
**Performance Target:** PR feedback in 2-3 minutes (down from 8 minutes)

---

## Problem Statement

CI was taking ~8 minutes per commit due to:
- Supabase Docker startup: ~3-4 min
- Integration tests with external APIs: ~2-3 min
- Docker cache management: ~1-2 min
- Redundant dependency setup: ~1 min

**Impact:** Slow developer feedback loop, reduced productivity

---

## Solution: Aggressive PR Optimization (Option A)

### Strategy Overview

**Pull Requests:** Fast feedback loop (~2-3 min)
- ✅ Lint & format checks
- ✅ Unit tests only (no external dependencies)
- ❌ Integration tests skipped

**Main Branch:** Full validation (~6-8 min)
- ✅ All lint & format checks
- ✅ Full unit test suite
- ✅ Complete integration test suite (Supabase + external APIs)

**Manual Trigger:** On-demand full suite
- Available via GitHub Actions UI
- Can run on any branch for pre-merge validation

---

## Implementation Details

### CI Workflow Changes

**File:** `.github/workflows/ci.yml`

**Jobs:**
1. `lint-and-format` - Runs on all commits (~30s)
2. `unit-tests` - Runs on all commits (~1-2 min)
3. `integration-tests` - **Conditional execution**
   ```yaml
   if: github.ref == 'refs/heads/main' || github.event_name == 'workflow_dispatch'
   ```

### PR Comment Workflow

**File:** `.github/workflows/pr-comment.yml`

Automatically posts informative comment on PRs explaining:
- What tests are running
- How to trigger full suite manually
- Local testing recommendations

---

## Performance Metrics

| Scenario | Before | After | Savings |
|----------|--------|-------|---------|
| PR commit (typical) | ~8 min | ~2-3 min | **62-70%** |
| Main branch merge | ~8 min | ~8 min | Same (full tests) |
| Manual full test | N/A | ~8 min | On-demand |

---

## Risk Mitigation

### Risks Identified

1. **Integration bugs slip through PR review**
   - Mitigation: Full suite runs on main merge
   - Mitigation: Developers can trigger manually pre-review
   - Mitigation: Local testing encouraged in PR comments

2. **Main branch breaking changes**
   - Mitigation: Full suite always runs before deploy
   - Mitigation: Deploy workflow waits for CI success
   - Mitigation: Revert capability if issues detected

3. **Developer unfamiliarity**
   - Mitigation: Automated PR comments explain strategy
   - Mitigation: Documentation in this file
   - Mitigation: Local testing guide provided

### Quality Gates Preserved

✅ **All merges to main** run full test suite
✅ **Deployment** only proceeds after full CI success
✅ **Manual override** available for high-risk PRs
✅ **Local testing** encouraged and documented

---

## Developer Workflow

### Standard PR Workflow
```bash
# 1. Make changes
git checkout -b feature/my-feature

# 2. Commit and push (triggers fast CI)
git commit -m "feat: add feature"
git push

# 3. PR created → Auto-comment appears with CI info
# 4. Wait ~2-3 min for lint + unit tests
# 5. Review feedback, iterate quickly
```

### Pre-Review Full Testing
```bash
# Option A: Local testing (recommended)
supabase start
deno test -A

# Option B: Manual CI trigger
# 1. Go to GitHub Actions tab
# 2. Select "CI" workflow
# 3. Click "Run workflow"
# 4. Choose your PR branch
```

---

## Monitoring & Iteration

### Success Criteria

- ✅ PR feedback time < 3 minutes (95th percentile)
- ✅ Main branch CI success rate > 95%
- ✅ Zero production incidents from skipped integration tests
- ✅ Developer satisfaction improved

### Review Schedule

- **Weekly:** Monitor CI run times and failure rates
- **Monthly:** Analyze integration test skip impact
- **Quarterly:** Survey developer feedback

### Rollback Plan

If quality issues arise:
1. Update `ci.yml` to restore integration tests on PR
2. Keep optimizations (caching, parallelization)
3. Re-evaluate strategy based on data

---

## Future Optimizations

### Short-term (Next Sprint)
- [ ] Add "critical path" integration tests to PR (< 1 min subset)
- [ ] Optimize Supabase Docker startup with pre-built image
- [ ] Implement test result caching

### Medium-term (Next Quarter)
- [ ] Migrate to GitHub Actions larger runners for integration tests
- [ ] Implement smart test selection (only affected tests)
- [ ] Add parallel integration test execution

### Long-term (6+ months)
- [ ] Evaluate cloud-based Supabase test instance (no Docker startup)
- [ ] Implement mutation testing for critical paths
- [ ] Add visual regression testing to separate workflow

---

## References

- CI Workflow: `.github/workflows/ci.yml`
- PR Comment Workflow: `.github/workflows/pr-comment.yml`
- Deploy Workflow: `.github/workflows/deploy.yml`
- Test Files: `tests/`, `supabase/functions/**/*.test.ts`

---

**Last Updated:** 2025-10-16
**Next Review:** 2025-10-23 (weekly check-in)
