---
description: Run lightweight test analysis and propose focused fixes. Avoid broad refactors.
tools: ['testFailure', 'findTestFiles', 'problems', 'codebase']
---
# Test triage mode

Report:
- Failures from #testFailure and likely root causes
- Minimal fixes with exact file paths
- Add/adjust tests to cover the bug
- Validate using `.claude/scripts/test-and-log.sh` where applicable
