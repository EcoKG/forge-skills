# Ralph Mode Reference

> Ralph Mode implements the Ralph Loop philosophy: "fresh context, repeat until tests pass."
> Named after the Ralph Wiggum Loop by Geoffrey Huntley.
> **Two activation paths:**
> 1. **Automatic:** Step 8 verification fails after 2 fix cycles → auto-Ralph (no flag needed)
> 2. **Manual:** `--ralph` flag for standalone use (e.g., "fix all failing tests")

---

## 1. Philosophy

**"The test suite is the source of truth. The AI keeps trying until truth is satisfied."**

Traditional approach: Plan → Implement → Hope it works
Ralph approach: Implement → Test → Fail? → Fresh context → Try again → Repeat until PASS

### Key Principles

1. **Fresh context every iteration.** Previous failures don't pollute the agent's thinking.
2. **File-based memory.** Previous attempts are recorded to disk, not held in context.
3. **Never repeat the same approach.** Each iteration MUST try something different.
4. **External verification only.** The agent doesn't decide "done" — tests do.
5. **Bounded repetition.** Safety limits prevent infinite loops and runaway costs.

---

## 2. When to Use Ralph Mode

### Good Fit ✅

- Failing tests that need to be fixed
- Build errors that need resolution
- Well-defined acceptance criteria with automated verification
- Bug fixes where the test already exists (or can be written first)
- "Make all tests pass" scenarios
- Refactoring where test suite is comprehensive

### Bad Fit ❌

- New features without existing tests (no completion signal)
- Architecture design decisions (requires human judgment)
- Ambiguous requirements (Ralph needs clear pass/fail criteria)
- Changes requiring external system access (API keys, databases)
- Large multi-file features (use standard pipeline instead)

---

## 3. Invocation

### 3.1 Automatic (no flag needed)

Ralph Mode activates automatically when:
- **Step 8 verification fails** after 2 gap-fix cycles → auto-Ralph with remaining gaps as completion promise
- **Backpressure exhausted** (6 retries failed) → auto-Ralph on that specific task

The user doesn't need to do anything — the standard `/forge` pipeline handles it.

### 3.2 Manual (standalone)

For standalone use when you already know what needs fixing:
```
/forge "fix all failing tests" --ralph
/forge "make the build pass" --ralph --max-iterations 5
/forge "resolve type errors" --ralph --completion-promise "npx tsc --noEmit exits 0"
```

### Flags

| Flag | Default | Description |
|---|---|---|
| `--ralph` | off | Enable Ralph Mode |
| `--max-iterations` | 10 | Maximum iteration count |
| `--completion-promise` | "tests pass + build succeeds" | Custom completion check command |

---

## 4. Iteration Flow

### 4.1 Initialization (runs once)

1. Create artifact directory: `.forge/{date}/ralph-{slug}-{HHMM}/`
2. Initialize `meta.json` with `mode: "ralph"`
3. Create `iteration-log.md` (empty)
4. Detect completion promise:
   - If `--completion-promise` provided: use it
   - Else: default = `{build_command} && {test_command}`
5. Run completion promise check once to capture initial state:
   - Record initial failures in `iteration-log.md`
   - This gives the first iteration context about what to fix
6. Display:
   ```
   Forge Ralph Mode | max: {N} iterations | promise: {completion_promise}
   Initial state: {N} test failures, build: {pass/fail}
   Starting iteration 1...
   ```

### 4.2 Iteration Loop

```
for iteration in 1..max_iterations:

    1. DISPATCH ralph-executor (fresh subagent):
       - Input: iteration-log.md, completion promise, source files
       - Output: iteration-{N}-summary.md + code changes

    2. CHECK completion promise:
       - Run the completion promise command
       - Capture output (pass/fail + details)

    3. RECORD result in iteration-log.md:
       - Iteration number
       - Approach taken
       - Result (pass/fail)
       - Remaining failures (if any)

    4. DECIDE:
       - If completion promise PASSES → SUCCESS → exit loop
       - If completion promise FAILS → continue to next iteration
       - If iteration == max_iterations → EXHAUSTED → exit loop

    5. COMMIT (if progress was made):
       - Stage changed files
       - Commit: `ralph({slug}/iter-{N}): {brief description}`
       - Record commit hash
```

### 4.3 Post-Loop

**On SUCCESS:**
```
Ralph Mode Complete ✅
Iterations: {N}/{max}
Completion Promise: FULFILLED
Commits: {list}
```

