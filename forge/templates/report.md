# Final Report Template (v2)

Use this structure when generating the completion report in Step 9.
This is a FILE artifact (saved to disk) — use rich markdown formatting.

**Scale-based branching:**
- **small**: Overview + Task Statistics + Changed Files + Wave Summary. Skip Traceability Matrix details, Models Used, Lessons Learned.
- **medium**: Full template. Collapse optional sections if empty.
- **large**: Full template. All sections mandatory. Add executive summary paragraph after Overview.

---

## Template

```markdown
# Forge Report — [{slug}]

> {date} · {HHMM} · `.forge/{date}/{slug}-{HHMM}/`

---

## Overview

| | |
|---|---|
| **Issue** | {issue description} |
| **Type** | `{code/code-bug/code-refactor/docs/analysis/analysis-security/infra/design}` |
| **Scale** | `{small/medium/large}` |
| **Paradigm** | `{oop/fp/script/ddd/mixed}` |
| **Mode** | `{standard/direct}` |
| **Execution** | `{subagent/team}` |
| **Waves** | `{N}` |

<!-- large scale only: add executive summary paragraph here -->

---

## Task Statistics

```
 Completed  {N}  ████████████████░░░░  {P}%
 Skipped    {N}  █░░░░░░░░░░░░░░░░░░░  {P}%
 Escalated  {N}  ░░░░░░░░░░░░░░░░░░░░  {P}%
 ─────────────────────────────────────────
 Total      {N}  ████████████████████  100%
```

---

## Wave Execution Summary

| Wave | Tasks | Parallel | Revisions | QA Result |
|---|---|---|---|---|
| 1 | {N} | {N concurrent} | {N minor, N major} | {PASS/GAPS_FOUND} |
| 2 | {N} | {N concurrent} | {N minor, N major} | {PASS/GAPS_FOUND} |
| 3 | {N} | {N concurrent} | {N minor, N major} | {PASS/GAPS_FOUND} |

**Total Waves:** {N} | **Total Revisions:** {N} minor, {N} major, {N} reject

---

## Phase Results

### Phase 1: {title}
| Status | Tasks | Waves | QA Verdict |
|---|---|---|---|
| {Completed/Partial/Failed} | `{X}/{Y}` | {N} | `{PASS/GAPS_FOUND}` |

### Phase 2: {title}
| Status | Tasks | Waves | QA Verdict |
|---|---|---|---|
| {Completed/Partial/Failed} | `{X}/{Y}` | {N} | `{PASS/GAPS_FOUND}` |

> Status values: Completed / Partial / Failed. Add/remove phases as needed.

---

## Verification Summary

| Level | Checked | Passed | Failed |
|---|---|---|---|
| Level 1 (Exists) | {N} | {N} | {N} |
| Level 2 (Substantive) | {N} | {N} | {N} |
| Level 3 (Wired) | {N} | {N} | {N} |
| Truths | {N} | {N} | {N} |

**Verdict:** `{VERIFIED|GAPS_FOUND|FAILED}`

> Reference: `.forge/{date}/{slug}-{HHMM}/verification.md`

---

## Changed Files

| # | File | Change |
|---|---|---|
| 1 | `{file path}` | {brief description} |
| 2 | `{file path}` | {brief description} |
| 3 | `{file path}` | {brief description} |

> Total: **{N} files** modified, +{N} -{N} lines

---

## Review Summary

| | PASS | REVISION (minor) | REVISION (major) | REJECT |
|---|---|---|---|---|
| **Code Review** | {N} | {N} | {N} | {N} |
| **QA Inspect** | {N} | {N} | — | — |

<details>
<summary>Notable review findings (click to expand)</summary>

| # | Finding | Severity | Task | Resolution |
|---|---|---|---|---|
| 1 | {description} | {minor/major} | [{task_id}] | {how resolved} |
| 2 | {description} | {minor/major} | [{task_id}] | {how resolved} |

</details>

---

## Traceability Matrix

| Research Finding | Severity | Plan Task(s) | Implemented | Verified |
|---|---|---|---|---|
| [H1] {title} | HIGH | [{task_id}] | {YES/NO} | {YES/NO} |
| [H2] {title} | HIGH | [{task_id}] | {YES/NO} | {YES/NO} |
| [M1] {title} | MEDIUM | [{task_id}] | {YES/NO} | {YES/NO} |
| [M2] {title} | MEDIUM | [{task_id}] | {YES/NO} | {YES/NO} |
| [L1] {title} | LOW | [{task_id}] | {YES/NO/DEFERRED} | {YES/NO/N/A} |

**Coverage:**
- HIGH: `{N}/{N}` addressed
- MEDIUM: `{N}/{N}` addressed
- LOW: `{N}/{N}` addressed, `{N}` deferred

<details>
<summary>Unaddressed findings (if any)</summary>

| Finding ID | Severity | Reason Deferred |
|---|---|---|
| {L1} | LOW | {why it was deferred} |

</details>

> If all addressed: **Full coverage — no unaddressed findings.**

---

## Deviations Log

| # | Task | Rule | Description | Auto-Fixed |
|---|---|---|---|---|
| 1 | [{task_id}] | {R1/R2/R3/R4} | {what was found and done} | {YES/NO/BLOCKED} |
| 2 | [{task_id}] | {R1/R2/R3/R4} | {what was found and done} | {YES/NO/BLOCKED} |

> If no deviations: **No deviations recorded.**

---

## Models Used

| Stage | Model | Upgrades | Notes |
|---|---|---|---|
| Research | `{model}` | — | {N parallel agents} |
| Plan | `{model}` | {N upgrades} | |
| Plan-Check | `{model}` | — | |
| Implement | `{model}` | {N upgrades} | |
| Code Review | `{model}` | {N downgrades} | |
| QA | `{model}` | — | |
| Verify | `{model}` | — | |

---

## Token/Cost Estimation

| Stage | Model | Estimated Tokens | Cost Tier |
|---|---|---|---|
| Research | `{model}` | ~{N}k | {low/medium/high} |
| Plan + Check | `{model}` | ~{N}k | {low/medium/high} |
| Implement ({N} tasks) | `{model}` | ~{N}k | {low/medium/high} |
| Code Review ({N} tasks) | `{model}` | ~{N}k | {low/medium/high} |
| QA ({N} waves) | `{model}` | ~{N}k | {low/medium/high} |
| Verify | `{model}` | ~{N}k | {low/medium/high} |
| **Total** | | **~{N}k** | |

> Estimates are approximate. Actual usage depends on revision loops and code complexity.

---

## Lessons Learned

> Auto-populated if revision patterns were detected 3+ times.

| Pattern | Count | Action Taken |
|---|---|---|
| {pattern description} | {N}x | {what was done — e.g., "Added to project profile"} |

> If none: **No recurring patterns detected.**

---

<div align="center">

### Forge Complete

**`{slug}`** · `{type}` · `{scale}` · **{N}/{N} tasks** · **{N} waves**

Verification: `{VERIFIED|GAPS_FOUND|FAILED}`

{date} {HHMM}

</div>
```

