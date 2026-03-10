# 📊 Final Report Template

Use this structure when generating the completion report in Step 9.
This is a FILE artifact (saved to disk) — use rich markdown formatting.

**Scale-based branching:**
- **small**: Use Overview + Task Statistics + Changed Files + Review Summary only. Skip Phase Results details, Traceability, Models Used, Lessons Learned.
- **medium**: Full template. Collapse optional sections (Traceability, Lessons Learned) if empty.
- **large**: Full template. All sections mandatory. Add executive summary paragraph after Overview.

---

```markdown
# 📊 Forge Report — [{slug}]

> 🗓️ {date} · ⏱️ {HHMM} · 📁 `.claude/artifacts/{date}/{slug}-{HHMM}/`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🎯 Overview

| | |
|---|---|
| **🏷️ Issue** | {issue description} |
| **📂 Type** | `{code/docs/analysis/infra/design}` |
| **📐 Scale** | `{small/medium/large}` |
| **⚙️ Mode** | `{standard/direct}` |
| **🤖 Execution** | `{subagent/team}` |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 📋 Task Statistics

```
 ✅ Completed  {N}  ████████████████░░░░  {P}%
 ⏭️ Skipped    {N}  █░░░░░░░░░░░░░░░░░░░  {P}%
 🚨 Escalated  {N}  ░░░░░░░░░░░░░░░░░░░░  {P}%
 ─────────────────────────────────────────
 📊 Total      {N}  ████████████████████  100%
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 📦 Phase Results

### 📦 Phase 1: {title}
| Status | Tasks | QA Verdict |
|---|---|---|
| ✅ Completed | `{X}/{Y}` | 🟢 `PASS` |

### 📦 Phase 2: {title}
| Status | Tasks | QA Verdict |
|---|---|---|
| ✅ Completed | `{X}/{Y}` | 🟢 `PASS` |

### 📦 Phase 3: {title}
| Status | Tasks | QA Verdict |
|---|---|---|
| ⚠️ Partial | `{X}/{Y}` | 🟡 `GAPS_FOUND` |

> 💡 Use ✅ Completed / ⚠️ Partial / ❌ Failed. Add/remove phases as needed.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 📝 Changed Files

| # | File | Change |
|---|---|---|
| 1 | `{file path}` | {brief description} |
| 2 | `{file path}` | {brief description} |
| 3 | `{file path}` | {brief description} |

> 📊 Total: **{N} files** modified

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🔍 Review Summary

| | 🟢 PASS | 🟡 REVISION | 🔴 REJECT |
|---|---|---|---|
| **🔍 Code Review** | {N} | {N} | {N} |
| **✅ QA Inspect** | {N} | {N} | {N} |

<details>
<summary>📌 Notable review findings (click to expand)</summary>

| # | Finding | Severity | Resolution |
|---|---|---|---|
| 1 | {description} | 🟡 minor | {how it was resolved} |
| 2 | {description} | 🟠 major | {how it was resolved} |

</details>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🔗 Traceability

| Severity | Coverage | Status |
|---|---|---|
| 🔴 HIGH | `{N}/{N}` covered | ✅ |
| 🟡 MEDIUM | `{N}/{N}` covered | ✅ |
| 🟢 LOW | `{N}/{N}` covered | ⚠️ {N} deferred |

<details>
<summary>📌 Unaddressed findings (if any)</summary>

| Finding ID | Reason |
|---|---|
| {L1} | {why it was deferred} |

</details>

> If all addressed: **✅ Full coverage — no unaddressed findings.**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🤖 Models Used

| Stage | Model | Notes |
|---|---|---|
| 🔬 Research | `{model}` | |
| 📋 Plan | `{model}` | |
| 🛠️ Implement | `{model}` | {adaptive upgrades if any} |
| 🔍 Review | `{model}` | {downgraded after 3+ PASS if applicable} |
| ✅ QA | `{model}` | |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 💰 Token/Cost Estimation

| Stage | Model | Estimated Tokens | Cost Tier |
|---|---|---|---|
| 🔬 Research | `{model}` | ~{N}k | {low/medium/high} |
| 📋 Plan + Review | `{model}` | ~{N}k | {low/medium/high} |
| 🛠️ Implement ({N} tasks) | `{model}` | ~{N}k | {low/medium/high} |
| 🔍 Code Review ({N} tasks) | `{model}` | ~{N}k | {low/medium/high} |
| ✅ QA ({N} phases) | `{model}` | ~{N}k | {low/medium/high} |
| **Total** | | **~{N}k** | |

> Estimates are approximate. Actual usage depends on revision loops and code complexity.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 💡 Lessons Learned

> Auto-populated if revision patterns were detected 3+ times.

| Pattern | Count | Action |
|---|---|---|
| {pattern description} | {N}× | ➡️ Added to `forge-rules.md` |

> If none: **✅ No recurring patterns detected.**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<div align="center">

### 🏁 Forge Complete

**`{slug}`** · `{type}` · `{scale}` · **{N}/{N} tasks**

🗓️ {date} ⏱️ {HHMM}

</div>
```

---

## 📝 Guidelines

- **Progress bar:** Fill `█` per completed %, `░` for remaining (20 chars total = 5% each)
- **Phase sections:** Add/remove based on actual count
- **Changed Files:** Include brief what-changed description, not just path
- **Review findings:** Use `<details>` collapse for 3+ items
- **Traceability:** Match H1/M1/L1 IDs from research.md
- **Lessons Learned:** Only populate if forge-rules.md was updated
- **Status icons:** 🟢 pass · 🟡 minor/partial · 🟠 major · 🔴 reject/fail
