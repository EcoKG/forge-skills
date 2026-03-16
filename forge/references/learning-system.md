# Learning System Reference

> PM loads this during FINALIZE (Step 9) and periodically for retrospectives.
> Enables Forge to learn from past executions and improve future plans.

<!-- LEARNING_START -->

## 1. Execution History Analysis

### When
- After every execution (Step 9, automatic)
- After milestone completion (retrospective, manual via --retrospective)

### What Gets Recorded
After Step 9 (FINALIZE), PM records to `.forge/metrics.json` via forge-tools.js:
```bash
node forge-tools.js metrics-record '{
  "id": "{slug}",
  "date": "{date}",
  "type": "{type}",
  "scale": "{scale}",
  "tasks": {N},
  "revisions": {"minor": N, "major": N},
  "deviations": {"R1": N, "R2": N, "R3": N, "R4": N},
  "verification": "VERIFIED|GAPS_FOUND|FAILED",
  "quality_score": 0.85
}'
```

### Quality Score Calculation
```
quality_score = 1.0
  - (minor_revisions * 0.02)    # -2% per minor revision
  - (major_revisions * 0.10)    # -10% per major revision
  - (deviations_R1 * 0.01)     # -1% per auto-fix bug
  - (deviations_R2 * 0.02)     # -2% per missing feature
  - (deviations_R3 * 0.03)     # -3% per blocking issue
  - (deviations_R4 * 0.15)     # -15% per architecture stop
  + (verification == "VERIFIED" ? 0.05 : 0)  # +5% for clean verification
  clamp to [0.0, 1.0]
```

<!-- LEARNING_END -->

---

<!-- MEMORY_START -->

## 2. Memory System

### Directory Structure
```
.forge/memory/
  patterns.json     # Successful implementation patterns
  failures.json     # Failed approaches + alternatives
  decisions.json    # Architectural decisions + rationale
```

### patterns.json Schema
```json
{
  "patterns": [
    {
      "id": "auth-jwt-rs256",
      "domain": "authentication",
      "pattern": "JWT with RS256 + httpOnly refresh token",
      "context": "When building stateless API auth",
      "quality_score": 0.92,
      "used_in": ["project-a/phase-2", "project-b/phase-1"],
      "created": "2026-03-15",
      "tags": ["auth", "jwt", "api"]
    }
  ]
}
```

### failures.json Schema
```json
{
  "failures": [
    {
      "id": "bcrypt-wasm-compat",
      "approach": "bcrypt npm package in serverless",
      "problem": "Native binary incompatible with Lambda runtime",
      "alternative": "bcryptjs (pure JS) or argon2 with Docker layer",
      "discovered": "2026-03-14",
      "project": "project-a",
      "tags": ["crypto", "serverless", "compatibility"]
    }
  ]
}
```

### decisions.json Schema
```json
{
  "decisions": [
    {
      "id": "monorepo-turborepo",
      "decision": "Use Turborepo for monorepo management",
      "rationale": "Better caching than Nx, simpler config than Lerna",
      "alternatives_considered": ["Nx", "Lerna", "pnpm workspaces only"],
      "date": "2026-03-15",
      "project": "project-a",
      "tags": ["tooling", "monorepo"]
    }
  ]
}
```

### When Memory is Read
- **Research (Step 2):** Researcher checks `failures.json` for known pitfalls in the current domain
- **Planning (Step 3):** Planner checks `patterns.json` for proven approaches, `decisions.json` for prior architectural choices
- **Project Init (--init):** Roadmapper checks `patterns.json` for domain-relevant templates

### When Memory is Written
- **Finalize (Step 9):**
  - If verification PASS + quality_score > 0.8 → extract patterns to `patterns.json`
  - If deviation R4 occurred → record failure to `failures.json`
  - If architectural decision was made → record to `decisions.json`

### Memory Rules
- Max 100 entries per file (FIFO — oldest removed when limit reached)
- Entries older than 6 months are auto-archived
- Cross-project memory lives in `~/.forge/memory/` (global)
- Project-specific memory lives in `.forge/memory/` (local)

<!-- MEMORY_END -->

---

<!-- RETROSPECTIVE_START -->

## 3. Retrospective

### When
- After milestone completion (`/forge --milestone` succeeds)
- Manual trigger: `/forge --retrospective`

### Process
1. Read all report.md files in the milestone
2. Read metrics.json for the milestone period
3. Analyze:
   - What went well? (highest quality scores, zero-revision tasks)
   - What went poorly? (most revisions, deviations, failed verifications)
   - What patterns emerged? (recurring issues, successful approaches)
4. Write `.forge/retrospective-{milestone}.md`:

```markdown
# Retrospective: {milestone_name}

## Metrics
- Phases: {N} | Tasks: {N} | Quality: {avg_score}
- Revisions: {total} (minor: {N}, major: {N})
- Deviations: {total} (R1:{N} R2:{N} R3:{N} R4:{N})

## What Went Well
- {pattern that worked}
- {approach that succeeded}

## What Needs Improvement
- {recurring issue}
- {approach that failed}

## Action Items
- [ ] {specific improvement for next milestone}
- [ ] {pattern to adopt}
- [ ] {pitfall to avoid}
```

5. Update memory files with new patterns/failures/decisions
6. Feed action items into next milestone's planning context

<!-- RETROSPECTIVE_END -->
