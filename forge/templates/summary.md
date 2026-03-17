# Task Summary Template (v6.0)

Use this structure when writing task-{N-M}-summary.md after each task execution.
The implementer agent MUST follow this template exactly.

---

## Template

```markdown
# Task Summary: [{task_id}] {task_name}

## Status: {PASS|REVISION|BLOCKED}

> Task: [{task_id}] {task_name}
> Wave: {wave_number}
> Phase: {phase_number}
> Date: {YYYY-MM-DD HH:MM}

---

## Changes Made

| # | File | Action | Lines Changed | Description |
|---|---|---|---|---|
| 1 | {file_path} | {created|modified|deleted|renamed} | +{N} -{N} | {what was changed} |
| 2 | {file_path} | {created|modified|deleted|renamed} | +{N} -{N} | {what was changed} |
| 3 | {file_path} | {created|modified|deleted|renamed} | +{N} -{N} | {what was changed} |

**Total:** {N} files changed, +{N} -{N} lines

---

## Deviations

<!-- If no deviations occurred, write exactly: "None" -->
<!-- If deviations occurred, list each with the appropriate tag: -->

### [DEVIATION:R1] {bug_title}
- **Found in:** {file_path:line}
- **Bug:** {what the bug was}
- **Fix:** {what was done to fix it}
- **Scope check:** {why this is within current task scope}

### [DEVIATION:R2] {missing_feature_title}
- **Found in:** {file_path}
- **Missing:** {what was missing}
- **Added:** {what was added}
- **Scope check:** {why this is within current task scope}

### [DEVIATION:R3] {blocking_issue_title}
- **Blocked by:** {what was blocking}
- **Resolution:** {how it was resolved}
- **Scope check:** {why this is within current task scope}

### [DEVIATION:R4:BLOCKED] {architecture_change_title}
- **Issue:** {what architecture change is needed}
- **Why blocked:** Requires user decision — beyond task scope
- **Suggested options:** {list of options for the user}

---

## Self-Check Results

| # | Check Item | Status | Notes |
|---|---|---|---|
| 1 | Circular reference / import cycle | {PASS/FAIL/N/A} | {details if FAIL} |
| 2 | Init order / dependency sequence | {PASS/FAIL/N/A} | {details if FAIL} |
| 3 | Null/nil/undefined safety | {PASS/FAIL/N/A} | {details if FAIL} |
| 4 | Save/Load roundtrip consistency | {PASS/FAIL/N/A} | {details if FAIL} |
| 5 | Event timing / race condition | {PASS/FAIL/N/A} | {details if FAIL} |
| 6 | Build/compile result | {PASS/FAIL/N/A} | {command + result} |

**Self-Check:** {N}/{N} PASS ({N} N/A)

---

## Acceptance Criteria

| # | Criteria | Command | Result | Status |
|---|---|---|---|---|
| 1 | {criteria from plan} | `{grep/build/test command}` | {output or summary} | {PASS/FAIL} |
| 2 | {criteria from plan} | `{grep/build/test command}` | {output or summary} | {PASS/FAIL} |
| 3 | {criteria from plan} | `{grep/build/test command}` | {output or summary} | {PASS/FAIL} |

**Acceptance:** {N}/{N} PASS

---

## Files Modified

{newline-separated list of all file paths that were created, modified, or deleted}

- {file_path_1}
- {file_path_2}
- {file_path_3}
```

---

## Status Definitions

| Status | Meaning | Next Action |
|---|---|---|
| **PASS** | All acceptance criteria met, self-check passed, build succeeds | Proceed to code review |
| **REVISION** | Partial completion, some criteria failed, or review feedback received | Re-attempt with feedback |
| **BLOCKED** | Cannot proceed due to R4 deviation or unresolvable dependency | Escalate to PM |

---

## Deviation Rules Quick Reference

| Rule | Trigger | Action | Record |
|---|---|---|---|
| R1 | Bug found (logic error, runtime crash) | Auto-fix, continue | `[DEVIATION:R1]` |
| R2 | Missing feature (security, validation) | Auto-add, continue | `[DEVIATION:R2]` |
| R3 | Blocking issue (missing dep, type mismatch) | Auto-resolve, continue | `[DEVIATION:R3]` |
| R4 | Architecture change (new DB, framework swap) | **STOP immediately** | `[DEVIATION:R4:BLOCKED]` |

**Limits:**
- Auto-fix attempts per task: maximum 3
- Scope boundary: only fix issues directly caused by current task
- R4 is never auto-fixed — always escalate

---

## Rules

1. **Maximum 100 lines** for the entire summary (excluding this template header)
2. **Every acceptance criterion from plan.md must appear** in the Acceptance Criteria table — no criterion can be skipped
3. **Self-check item #6 (Build) is mandatory** — build must be attempted and result recorded
4. **Deviations must include scope check** — explain why the fix is within the current task's scope
5. **Status must match results:**
   - PASS = ALL acceptance criteria PASS + build succeeds
   - REVISION = any acceptance criterion FAIL or self-check FAIL
   - BLOCKED = R4 deviation or unresolvable issue
6. **File paths must be exact** — relative to project root, verified to exist
7. **No prose padding** — every line must carry information
8. **Lines Changed must be accurate** — count actual added/removed lines
9. **Command column must be copy-pasteable** — commands that can be run as-is to verify
