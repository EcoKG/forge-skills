# Deviation Rules Reference

> This file defines how implementer agents handle unexpected situations discovered during task execution.
> PM loads this at Step 7 (EXECUTE). Implementer agents receive this as a reference path.

---

## 1. The 4 Rules

### Rule R1: Bug Found During Implementation

**Trigger condition:**
While implementing a task, the agent discovers an existing bug in the codebase that is directly related to the current task.

Examples:
- A null pointer dereference in a function the agent is modifying.
- An off-by-one error in a loop the agent is extending.
- A logic error in a conditional that the agent's new code depends on.

**Action:**
1. Fix the bug immediately (within the scope of the current task).
2. Record the fix in the task summary.
3. Continue with the original task.

**Recording format:**
```markdown
## Deviations
- [DEVIATION:R1] Fixed null pointer in `getUserByID()` at src/user/repo.go:45.
  The function returned nil without checking the database error, causing a panic
  when called from the new authentication middleware.
  Fix: Added `if err != nil { return nil, err }` before the nil user check.
```

**Limits:** Counts toward the per-task auto-fix limit (3 per task).

---

### Rule R2: Missing Feature Discovered

**Trigger condition:**
The agent discovers that a feature assumed to exist (by the plan) does not exist, and it is necessary for the current task to function correctly.

Examples:
- The plan says "use the existing `validateInput()` function" but it does not exist.
- A required configuration field is not defined in the config struct.
- An expected API endpoint is not implemented.

**Action:**
1. Implement the missing feature if it is small (< 30 lines) and directly required.
2. Record what was added and why.
3. Continue with the original task.

**Recording format:**
```markdown
## Deviations
- [DEVIATION:R2] Added `validateInput()` function to src/utils/validation.go.
  The plan referenced this function in task [1-3] action item 2, but it did not
  exist. Created a basic implementation that validates required fields and returns
  a structured error. 22 lines added.
```

**Limits:** Counts toward the per-task auto-fix limit (3 per task).

**Scope boundary:** If the missing feature is large (>30 lines) or requires architectural decisions, treat as R4 instead.

---

### Rule R3: Blocking Issue Encountered

**Trigger condition:**
The agent encounters an issue that prevents the current task from completing, but the issue can be resolved without architectural changes.

Examples:
- A type mismatch: function expects `string` but receives `int`. The agent needs to add a conversion.
- A missing dependency: a package is imported but not installed. The agent runs the install command.
- A conflicting import: two packages export the same name. The agent adds an alias.
- A failing test unrelated to the current task: the test was already broken.

**Action:**
1. Resolve the issue with the minimal necessary change.
2. Record what was blocking and how it was resolved.
3. Continue with the original task.

**Recording format:**
```markdown
## Deviations
- [DEVIATION:R3] Resolved type mismatch in `processPayment()` at src/payment/handler.go:78.
  The function signature expected `amount float64` but the caller passes `amount string`
  from the JSON body. Added `strconv.ParseFloat(amountStr, 64)` conversion at the call site
  in src/api/routes.go:112.
```

**Limits:** Counts toward the per-task auto-fix limit (3 per task).

---

### Rule R4: Architecture Change Required

**Trigger condition:**
The agent determines that completing the current task requires a change that goes beyond the task's scope and involves architectural decisions that should be made by the user or PM.

Examples:
- The task requires a new database table or schema migration.
- The task requires switching from REST to WebSocket.
- The task requires introducing a new external dependency (e.g., Redis, a message queue).
- The task requires changing a shared interface used by 5+ other modules.
- The task requires a fundamentally different data flow than what the plan describes.

**Action:**
1. **STOP implementation immediately.** Do not attempt the architectural change.
2. Document what was discovered and why it blocks the task.
3. Return to PM with a BLOCKED status.

