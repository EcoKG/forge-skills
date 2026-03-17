# {Stack} Pitfalls

> Auto-generated and maintained by Forge.
> Extracted from failures and deviations across projects.
> Location: `~/.forge/knowledge/{stack}/pitfalls.md`

## Known Pitfalls

### {Pitfall Title}
- **Problem:** {What goes wrong}
- **Context:** {When this typically happens}
- **Symptom:** {How you know you hit this}
- **Solution:** {What to do instead}
- **Discovered:** {date}
- **Projects:** {list of projects where this was found}

---

## Template Entry

```markdown
### {Title}
- **Problem:** {description}
- **Context:** {when it happens}
- **Symptom:** {error message or behavior}
- **Solution:** {correct approach}
- **Discovered:** {YYYY-MM-DD}
- **Projects:** [{project_name}]
```

---

## Common Pitfall Categories

### Dependency Issues
- Version conflicts, native binary compatibility, ESM/CJS mismatches

### Runtime Issues
- Memory leaks, race conditions, timeout handling

### Build Issues
- Configuration errors, path resolution, environment-specific failures

### Integration Issues
- API compatibility, database migration ordering, auth token handling

---

## Rules
- Max 100 entries (oldest trimmed)
- Entries added automatically when:
  - Deviation R4 occurs (architecture-level issue)
  - Backpressure exhausted (6+ retries on same error)
  - Ralph Mode needed 5+ iterations
- Stack detected from project-profile.json
- Each entry must have Problem + Solution (minimum)
