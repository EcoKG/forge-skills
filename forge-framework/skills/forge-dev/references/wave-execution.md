# Wave-Based Parallel Execution Reference

> This file details how Forge v7.0 executes tasks in parallel using dependency-based waves.
> PM loads this file at Step 7 (EXECUTE) and when resolving wave-related issues.

---

## 1. Wave Assignment Algorithm

### Input
Tasks from plan.md, each with:
- `id` (e.g., "1-3")
- `depends_on` (e.g., "1-1,1-2" or empty)
- `files` (files to create/modify)

### Algorithm
```
function assign_waves(tasks):
    for each task where depends_on is empty:
        task.wave = 1

    changed = true
    while changed:
        changed = false
        for each task where task.wave is unassigned:
            deps = parse(task.depends_on)
            if all deps have assigned waves:
                task.wave = max(dep.wave for dep in deps) + 1
                changed = true

    # Conflict resolution: same-file check within waves
    for each wave_number:
        wave_tasks = tasks where wave == wave_number
        file_sets = [set(task.files) for task in wave_tasks]
        for i, j in all_pairs(wave_tasks):
            if file_sets[i] intersects file_sets[j]:
                # Move the later task (by ID) to the next wave
                wave_tasks[j].wave += 1
                propagate_wave_increase_to_dependents(wave_tasks[j])

    return tasks
```

### Example
```
Tasks:
  [1-1] files: auth.go           depends: —
  [1-2] files: jwt.go            depends: —
  [1-3] files: middleware.go      depends: —
  [1-4] files: auth.go, routes.go depends: 1-1
  [1-5] files: jwt.go, token.go  depends: 1-2
  [1-6] files: middleware.go      depends: 1-3
  [1-7] files: routes.go, test.go depends: 1-4, 1-5

Result:
  Wave 1: [1-1], [1-2], [1-3]   (no dependencies, no file conflicts)
  Wave 2: [1-4], [1-5], [1-6]   (deps in Wave 1, no file conflicts)
  Wave 3: [1-7]                  (deps in Wave 2)
```

### Validation Rules
- No circular dependencies (DAG must be valid).
- Every `depends_on` ID must reference an existing task.
- Wave numbers must be contiguous starting from 1.
- If the planner assigns wave numbers, the algorithm verifies them. If invalid, the algorithm reassigns.

---

## 2. Parallel Execution Rules

### Maximum Concurrency
- Default: 3 concurrent agents per wave.
- Configurable via meta.json `options.max_concurrent` (not exposed to user directly).
- Rationale: 3 agents balances throughput with API rate limits and coherent progress tracking.

### Same-File Conflict Prevention
**Hard rule: Two tasks that modify the same file must NOT execute in the same wave.**

Detection:
```
for each pair of tasks in the same wave:
    files_a = set(task_a.files.split(", "))
    files_b = set(task_b.files.split(", "))
    if files_a & files_b:
        CONFLICT — move one task to the next wave
```

Resolution priority:
1. Move the task with fewer dependencies on it (less downstream impact).
2. If tied, move the task with the higher ID number.
3. After moving, re-check the target wave for new conflicts.

### Read vs Write Conflicts
- Two tasks that both READ the same file: allowed in the same wave.
- Two tasks where one READS and one WRITES: allowed only if the reader does not depend on the writer's changes.
- Two tasks that both WRITE the same file: never allowed in the same wave.

### Batching Within a Wave
If a wave has more tasks than the max concurrency:
```
Wave 2 has 5 tasks, max concurrent = 3:
  Batch 1: [1-4], [1-5], [1-6]  (first 3 tasks)
  Batch 2: [1-7], [1-8]         (remaining 2 tasks)

Batch 2 starts only after Batch 1 completes.
No QA gate between batches (QA runs at wave boundary only).
```

---

## 3. Wave Boundary Actions

At the completion of each wave (all tasks in the wave are done or blocked), the following actions execute in order:

### 3.1 QA Gate
```xml
<agent_dispatch>
  <role>qa-inspector</role>
  <task_id>qa-wave-{N}</task_id>
  <files_to_read>
    {all task-summary.md files from this wave}
    {all files modified in this wave}
  </files_to_read>
  <output_path>.forge/{date}/{slug}/qa-report-wave-{N}.md</output_path>
</agent_dispatch>
```

QA inspector checks:
1. **Build verification:** Does the project still build?
2. **Test execution:** Do all existing tests pass?
3. **Caller impact:** Are all callers of modified functions updated?
4. **Anti-pattern scan:** No TODO/FIXME/placeholder in changed files?

### 3.1.5 VPM Cross-Check

After QA inspection passes, the Verification PM (VPM) runs an independent cross-check before git commit.

```xml
<agent_dispatch>
  <role>verification-pm</role>
  <mode>wave_check</mode>
  <task_id>vpm-wave-{N}</task_id>
  <files_to_read>
    {plan.md path}
    {all task-summary.md files from this wave}
    {all files modified in this wave}
  </files_to_read>
  <output_path>.forge/{date}/{slug}/vpm-wave-{N}.md</output_path>
</agent_dispatch>
```