**Recording format:**
```markdown
## Status: BLOCKED

## Deviations
- [DEVIATION:R4:BLOCKED] Task requires a new `sessions` database table to store
  refresh tokens. The plan assumes tokens are stored in memory (plan.md task [1-3]
  action item 4: "store refresh token in the token cache"), but the codebase uses
  PostgreSQL for all persistent data, and refresh tokens must survive server restarts.

  Suggested approaches:
  1. Add a `sessions` table with columns: id, user_id, refresh_token, expires_at
  2. Use Redis for session storage (requires new infrastructure)
  3. Change to stateless JWT-only approach (requires plan modification)
```

**Limits:** No auto-fix attempts. Immediate escalation.

---

## 2. Scope Boundary Definition

The scope boundary determines whether a discovered issue falls within the current task's responsibility.

### Within scope (auto-fixable under R1/R2/R3)
An issue is within scope if ALL of the following are true:
- The issue is **directly caused by** or **directly blocks** the current task.
- The fix modifies only files listed in the task's `<files>` or `<read_first>`.
- The fix is **less than 30 lines** of code.
- The fix does not change any **public API or interface** used by code outside the current task's files.
- The fix does not require **user decisions** (e.g., which database to use, what error message to show to end users).

### Outside scope (must NOT be auto-fixed)
An issue is outside scope if ANY of the following are true:
- The issue exists in files NOT listed in the current task.
- The fix would change behavior for code paths unrelated to the current task.
- The fix requires creating new infrastructure (database tables, message queues, config files).
- The fix requires modifying 3+ files not mentioned in the task.
- The fix changes a shared interface/type definition used across the codebase.

### Gray zone (use judgment, document either way)
- The issue is in a file listed in `<read_first>` but not in `<files>`.
  - If the fix is trivial (< 5 lines): fix it, record as R1/R3.
  - If the fix is non-trivial: record as R4.
- The issue affects a utility function used in 2-3 places.
  - If only the current task's usage is broken: fix it, record as R3.
  - If all usages are broken: record as R4.

---

## 3. Auto-Fix Limits

### Per-task limit: 3 auto-fix attempts
Counts across R1, R2, and R3 combined.

```
Task [1-3]:
  [DEVIATION:R1] Fix null pointer         — count: 1/3
  [DEVIATION:R2] Add validateInput()       — count: 2/3
  [DEVIATION:R3] Resolve type mismatch     — count: 3/3
  [DEVIATION:R1] Another bug found         — LIMIT REACHED
```

When the per-task limit is reached:
1. Document the remaining issue in the task summary.
2. Mark the task as complete (if the core work is done) or as needs-attention.
3. Continue to code review. The reviewer will flag remaining issues.
4. PM decides whether to create a follow-up task.

### Per-execution limit: 10 auto-fix attempts
Counts across all tasks in the entire execution.

```
Task [1-1]: 2 deviations  — total: 2/10
Task [1-2]: 1 deviation   — total: 3/10
Task [1-3]: 3 deviations  — total: 6/10
Task [1-4]: 3 deviations  — total: 9/10
Task [1-5]: 1 deviation   — total: 10/10 — LIMIT REACHED
```

When the per-execution limit is reached:
1. Warn the user: "High deviation count detected ({N} auto-fixes across {M} tasks). This may indicate a plan quality issue."
2. Continue execution, but deviations are documented only (no auto-fix attempts).
3. PM considers: should the remaining plan be revised?

---

## 4. Recording Format

Every deviation is recorded in the task's summary file using this exact format:

```markdown
## Deviations
- [DEVIATION:{RULE}] {One-line description of what was discovered and fixed.}
  {2-3 lines of detail: what the issue was, where it was, what was done.}
```

### Tag format
| Tag | Meaning |
|---|---|
| `[DEVIATION:R1]` | Bug auto-fixed |
| `[DEVIATION:R2]` | Missing feature auto-added |
| `[DEVIATION:R3]` | Blocking issue auto-resolved |
| `[DEVIATION:R4:BLOCKED]` | Architecture change needed, task blocked |

