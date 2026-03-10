# Forge Output Format Templates

Use these templates for user-facing progress output at each step.
Read this file at Step 1 and use the formats throughout the session.

---

## Step 1: Init

**Forge Start**
- Issue: [issue description]
- Type: [code/docs/analysis/...]
- Scale: [small/medium/large]
- Model: [auto/forced]
- Exec: [subagent/team]
- Artifact: `.claude/artifacts/{d}/{s}/`

---

## Step 2: Research Complete

**Research Done**
- HIGH: [N]
- MEDIUM: [N]
- LOW: [N]
- Saved: `.claude/artifacts/{d}/{s}/research.md`

---

## Step 3: Plan Complete

**Plan Done**
- Phases: [N]
- Tasks: [N]
- Review: [role] — [verdict] ([S]/10)
- Saved: `.claude/artifacts/{d}/{s}/plan.md`

---

## Step 5: Git Branch

**Branch:** `feature/{slug}`

---

## Step 6: Tasks Created

**Tasks converted:** [N]
- Phase 1: [N]
- Phase 2: [N]
- Phase 3: [N]

---

## Step 7: Agent Setup

**code type:**
- implementer — code impl ([model])
- code-reviewer — code review ([model])
- qa-inspector — QA verify ([model], on-demand)

**docs type:**
- implementer — doc writing ([model])
- doc-reviewer — doc review ([model])

**analysis type:**
- analyst — analysis ([model])

---

## Step 8: Task Progress

**Task complete:**
- [N-M] [task title] — Phase [N]: [X]/[Y] ([P]%)

**Review result:**
- PASS: [N-M]
- NEEDS_REVISION (minor): [N-M] — [brief reason]
- NEEDS_REVISION (major): [N-M] — [brief reason]
- REJECT: [N-M] — [brief reason]

**Revision loop:**
- [N-M] revision [K]/5 — [what's being fixed]

**Phase boundary:**
- Phase [N] complete — Tasks: [X]/[Y], QA: PASS
- Phase [N] failed — Tasks: [X]/[Y], QA: GAPS_FOUND — [gap description]

---

## Step 9: Final Report (Chat Summary)

**Forge Complete: [{slug}]**
- Issue: [issue description]
- Type: [type] | Scale: [scale] | Exec: [exec]

Tasks:
- Completed: [N]
- Skipped: [N]
- Escalated: [N]
- Total: [N]

Phases:
- Phase 1: [N]/[N] [title]
- Phase 2: [N]/[N] [title]

Review:
- Code Review: PASS [N] / REVISION [N] / REJECT [N]
- QA Inspect: PASS [N] / REVISION [N] / REJECT [N]

Changed files: [file paths — max 10, else "+ N more"]

Models: Research [m] | Plan [m] | Impl [m] | Review [m] | QA [m]

Artifact: `.claude/artifacts/{d}/{s}/`

---

## Resume

**Forge Resume: [{slug}]**
- Last step: [step]
- Phase: [N]
- Progress: [X]/[Y] tasks done

---

## Error / Status Messages

- Missing issue: ask user for issue description
- Error: [error description]
- Agent respawn: [agent name] (timeout exceeded)
- Escalation: [reason] — user confirmation needed
- Timeout: [agent name] ([N]min)
- Cancelled: artifact saved