VPM cross-checks:
1. **Task-summary vs code:** Do the changed files actually implement what summaries claim?
2. **Inter-task consistency:** If Task A creates an interface and Task B uses it, do signatures match?
3. **Wiring verification:** Are new connections actually called, not just imported?
4. **Anti-pattern scan:** Independent scan for stubs, TODOs, placeholders in changed files

**Verdict handling:**
- **PASS:** Proceed to git commit (§3.2)
- **ISSUES_FOUND:** PM creates targeted fix tasks, re-executes, then re-dispatches VPM (max 2 re-checks per wave). After 2 failed re-checks, escalate to user.

### 3.2 Git Commit Strategy

**Per-task atomic commits (default):**
Each task that passes code review gets an individual commit immediately after review:
- Commit format: `{type}({slug}/{task_id}): {task_name}`
- Type mapping: code→`feat`, code-bug→`fix`, code-refactor→`refactor`, docs→`docs`, infra→`chore`
- PM stages only the files listed in the task's `<files>` section
- If staging finds no changes: skip commit, log warning in trace.jsonl
- Commits happen BEFORE the wave boundary QA gate
- Each commit hash is recorded in meta.json `git.commits[]`
- Each task ID is added to meta.json `tasks.completed_tasks[]` (enables resume)

**Wave-level fallback:**
If per-task commits are disabled (`config.json: atomic_commits.enabled: false`):
- Single commit at wave boundary after QA passes
- Format: `feat({slug}): complete wave {N}/{total}`
- All task IDs from the wave are added to `completed_tasks[]` at once

**Benefits of per-task commits:**
- `git bisect` can identify exactly which task introduced a regression
- Individual tasks can be reverted without affecting others: `git revert {commit_hash}`
- Commit history serves as documentation of the implementation sequence
- meta.json `tasks.completed_tasks[]` tracks which commits exist, enabling `--resume`
- Each commit is a natural checkpoint — crash between commits loses at most one task's work

### 3.3 Progress Report
PM displays to the user:
```
--- Wave {N}/{total} ---
Completed: {N}/{M} tasks
Blocked:   {N} tasks
Revisions: {minor}m {major}M
Deviations: R1:{n} R2:{n} R3:{n}
QA: {PASS|GAPS_FOUND}
Commits: {N} new in this wave
Overall: {total_completed}/{total_tasks} ({percentage}%)
---
```

### 3.4 Context Cleanup
PM drops from context:
- All task details from the just-completed wave (keep only: task IDs and statuses).
- QA report details (keep only: verdict).
- Agent dispatch/response records.

---

## 4. Failure Handling Within Waves

### Scenario A: One task fails, others succeed
- The failing task is marked as `blocked` or retried per revision limits.
- Other tasks in the same wave continue unaffected.
- At wave boundary, QA runs on the successful tasks only.
- If the failing task is a dependency for tasks in later waves:
  - Dependent tasks are marked as `blocked`.
  - PM informs the user which downstream tasks are affected.
  - User decides: skip blocked tasks / provide manual fix / cancel.

### Scenario B: QA gate fails
```
QA returns GAPS_FOUND:
  1. PM creates targeted fix tasks for the gaps.
  2. PM executes fix tasks (same wave rules, max 3 concurrent).
  3. PM re-runs QA.
  4. Max 2 QA retries. After that, escalate to user.

QA returns BUILD_FAILED:
  1. PM applies Tier 1 recovery: analyze build error, auto-fix.
  2. If Tier 1 fails: Tier 2 — try alternative approach.
  3. If Tier 2 fails: Tier 3 — escalate to user with error details.
```

### Scenario C: All tasks in a wave fail
- PM stops execution.
- PM reports to user with per-task failure reasons.
- User decides: retry with modifications / skip this wave / cancel execution.

### Scenario D: R4 Deviation blocks a task
- Only the affected task is paused.
- Other tasks in the wave continue.
- PM presents R4 details to user (see deviation-rules.md).
- Resolution does not block the wave boundary QA (blocked task is excluded from QA).

### Scenario E: VPM cross-check finds issues
```
VPM returns ISSUES_FOUND:
  1. PM creates targeted fix tasks from VPM issue list.
  2. PM executes fix tasks (same wave rules).
  3. PM re-dispatches VPM for re-check.
  4. Max 2 VPM re-checks per wave. After that, escalate to user.

VPM issue types and handling:
  - Task-summary mismatch: implementer must update code to match claimed behavior.
  - Inter-task signature mismatch: fix the consumer to match the provider's actual signature.
  - Wiring IMPORT_ONLY: add actual usage (function call, instantiation) in the consuming file.
  - Anti-pattern (stub/TODO): complete the implementation or remove the placeholder.
```

---

## 5. Team Mode vs Subagent Mode