### Aggregation
At Step 9 (FINALIZE), PM aggregates all deviations into the final report:

```markdown
## Deviations Log
| Task | Rule | Description |
|---|---|---|
| [1-2] | R1 | Fixed null pointer in getUserByID() |
| [1-3] | R2 | Added validateInput() function (22 lines) |
| [1-4] | R3 | Resolved type mismatch in processPayment() |
| [1-5] | R4 | BLOCKED — requires new sessions database table |
```

---

## 5. Escalation Path

When R4 is triggered, the following sequence occurs:

### Step 1: Implementer stops and reports
```
Implementer writes to task-summary.md:
  ## Status: BLOCKED
  ## Deviations
  - [DEVIATION:R4:BLOCKED] {detailed description with suggested approaches}
```

### Step 2: PM reads the task summary verdict
PM reads only the Status line and the R4 deviation entry (not the full summary).

### Step 3: PM presents to user
```
--- Task [{N-M}] Blocked: Architecture Decision Required ---

Issue: {one-line from R4 description}

The implementer discovered that this task requires a change beyond its scope.
Details are in: .forge/{date}/{slug}/task-{N-M}-summary.md

Options:
  [1] Approve — add a new task to handle the architecture change
  [2] Skip — mark this task as skipped and continue
  [3] Alternative — provide an alternative approach
  [4] Cancel — stop the entire execution
---
```

### Step 4: PM acts on user choice
- **Approve:** PM creates a new task in plan.md for the architecture change. The new task is assigned to the next wave. The blocked task's dependency is updated to include the new task.
- **Skip:** PM marks the task as `skipped`. Downstream dependent tasks are also marked as `skipped` (or their dependencies are re-evaluated).
- **Alternative:** PM collects the user's alternative approach and dispatches the implementer again with the new instructions.
- **Cancel:** PM stops execution and proceeds to Step 9 (FINALIZE) with partial results.

### Step 5: Resume
After the user's decision is applied, PM resumes the wave execution. Tasks that were running in parallel (unaffected by the R4) continue as normal.

---

## 6. Examples for Each Rule

### Example 1: R1 — Bug Found (Go authentication handler)

**Task:** [1-3] Implement JWT token validation middleware.
**Discovery:** While reading `src/auth/handler.go` (listed in `<read_first>`), the agent finds:
```go
func GetUserByID(id string) (*User, error) {
    row := db.QueryRow("SELECT * FROM users WHERE id = ?", id)
    var user User
    row.Scan(&user.ID, &user.Name, &user.Email)  // ignores error
    return &user, nil  // returns empty user instead of nil on not-found
}
```
**Action:** Fix the error handling. Record as R1.
**Summary entry:**
```markdown
- [DEVIATION:R1] Fixed missing error handling in `GetUserByID()` at src/auth/handler.go:34.
  `row.Scan()` error was ignored, causing empty user objects to be returned when the user
  does not exist. Added proper error checking: returns `(nil, ErrNotFound)` on sql.ErrNoRows
  and `(nil, err)` on other errors.
```

### Example 2: R2 — Missing Feature (Python validation)

**Task:** [1-5] Add input validation to the /users endpoint.
**Discovery:** The plan says "call `validate_user_input(data)` from utils/validation.py" but this function does not exist.
**Action:** Create the function (18 lines). Record as R2.
**Summary entry:**
```markdown
- [DEVIATION:R2] Created `validate_user_input()` in utils/validation.py.
  The plan referenced this function but it did not exist. Implemented validation for
  required fields (name, email) with email format check using regex. Returns a list
  of validation errors or empty list. 18 lines added.
```

### Example 3: R3 — Blocking Issue (TypeScript type mismatch)

