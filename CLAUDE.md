# ABSOLUTE PRIORITIES - READ FIRST

## MANDATORY SEARCH TOOL: ast-grep (sg)

**OBLIGATORY RULE**: ALWAYS use `ast-grep` (`sg`) as your PRIMARY and FIRST tool for ANY code search, pattern matching, or grepping task. This is NON-NEGOTIABLE.

**Basic syntax:**

### Syntax-aware search in specific language

sg -p '<pattern>' -l <language>

### Supported languages in this codebase: typescript, javascript, tsx, jsx, markdown

**Common usage patterns:**

### Find TypeScript/JavaScript function definitions

sg -p 'function $NAME($$$) { $$$ }' -l typescript
sg -p 'const $NAME = ($$$) => { $$$ }' -l typescript

### Find async functions

sg -p 'async function $NAME($$$) { $$$ }' -l typescript

### Find imports

sg -p 'import $X from $Y' -l typescript

### Find Markdown headers

sg -p '# $HEADER' -l markdown

### Find Markdown code blocks

sg -p '`$LANGUAGE\n$CODE\n`' -l markdown

### Interactive mode (for exploratory searches)

sg -p '<pattern>' -l typescript -r

**When to use each tool:**

- ✅ **ast-grep (sg)**: 95% of cases—code patterns, function/class searches, syntax structures in TypeScript, JavaScript, and Markdown
- ⚠️ **grep**: ONLY for plain text, comments, documentation, or when sg explicitly fails
- ❌ **NEVER** use grep for code pattern searches without trying sg first

**Enforcement**: If you use `grep -r` for code searching without attempting `sg` first, STOP and retry with ast-grep. This is a CRITICAL requirement.

## Token Efficiency

Minimize token usage by following project-specs/token-efficiency.md in all tasks and responses

## Development Resources

Always use Context7 MCP whenever code is dealing with any external tool, framework, library, API, or language.

## Development Task Workflow

PAUSE whenever you need information or manual set-up from user. DO NOT skip tasks, or create set-up documents, then move onto development unless explicitly requested by user. If manual set-up or external information, like Supabase set-up, configuration, secret, API, is needed, development should PAUSE until user confirms and/or provides the requested task completion or information. The developer will then verify prior to continuing development.
