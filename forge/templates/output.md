# Forge Output Format Templates (v6.0)

Use these templates for user-facing progress output at each step.
Read this file at Step 1 and use the formats throughout the session.

---

## Step 1: Init

**Forge Start**
- Issue: {issue description}
- Type: {code/code-bug/code-refactor/docs/analysis/analysis-security/infra/design}
- Scale: {small/medium/large}
- Paradigm: {oop/fp/script/ddd/mixed}
- Language: {detected language}
- Model: {quality/balanced/budget}
- Exec: {subagent/team}
- Artifact: `.forge/{date}/{slug}-{HHMM}/`
- Disclosure: {novice/standard/advanced}
- Plugins: {N} custom agents ({names or "none"})

---

## Step 2: Research Complete

**Research Done**
- HIGH: {N}
- MEDIUM: {N}
- LOW: {N}
- Key: {1-line summary of most critical finding}
- Saved: `.forge/{date}/{slug}-{HHMM}/research.md`

---

## Step 3: Plan Complete

**Plan Done**
- Phases: {N}
- Tasks: {N}
- Waves: {N}
- Truths: {N} must-haves defined
- Saved: `.forge/{date}/{slug}-{HHMM}/plan.md`

---

## Step 4: Plan Check Result Format

```
━━━ Plan Verification (8D) ━━━━━━━
D1 Requirements: {status}  D5 Scope:    {status}
D2 Completeness: {status}  D6 Verify:   {status}
D3 Dependencies: {status}  D7 DeepWork: {status}
D4 Key Links:    {status}  D8 Tests:    {status}
Overall: {PASS|NEEDS_REVISION|FAIL} ({N}✅ {N}⚠️ {N}❌)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Status values: `✅` PASS, `⚠️` WARN, `❌` FAIL

---

## Step 5: Checkpoint

**Checkpoint: [{slug}]**

Plan summary:
- {N} tasks across {N} waves
- Key deliverables: {1-2 line summary}
- Estimated complexity: {low/medium/high}

Options:
```
[1] Execute — proceed with plan
[2] Modify — edit plan and re-check
[3] Cancel — abort
```

> small scale: auto-proceed (no user prompt)

---

## Step 6: Branch

**Branch:** `feature/{slug}`

---

## Step 7: Wave Progress Format

```
━━━ Wave {N}/{total} ━━━━━━━━━━━━━━━
[{task_id}] ✅ {task_name}
[{task_id}] ✅ {task_name} (1 minor revision)
[{task_id}] ⏳ {task_name} (implementing...)
[{task_id}] ⏳ {task_name} (in review...)
[{task_id}] ❌ {task_name} (BLOCKED: R4)
[{task_id}] ⬜ {task_name} (pending)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Progress: {completed}/{total} tasks | Wave {current}/{total_waves}
```

Status icons:
- `✅` — task complete (PASS)
- `⏳` — task in progress (implementing or reviewing)
- `❌` — task failed or blocked
- `⬜` — task pending (not yet started)
- `🔄` — task in revision loop

---

## Step 7: Task Progress (per task)

**Task complete:**
- [{task_id}] {task_name} — Wave {N}: {X}/{Y} ({P}%)

**Review result:**
- PASS: [{task_id}]
- NEEDS_REVISION (minor): [{task_id}] — {brief reason}
- NEEDS_REVISION (major): [{task_id}] — {brief reason}
- REJECT: [{task_id}] — {brief reason}

**Revision loop:**
- [{task_id}] revision {K}/{max} — {what is being fixed}

**Deviation detected:**
- [{task_id}] [DEVIATION:{R1/R2/R3}] — {brief description}
- [{task_id}] [DEVIATION:R4:BLOCKED] — {description} — awaiting user decision

**Wave boundary:**
- Wave {N} complete — Tasks: {X}/{Y}, QA: {PASS/GAPS_FOUND}
- Wave {N} QA failed — {gap description}

---

## Step 8: Verification Result Format

```
━━━ Goal-Backward Verification ━━━━
Level 1 (Exists):      {N}/{N} ✅
Level 2 (Substantive): {N}/{N} ✅
Level 3 (Wired):       {N}/{N} ✅
Truths:                {N}/{N} ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Verdict: {VERIFIED|GAPS_FOUND|FAILED} {icon}
```

Verdict icons: `✅` VERIFIED, `⚠️` GAPS_FOUND, `❌` FAILED

If GAPS_FOUND:
```
Gaps found ({N}):
  - {gap 1 description}
  - {gap 2 description}