**Task:** [1-4] Wire the payment handler to the billing service.
**Discovery:** `BillingService.charge()` expects `amount: number` but the payment handler receives `amount: string` from the JSON request body.
**Action:** Add `parseFloat()` conversion at the call site. Record as R3.
**Summary entry:**
```markdown
- [DEVIATION:R3] Resolved type mismatch between PaymentHandler and BillingService.
  `BillingService.charge(amount: number)` was called with a string from `req.body.amount`.
  Added `const amount = parseFloat(req.body.amount)` with NaN check before the call
  in src/handlers/payment.ts:56.
```

### Example 4: R4 — Architecture Change (Database schema)

**Task:** [1-6] Implement refresh token rotation.
**Discovery:** The plan assumes refresh tokens are cached in memory, but the codebase uses PostgreSQL for all persistent data, and tokens must survive restarts.
**Action:** STOP. Do not create the database table. Report to PM.
**Summary entry:**
```markdown
## Status: BLOCKED

## Deviations
- [DEVIATION:R4:BLOCKED] Refresh token storage requires a new database table.
  The plan (task [1-6] action item 3) says "store refresh token in the token cache"
  but the codebase has no in-memory cache — all data is persisted in PostgreSQL.
  Creating a new `refresh_tokens` table requires a database migration, which is
  an architectural decision beyond this task's scope.

  Suggested approaches:
  1. Create a `refresh_tokens` table: (id, user_id, token_hash, expires_at, created_at)
  2. Add a Redis cache for session data (new infrastructure)
  3. Switch to stateless approach with short-lived access tokens only
```

### Example 5: R1 at the limit (third auto-fix)

**Task:** [1-2] Refactor the user service to use dependency injection.
**Previous deviations:** 2 already recorded (R1: null check, R3: import conflict).
**Discovery:** Found a race condition in the user cache.
**Action:** This is the third deviation (3/3 limit). Fix the race condition, record it, and note that the per-task limit is now reached.
**Summary entry:**
```markdown
- [DEVIATION:R1] Fixed race condition in user cache at src/user/cache.go:28.
  Concurrent map access without mutex. Added sync.RWMutex for read/write operations.
  NOTE: Per-task deviation limit reached (3/3). Any further issues will be documented
  but not auto-fixed.
```

---

## 7. Stuck Detection Rules

> These rules complement the Analysis Paralysis Guard in implementer.md with concrete thresholds and escalation procedures.
> PM and agents both reference these rules during Step 7 (EXECUTE).

### 7.1 Read Loop Detection

**Problem:** An agent keeps reading files without making progress on implementation.

| Metric | Threshold | Action |
|---|---|---|
| Consecutive Read/Grep/Glob without Edit/Write | **5** (Warning) | Agent should stop reading and attempt to write code with current knowledge |
| Consecutive Read/Grep/Glob without Edit/Write | **7** (Force) | Agent MUST either write code OR report `[STUCK:READ_LOOP]` |
| Same file path read 3+ times | **3** (Stuck) | Agent reports `[STUCK:SAME_FILE]` with what it cannot determine |

**Counter rules:**
- Counter starts at 0 when the agent begins a task
- Each Read/Grep/Glob call increments the counter by 1
- Each Edit/Write/Bash-modify call resets the counter to 0
- `<read_first>` files from the task spec are EXCLUDED from the counter (they are mandatory reads)
- Verification commands (build, test, grep for acceptance criteria) do NOT reset the counter

**Example sequence:**
```
Read auth.go          — count: 0 (read_first, excluded)
Read middleware.go     — count: 0 (read_first, excluded)
Grep "ValidateToken"  — count: 1
Read jwt.go           — count: 2
Read config.go        — count: 3
Grep "ParseToken"     — count: 4
Read jwt.go           — count: 5 ← WARNING: 5 reads, attempt to write code
Read routes.go        — count: 6
Read jwt.go           — count: 7 ← FORCE: must write or report [STUCK]
                        Also: jwt.go read 3 times → [STUCK:SAME_FILE]
```

---

### 7.2 Error Loop Detection

**Problem:** An agent retries the same failing approach without changing strategy.