---

## Scale-Based Section Requirements

| Section | Small | Medium | Large |
|---|---|---|---|
| Overview | Required | Required | Required + Executive Summary |
| Task Statistics | Required | Required | Required |
| Wave Execution Summary | Required | Required | Required |
| Phase Results | Abbreviated (1 phase) | Required | Required |
| Verification Summary | Required | Required | Required |
| Changed Files | Required | Required | Required |
| Review Summary | Abbreviated | Required | Required |
| Traceability Matrix | Skip | Required | Required (full detail) |
| Deviations Log | Include if any | Required | Required |
| Models Used | Skip | Required | Required |
| Token/Cost Estimation | Skip | Required | Required |
| Lessons Learned | Skip | Include if any | Required |

---

## Guidelines

- **Progress bar:** Fill `█` per completed %, `░` for remaining (20 chars total = 5% each)
- **Phase sections:** Add/remove based on actual count
- **Changed Files:** Include brief what-changed description, not just path
- **Review findings:** Use `<details>` collapse for 3+ items
- **Traceability:** Match H1/M1/L1 IDs from research.md — every HIGH must appear
- **Wave Summary:** Captures parallel execution efficiency and revision patterns
- **Deviations Log:** Every [DEVIATION:Rx] from task summaries must appear here
- **Verification Summary:** Pulled directly from verification.md — must match exactly
- **Lessons Learned:** Only populate if recurring patterns were detected

## Rules

1. **All HIGH findings must appear in Traceability Matrix** with Implemented=YES
2. **Verification Summary must match verification.md** — do not fabricate results
3. **Deviations Log must capture ALL deviations from ALL task summaries** — aggregate [DEVIATION:Rx] tags
4. **Wave Execution Summary must be accurate** — cross-reference with meta.json
5. **Scale-based sections are enforced** — do not include skipped sections for small scale
6. **Changed Files must be verified** — only list files that actually changed (git diff)
7. **Review Summary counts must be accurate** — sum across all tasks