**On EXHAUSTED:**
```
Ralph Mode Exhausted ⚠
Iterations: {max}/{max}
Completion Promise: NOT FULFILLED
Remaining failures: {list}

Options:
  [1] Continue — increase max-iterations by 10
  [2] Manual — you fix the remaining issues
  [3] Standard — switch to full forge pipeline for deeper analysis
  [4] Cancel — stop
```

---

## 5. iteration-log.md Format

This file is the cross-iteration memory. Each iteration APPENDS to it.

```markdown
# Ralph Iteration Log

## Completion Promise
`npm test && npm run build`

## Initial State
- 5 test failures in: auth.test.ts, payment.test.ts
- Build: passing
- Errors: TypeError x3, AssertionError x2

---

## Iteration 1
- **Approach:** Fixed TypeError in auth.ts by adding null checks
- **Result:** FAIL — 3 test failures remaining
- **Fixed:** auth.test.ts (2 tests now pass)
- **Remaining:** payment.test.ts (3 failures)
- **Commit:** `ralph(fix-tests/iter-1): add null checks to auth module`

## Iteration 2
- **Approach:** Rewrote payment calculation to use Decimal instead of float
- **Result:** FAIL — 1 test failure remaining
- **Fixed:** payment.test.ts (2 tests now pass)
- **Remaining:** payment.test.ts::testRefundCalculation
- **Commit:** `ralph(fix-tests/iter-2): use Decimal for payment calculations`

## Iteration 3
- **Approach:** Fixed refund calculation edge case for partial refunds
- **Result:** PASS ✅ — all tests pass, build succeeds
- **Commit:** `ralph(fix-tests/iter-3): handle partial refund edge case`
```

---

## 6. Safety Limits

### Iteration Limit
- Default: 10 iterations
- User-configurable via `--max-iterations`
- Hard maximum: 50 (prevents accidental infinite loops)

### Cost Control
- PM tracks estimated token usage per iteration
- If cumulative cost exceeds `config.json ralph.cost_limit`: pause and ask user
- Default cost limit: none (rely on iteration limit)

### Infinite Loop Detection
- If 3 consecutive iterations produce IDENTICAL results (same failures, same approach): STOP
- If 3 consecutive iterations make NO progress (same failure count): STOP and suggest standard pipeline
- Record: `[RALPH:STUCK] No progress in 3 iterations. Suggesting standard forge pipeline.`

### Git Safety
- Each iteration commits ONLY if files actually changed
- If iteration made no changes: skip commit, log "no changes"
- All commits on the same branch (no worktree isolation needed for Ralph)

---

## 7. Ralph Mode vs Standard Pipeline

| Aspect | Standard Pipeline | Ralph Mode |
|---|---|---|
| **Planning** | Research → Plan → 8D Check | No plan — direct implementation |
| **Verification** | Goal-backward 3-level | Completion promise (tests/build) |
| **Agent** | 12 specialized agents | 1 agent (ralph-executor) |
| **Context** | Fresh per agent dispatch | Fresh per iteration |
| **Retry** | 3-tier escalation | Unlimited (up to max-iterations) |
| **Best for** | New features, complex changes | Fixing known failures, test compliance |
| **Cost** | Higher (many agents) | Lower per iteration, may need many iterations |

### Combining Ralph with Standard Pipeline

Ralph Mode can be used as a **post-pipeline fix-up**:
```
/forge "implement auth feature"          # Standard pipeline
# ... some tests fail after implementation ...
/forge "fix remaining test failures" --ralph    # Ralph cleans up
```

---

## 8. Artifact Structure

```
.forge/{date}/ralph-{slug}-{HHMM}/
  meta.json                    # Standard meta (mode: "ralph")
  iteration-log.md             # Cross-iteration memory
  iteration-1-summary.md       # Per-iteration executor output
  iteration-2-summary.md
  iteration-{N}-summary.md
  report.md                    # Final report (generated on completion)
```

---

## 9. Configuration

In `.forge/config.json`:

```json
{
  "ralph": {
    "max_iterations": 10,
    "completion_promise": "auto",
    "cost_limit": null,
    "commit_per_iteration": true,
    "stuck_threshold": 3
  }
}
```

| Key | Values | Default | Description |
|---|---|---|---|
| `max_iterations` | integer | 10 | Default iteration limit |
| `completion_promise` | string/"auto" | "auto" | Default promise (auto = build + test) |
| `cost_limit` | number/null | null | Token cost limit (null = no limit) |
| `commit_per_iteration` | boolean | true | Git commit after each successful iteration |
| `stuck_threshold` | integer | 3 | Iterations with no progress before auto-stop |