> **Note:** Team mode is PM-managed using Claude's native tools (TeamCreate, SendMessage). The forge engine does not provide team-mode commands — PM must manually manage team lifecycle, message routing, and result collection. Subagent mode (Agent tool) is the engine-supported default.

### When to Use Each

| Criteria | Subagent Mode | Team Mode |
|---|---|---|
| Scale | small (1-5 tasks) | medium/large (6+ tasks) |
| Task interdependency | Low | High |
| Context sharing needs | None | Some (shared project context) |
| Overhead | Low (no team setup) | Higher (team create/manage/destroy) |
| Agent lifetime | Per-invocation (ephemeral) | Persistent (lives across tasks) |

### Subagent Mode Details
- Each agent invocation is independent. No state is shared between invocations.
- Agent is created, executes its task, returns the output path, and terminates.
- Suitable for small projects where tasks are straightforward and independent.
- PM dispatches agents using standard tool calls (no TeamCreate).

### Team Mode Details
- PM creates a team at the start of Step 7: `TeamCreate({slug})`.
- Persistent agents are created within the team:
  - `implementer` (lives for the duration of execution)
  - `code-reviewer` (lives for the duration of execution)
  - `qa-inspector` (created at wave boundaries, terminated after QA)
- Communication via `SendMessage` instead of fresh agent dispatch.
- Advantages:
  - Agents accumulate project context across tasks (faster for related tasks).
  - Lower latency (no agent creation overhead per task).
- Disadvantages:
  - Agents are subject to context rot (same problem as PM).
  - More complex lifecycle management.
  - Higher token cost for long sessions.

### Team Mode Wave Execution Flow

When using team mode, wave execution differs from subagent mode:

1. **Setup (once, at Step 7 start):**
   - PM calls `TeamCreate({slug})` to create the team
   - PM creates persistent agents: implementer(s), code-reviewer, qa-inspector
   - Each agent receives its prompt + project context at creation time

2. **Per-wave task dispatch:**
   - PM sends each task to an implementer via `SendMessage` (not by spawning a new agent)
   - Multiple implementers can receive tasks in parallel (up to max concurrency)
   - PM waits for each implementer to reply with `Output written to: {path}`
   - PM then routes to code-reviewer via `SendMessage` for review
   - Same-file conflict rules still apply: two tasks modifying the same file cannot execute in the same wave

3. **Wave boundary:**
   - PM sends wave summary to qa-inspector via `SendMessage`
   - QA inspector and VPM run the same checks as subagent mode
   - After wave completes, PM drops completed task context from agents (via a "context reset" message) to mitigate context rot

4. **Teardown (at Step 10 or on failure):**
   - PM destroys the team and all persistent agents

**Key difference:** In team mode, agents accumulate context across tasks within a wave. This means the second task an implementer handles benefits from context learned during the first task, but also risks context rot if the wave is large.

### Hybrid Approach (recommended for medium)
- Use subagent mode for the first wave (fresh context, clean start).
- If revision rates are low: continue with subagent mode.
- If revision rates are high (3+ revisions in Wave 1): switch to team mode for remaining waves.
- PM records the mode in meta.json `options.exec_mode`.

---

## 6. Wave Strategy by Type

### code (standard feature implementation)
```
Wave 1: Interfaces, types, and data structures
         (foundation that other code depends on)
Wave 2: Core implementation
         (business logic, handlers, services)
Wave 3: Integration, wiring, and tests
         (connect components, write integration tests)
```
- Prefer vertical slices: each wave delivers a working (if incomplete) feature.
- Avoid horizontal slices: "all models first, then all services, then all handlers."

### code-bug (bug fix)
```
Single wave preferred (1-3 tasks):
  Task 1: Write a failing test that reproduces the bug [REF:H1]
  Task 2: Fix the root cause
  Task 3: Verify the fix passes the test + no regressions
```
- If the bug is complex (multiple root causes): use 2 waves max.
- Enforce order: reproduce -> fix -> verify. Do not parallelize these.

### code-refactor (refactoring)
```
Wave 1: Strengthen test coverage
         (ensure behavior is captured before changing it)
Wave 2: Refactor implementation
         (change structure while tests stay green)
Wave 3: Cleanup and documentation
         (remove dead code, update docs)
```
- Critical rule: all existing tests must pass after Wave 1 and remain passing through Waves 2-3.
- If any test fails after refactoring: the refactoring task is marked as failed.

### infra (infrastructure changes)
```
Wave 1: Dry-run and validation
         (create configs, run terraform plan / docker build --dry-run)
Wave 2: Apply changes
         (terraform apply, deploy, configure)
Wave 3: Smoke test and verification
         (health checks, integration tests)
```
- Wave 2 requires user confirmation before starting (even for small scale).
- Rollback plan must be documented in plan.md before Wave 2 starts.

### docs (documentation)
```
Single wave:
  All documentation tasks run in parallel (no file conflicts expected).
  No QA gate (doc-reviewer replaces qa-inspector).
```

### analysis / analysis-security / design
```
No wave execution. Research produces the final output.
If analysis-security: single researcher with opus model.
```