Action: generating fix tasks...
```

---

## Step 9: Final Report (Chat Summary)

**Forge Complete: [{slug}]**
- Issue: {issue description}
- Type: {type} | Scale: {scale} | Exec: {exec}

Tasks:
- Completed: {N}
- Skipped: {N}
- Escalated: {N}
- Total: {N}

Waves: {N} total, {N} revisions

Verification: {VERIFIED|GAPS_FOUND|FAILED}
- Exists: {N}/{N}
- Substantive: {N}/{N}
- Wired: {N}/{N}
- Truths: {N}/{N}

Changed files: {file paths — max 10, else "+ N more"}

Deviations: {N} total ({N} R1, {N} R2, {N} R3, {N} R4)

Artifact: `.forge/{date}/{slug}-{HHMM}/`

---

## Context Pressure Warning Format

```
⚠ Context Pressure: {MEDIUM|HIGH|CRITICAL}
  Usage: ~{N}% of context window
  Action: {what is being done to manage it}
```

Pressure levels:
- **MEDIUM (30-50%):** Replacing old step details with summaries
- **HIGH (50-70%):** Loading only current-step essential files
- **CRITICAL (>70%):** Emergency reduction — only active task data retained

> Only display when pressure reaches MEDIUM or above.

---

## Resume

**Forge Resume: [{slug}]**
- Last step: {step name}
- Wave: {current}/{total}
- Progress: {X}/{Y} tasks done
- Next: {what will happen next}

---

## Error / Status Messages

- Missing issue: ask user for issue description
- Error: {error description}
- Agent timeout: {agent name} — retrying with {action}
- Escalation: {reason} — user confirmation needed
- Cancelled: artifact saved to `.forge/{date}/{slug}-{HHMM}/`

**Revision limit reached:**
- Plan revision limit ({N}/3) — requesting manual edit
- Code revision limit ({N}/5 minor, {N}/3 major) — escalating
- QA retry limit ({N}/2) — escalating

**Model upgrade:**
- Upgrading {agent} from {model_a} to {model_b} — reason: {N} consecutive failures

---

## Progressive Disclosure Modes

### novice
- Show detailed explanation for every step transition
- Show what each agent does before dispatching
- Show all options at every checkpoint (never auto-proceed)
- Use friendly language, avoid jargon
- Example:
  ```
  Step 2: Research — I'm going to explore your codebase to understand:
  - What files exist and how they're organized
  - What patterns are already in use
  - What might be affected by this change
  This usually takes 10-30 seconds...
  ```

### standard (default)
- Current behavior — concise status updates
- Auto-proceed for small scale
- Technical but not verbose
- Example:
  ```
  Forge v3.2 | type: code | scale: medium | lang: typescript | paradigm: oop
  Artifact: .forge/2026-03-17/auth-feature-1430/
  ```

### advanced
- Minimal output — show only task IDs and verdicts
- Auto-proceed for small AND medium scale
- Skip checkpoint for non-large
- Suppress wave progress details (show only final summary)
- Example:
  ```
  ⚒ auth-feature | 8 tasks 3 waves | balanced
  W1: ✅✅✅ | W2: ✅✅✅ | W3: ✅✅ | QA: PASS | V: VERIFIED
  ```

### Mode Selection
- Set via config.json `disclosure_mode`
- Override per-execution: auto-detected from user's verbosity preference
- PM reads mode at Step 1 and adapts ALL output formats accordingly
