# CLAUDE.md

> Think carefully and implement the most concise solution that changes as little code as possible.

## Core Principles

1. **Fail Fast** - Check critical prerequisites, then proceed
2. **Trust the System** - Don't over-validate things that rarely fail
3. **Clear Errors** - When something fails, say exactly what and how to fix it
4. **Minimal Output** - Show what matters, skip decoration

## Testing

Always run tests before committing:
- Use test-runner agent from `.claude/agents/test-runner.md`
- Run with verbose output, no mock services
- Capture full stack traces for debugging
- `npm test` or equivalent for your stack

## Code Style

Follow existing patterns in the codebase.

## Path Standards

### Privacy Protection
- **Prohibit** absolute paths containing usernames
- **Prohibit** exposing local directory structure in public documentation
- **Use** relative paths for project file references

### Correct Path Examples
```
✅ internal/auth/server.go
✅ cmd/server/main.go
✅ .claude/commands/pm/sync.md
✅ ../project-name/internal/auth/server.go
```

### Incorrect Path Examples
```
❌ /Users/username/project/internal/auth/server.go
❌ C:\Users\username\project\cmd\server\main.go
```

## GitHub Operations

### Repository Protection
Before ANY GitHub operation that creates/modifies issues or PRs, check if remote origin is the CCPM template repository. Never sync with template repositories.

### Standard Operations
- Don't pre-check authentication - just run commands and handle failures
- Use `gh issue view {number} --json state,title,labels,body` for structured output
- Keep operations atomic - one gh command per action

## Agent Coordination

### Parallel Work Rules
1. **File-level parallelism** - Agents on different files never conflict
2. **Explicit coordination** - When same file needed, coordinate explicitly
3. **Fail fast** - Surface conflicts immediately
4. **Human resolution** - Conflicts resolved by humans, not agents

### Best Practices
- Commit early and often - smaller commits = fewer conflicts
- Stay in assigned file patterns
- Pull frequently to stay synchronized
- Report issues immediately
- Never use `--force` flags

## Standard Output Formats

### Success Output
```
✅ {Action} complete
  - {Key result 1}
  - {Key result 2}
Next: {Single suggested action}
```

### Error Messages
```
❌ {What failed}: {Exact solution}
Example: "❌ Epic not found: Run /pm:prd-parse feature-name"
```

## File Operations

- Create directories without asking: `mkdir -p .claude/{directory} 2>/dev/null`
- Read with fallback - use sensible defaults if files missing
- Don't over-validate - check essentials, try operation, handle failure clearly
