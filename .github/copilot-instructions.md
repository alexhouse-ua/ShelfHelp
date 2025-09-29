# ShelfHelp – Copilot repository instructions

This repository uses a structured "ccpm" knowledge base in `.claude/` (agents, commands, rules, epics, PRDs, context). Copilot should use that content as the source of truth instead of duplicating it.

Key behaviors for Copilot across this repo:

- Prefer referencing files in `.claude/` using #-mentions (for example: `#.claude/context/project-overview.md`, `#.claude/epics/installation-configuration/epic.md`) or `#codebase` to bring the relevant context into chat and edits.
- Don’t duplicate the content of epics, PRDs, or rules. Link or quote minimal excerpts and point to the canonical file in `.claude/`.
- When asked to plan or decompose work, generate a concise plan and include file paths in `.claude/` to anchor the plan to source docs.
- When missing context, ask the user to attach the specific `.claude/*` files via #-mentions.
- Use the custom chat modes in `.github/chat-modes/` for focused workflows (analysis, file summary, testing, planning). Use prompt files in `.github/prompts/` as reusable starters.

Useful anchors in this repo:

- Project overview: `#.claude/context/project-overview.md`
- Vision and style: `#.claude/context/project-vision.md`, `#.claude/context/project-style-guide.md`
- Tech context: `#.claude/context/tech-context.md`
- System patterns: `#.claude/context/system-patterns.md`
- Product brief/specs: `#.claude/context/project-brief.md`, `#project-specs/prd.md`
- PRDs: `#.claude/prds/`
- Epics: `#.claude/epics/`
- Rules and standards: `#.claude/rules/`
- Scripts and hooks: `#.claude/scripts/`, `#.claude/hooks/`

When generating changes:

- Always suggest minimal, verifiable edits and include file paths.
- Propose tests or checks if applicable; use `.claude/scripts/test-and-log.sh` for guidance (attach it via `#.claude/scripts/test-and-log.sh`).
- If the task is organizational (planning, PRD, epic updates), propose edits directly to the corresponding `.claude/*` document paths.

Notes on Copilot features:

- Custom chat modes live under `.github/chat-modes/*.mode.md`.
- Reusable prompts live under `.github/prompts/**`. These are optional starters you can paste into Chat.
- Path-specific instruction overlays live under `.github/instructions/**`. They complement this file and remind Copilot to rely on `.claude/`.

If uncertain, ask for one of the context files above to be attached as chat context before proceeding.
