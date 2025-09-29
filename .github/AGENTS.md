# Agent mappings for Copilot

This repository already includes `CLAUDE.md` in the root and structured agents under `.claude/agents/*`.

Guidance:
- Prefer the root `CLAUDE.md` for high-level agent behavior.
- For role-specific guidance, refer to `.claude/agents/` files via #-mentions, e.g.:
  - `#.claude/agents/code-analyzer.md`
  - `#.claude/agents/file-analyzer.md`
  - `#.claude/agents/parallel-worker.md`
  - `#.claude/agents/test-runner.md`

Avoid duplicating those contents here.