| Metric | Threshold | Action |
|---|---|---|
| Same build error message | **2** consecutive | Try fundamentally different approach before 3rd attempt |
| Same build error message | **3** consecutive | STOP. Report `[STUCK:ERROR_LOOP]`. Immediate Tier 3 escalation |
| Same test assertion failure | **2** consecutive | Analyze root cause instead of patching symptoms |
| Same test assertion failure | **3** consecutive | STOP. Report `[STUCK:ERROR_LOOP]`. Immediate Tier 3 escalation |
| Any identical error | **3** consecutive | Absolute rule: 3+ identical errors = immediate escalation (ref: Section 12.3 Rule 2) |

**Error identity:** Two errors are "the same" if they share:
- The same file path AND line number, OR
- The same error message text (exact match or >90% similar), OR
- The same error code (e.g., TS2345, E0308, etc.)

**Correct response to repeated errors:**
```
Error 1: "Cannot find module './auth'" → Fix: check import path
Error 2: "Cannot find module './auth'" → DIFFERENT approach: check if file exists, check tsconfig paths
Error 3: "Cannot find module './auth'" → STOP. [STUCK:ERROR_LOOP]. Escalate to PM.
```

---

### 7.3 Stuck Escalation Protocol

When an agent reports `[STUCK:{type}]`:

**Step 1: Agent writes to task summary**
```markdown
## Status: STUCK

## Stuck Events
- [STUCK:{type}] {description of what's blocking}
  Attempted: {what approaches were tried}
  Need: {what would unblock — e.g., "clarification on config format", "missing dependency"}
```

**Step 2: PM reads stuck report**
PM reads only the `## Status` line and `## Stuck Events` section (not full summary).

**Step 3: PM presents to user**
```
--- Task [{N-M}] Stuck: {STUCK_TYPE} ---

Issue: {one-line from stuck description}
Attempted: {what the agent tried}

Options:
  [1] Hint — provide guidance to the agent
  [2] Skip — mark task as skipped, continue with next
  [3] Manual — you'll fix this yourself, continue execution
  [4] Cancel — stop execution
---
```

**Step 4: PM acts on user choice**
- **Hint:** PM re-dispatches the agent with user's guidance as additional context
- **Skip:** PM marks task as `skipped`, updates meta.json, checks downstream dependencies
- **Manual:** PM pauses the task, continues other tasks, user fixes manually
- **Cancel:** PM stops execution, proceeds to Step 9 (FINALIZE)

---

### 7.4 Recording Format

Every stuck event is recorded in the task summary:

```markdown
## Stuck Events
- [STUCK:READ_LOOP] Read 7 files consecutively without progress.
  Looking for: the JWT signing key configuration location.
  Blocker: config structure is non-standard, cannot find where keys are loaded.
  Attempted: searched for "jwt", "signing", "key" across config files.
  Need: hint about where JWT config lives in this project.

- [STUCK:ERROR_LOOP] Same build error 3x: "TS2345: Argument of type 'string' is not assignable to parameter of type 'number'"
  at src/payment/handler.ts:78.
  Attempted: (1) parseFloat conversion, (2) Number() cast — both failed because the type is used in 4 call sites.
  Need: architectural decision about whether to change the function signature or all callers.

- [STUCK:SAME_FILE] Read src/auth/middleware.go 3 times.
  Cannot determine: how the middleware chain is composed — no clear entry point.
  Attempted: searched for middleware registration, found nothing in routes.go.
  Need: clarification on middleware wiring pattern in this project.
```

### Aggregation

At Step 9 (FINALIZE), PM aggregates all stuck events into the final report:

```markdown
## Stuck Events Log
| Task | Type | Description | Resolution |
|---|---|---|---|
| [1-2] | READ_LOOP | JWT config location unclear | User provided hint |
| [1-4] | ERROR_LOOP | TS2345 type mismatch in 4 sites | User chose to change signature |
| [1-5] | SAME_FILE | Middleware wiring unclear | User provided entry point |
```
