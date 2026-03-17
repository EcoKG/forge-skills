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

---

<!-- KNOWLEDGE_TRANSFER_START -->

## 4. Cross-Project Knowledge Transfer

### Overview
Knowledge Transfer extracts proven patterns and pitfalls from individual project executions and stores them in a global knowledge base organized by technology stack. Future projects with the same stack automatically benefit.

### Directory Structure
```
~/.forge/knowledge/
  typescript-nextjs/
    conventions.md      # Coding conventions for TypeScript + Next.js
    pitfalls.md         # Known pitfalls and solutions
  go-grpc/
    conventions.md
    pitfalls.md
  python-fastapi/
    conventions.md
    pitfalls.md
```

Stack key = `{language}-{framework}` from project-profile.json (e.g., `typescript-nextjs`, `go-gin`, `python-django`).

### When Knowledge is Written (Step 9 — FINALIZE)

**Condition:** `quality_score > 0.8` AND `verification == "VERIFIED"`

**Extraction process:**
1. Read current execution's patterns from `.forge/memory/patterns.json`
2. Determine stack key from project-profile.json: `{language}-{framework}`
3. Create `~/.forge/knowledge/{stack}/` directory if not exists
4. Merge new patterns into `conventions.md`:
   - Code patterns that produced high-quality results
   - Naming conventions observed in the project
   - Test patterns that worked well
5. Merge new pitfalls into `pitfalls.md`:
   - Any deviation R4 (architecture-level issue)
   - Backpressure exhausted cases (6+ retries)
   - Ralph Mode cases needing 5+ iterations
6. Deduplicate: if a similar entry already exists (>80% text similarity), skip

**Extraction command (PM runs at Step 9):**
```
If quality_score > 0.8 AND verification == VERIFIED:
  stack = project-profile.json → "{language}-{framework}"
  knowledge_dir = ~/.forge/knowledge/{stack}/
  mkdir -p {knowledge_dir}

  For each pattern in .forge/memory/patterns.json (new in this execution):
    Append to {knowledge_dir}/conventions.md

  For each R4 deviation or backpressure exhaustion:
    Append to {knowledge_dir}/pitfalls.md
```

### When Knowledge is Read (Step 2 — RESEARCH)

**Always, if knowledge exists for the current stack:**

1. PM determines stack key from project-profile.json
2. Check if `~/.forge/knowledge/{stack}/` exists
3. If yes: pass paths to researcher agent in `<files_to_read>`:
   - `~/.forge/knowledge/{stack}/conventions.md`
   - `~/.forge/knowledge/{stack}/pitfalls.md`
4. Researcher incorporates knowledge into research.md findings:
   - Known pitfalls become automatic [M] or [H] findings
   - Conventions inform the "Recommended Approach" section

**PM context impact:** PM passes only the file PATHS to the researcher (not the content). Knowledge files are read by agents directly. Zero PM context cost.

### Knowledge Rules
- Max 50 entries per conventions.md section (oldest trimmed)
- Max 100 entries per pitfalls.md (oldest trimmed)
- Entries older than 6 months without re-use are auto-archived
- Stack key is lowercase: `typescript-nextjs`, not `TypeScript-NextJS`
- If framework is unknown: use language only (e.g., `go`, `python`)
- Global knowledge (`~/.forge/knowledge/`) is separate from project memory (`.forge/memory/`)

<!-- KNOWLEDGE_TRANSFER_END -->
