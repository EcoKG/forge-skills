# Backpressure System Reference

> This file defines the backpressure (역압) system — automated quality gates that prevent task completion
> until external verification (tests, build, lint) passes.
> PM loads this at Step 7 (EXECUTE) alongside wave-execution.md and deviation-rules.md.

---

## 1. Philosophy: Completion Promise

**Core principle:** A task is NOT complete because the implementer says so. A task is complete when **external verification passes.**

| Old Model (PM judges) | New Model (Backpressure) |
|---|---|
| Implementer: "I'm done" | Tests pass? Build succeeds? Lint clean? |
| PM: "Looks good" | All YES → task complete |
| Reality: maybe broken | All YES → provably working |

**Completion Promise** = a set of external checks that must ALL pass before a task can be marked as done.

Default Completion Promise: `tests pass + build succeeds`
Custom: user specifies via `--completion-promise` or config.json

---

## 2. Backpressure Checks

Three types of backpressure, executed in order:

### 2.1 Build Backpressure (mandatory)

**When:** After implementer writes code, BEFORE code review.

**Process:**
1. Run the project's build command (detected from project profile or plan.md)
2. If build succeeds → proceed to next check
3. If build fails → enter Build Fix Loop (see §3)

**Build command detection:**
| Language | Build Command |
|---|---|
| TypeScript/JavaScript | `npm run build` or `npx tsc --noEmit` |
| Go | `go build ./...` |
| Python | `python -m py_compile {changed_files}` |
| Rust | `cargo build` |
| Java | `mvn compile` or `gradle build` |
| C# | `dotnet build` |
| Other | Use command from project-profile.json or plan.md |

### 2.2 Test Backpressure (mandatory unless --skip-tests)

**When:** After build passes.

**Process:**
1. Identify tests related to changed files:
   - Same-directory test files (e.g., `foo.test.ts` for `foo.ts`)
   - Test files that import changed modules (use Grep)
   - Full test suite if scope is unclear
2. Run identified tests
3. If all pass → proceed to next check
4. If any fail → enter Test Fix Loop (see §3)

**Test command detection:**
| Language | Test Command |
|---|---|
| TypeScript/JavaScript | `npm test` or `npx jest --passWithNoTests` |
| Go | `go test ./...` |
| Python | `pytest` or `python -m pytest` |
| Rust | `cargo test` |
| Java | `mvn test` or `gradle test` |
| C# | `dotnet test` |

### 2.3 Lint Backpressure (optional, enabled by config)

**When:** After tests pass.

**Process:**
1. Run linter on changed files only (not full project)
2. If clean → all backpressure passed
3. If violations → enter Lint Fix Loop (see §3)

**Lint command detection:**
| Language | Lint Command |
|---|---|
| TypeScript/JavaScript | `npx eslint {files}` or `npx tsc --noEmit` |
| Go | `golangci-lint run {files}` |
| Python | `ruff check {files}` or `flake8 {files}` |
| Rust | `cargo clippy` |

---

## 3. Fix Loops (Auto-Recovery)

When a backpressure check fails, the system enters an auto-fix loop:

### 3.1 Standard Fix Loop (attempts 1-3)

```
for attempt in 1..3:
    1. Capture error output (build error, test failure, lint violation)
    2. Dispatch fresh implementer subagent with:
       - Original task spec (from plan.md)
       - Error output (the backpressure failure)
       - Previous approach (from task summary)
       - Instruction: "Fix the {build/test/lint} failure. Do NOT repeat the previous approach."
    3. Run backpressure check again
    4. If passes → exit loop, mark task complete
    5. If fails → continue to next attempt
```

**Key: Each fix attempt uses a FRESH subagent context.** Failed context is not accumulated.

### 3.2 Strategy Change (attempts 4-6)

If 3 standard attempts fail:

```
for attempt in 4..6:
    1. Dispatch fresh implementer subagent with:
       - Original task spec
       - ALL 3 previous failure summaries (read from disk)
       - Instruction: "Previous 3 attempts failed with these approaches:
         {summary of each}. Use a FUNDAMENTALLY DIFFERENT approach."
    2. Run backpressure check
    3. If passes → exit loop
    4. If fails → continue
```

### 3.3 Escalation (after 6 attempts)

If 6 total attempts fail:
1. Mark task as `BACKPRESSURE_FAILED`
2. Record all 6 attempts in task summary
3. Present to user:
   ```
   --- Task [{N-M}] Backpressure Failed ---
   Build/Test/Lint: {which check failed}
   Attempts: 6 (3 standard + 3 strategy change)

   Options:
     [1] Skip — continue without this task
     [2] Manual — you fix it, then resume
     [3] Hint — provide guidance for another attempt
     [4] Cancel — stop execution
   ---
   ```

---

## 4. Backpressure in the Execution Pipeline

### Position in Step 7 Per-Task Cycle

```
Implementer → [BACKPRESSURE GATE] → Code Review → Atomic Commit
                    │
                    ├─ Build check
                    ├─ Test check
                    └─ Lint check (optional)
                    │
              All pass? ──YES──→ proceed to Code Review
                    │
                   NO
                    │
              Fix Loop (max 6) → still failing → Escalate
```

### Backpressure vs QA Gate

| | Backpressure (per-task) | QA Gate (per-wave) |
|---|---|---|
| **When** | After each task implementation | After all tasks in a wave complete |
| **Scope** | Single task's changed files | All changes in the wave |
| **Checks** | Build + test + lint | Build + test + caller impact + anti-patterns |
| **Fix** | Auto-fix loop (fresh agents) | PM creates targeted fix tasks |
| **Purpose** | Catch errors early, per-task | Catch integration issues |

Both coexist. Backpressure catches task-level issues early. QA Gate catches cross-task integration issues.

---

## 5. Recording Format

### In task-summary.md

```markdown
## Backpressure Results
| Check | Status | Attempts | Details |
|---|---|---|---|
| Build | PASS | 1 | Clean build, 0 warnings |
| Test | PASS | 2 | Attempt 1: 1 test failed (assertion). Attempt 2: fixed, all pass |
| Lint | SKIP | 0 | Lint backpressure disabled in config |

Completion Promise: FULFILLED
Total backpressure attempts: 3
```

### In trace.jsonl

```json
{"agent":"implementer","task_id":"1-3","model":"sonnet","timestamp":"...","result":"BACKPRESSURE_FAIL","check":"test","attempt":1}
{"agent":"implementer","task_id":"1-3","model":"sonnet","timestamp":"...","result":"BACKPRESSURE_PASS","check":"test","attempt":2}
```

---

## 6. Configuration

In `.forge/config.json`:

```json
{
  "backpressure": {
    "enabled": true,
    "checks": {
      "build": true,
      "test": true,
      "lint": false
    },
    "max_retries": 6,
    "strategy_change_after": 3,
    "test_scope": "related",
    "lint_scope": "changed_files"
  }
}
```

| Key | Values | Default | Description |
|---|---|---|---|
| `enabled` | boolean | true | Master switch |
| `checks.build` | boolean | true | Build verification |
| `checks.test` | boolean | true | Test verification |
| `checks.lint` | boolean | false | Lint verification |
| `max_retries` | integer | 6 | Total attempts (3 standard + 3 strategy change) |
| `strategy_change_after` | integer | 3 | Switch to different approach after N failures |
| `test_scope` | related/full | related | Run related tests only or full suite |
| `lint_scope` | changed_files/full | changed_files | Lint changed files only or full project |

---

## 7. When to Disable Backpressure

- `--quick` mode: build and test backpressure remain enabled; only lint and review steps are skipped
- `--skip-tests`: test backpressure is disabled, build backpressure remains
- Analysis/design types: no code changes, no backpressure needed
- Docs type: no backpressure (no build/test for docs)

| Type | Build BP | Test BP | Lint BP |
|---|---|---|---|
| code | ✅ | ✅ | config |
| code-bug | ✅ | ✅ | config |
| code-refactor | ✅ | ✅ | config |
| infra | ✅ | ✅ (dry-run) | ❌ |
| docs | ❌ | ❌ | ❌ |
| analysis | ❌ | ❌ | ❌ |
| design | ❌ | ❌ | ❌ |
| quick | ✅ | ✅ | ❌ |
