# Phase {N} Context: {phase_name}

> Captured decisions and constraints for this phase.
> Locked decisions are IMMUTABLE -- planner and implementer MUST follow them.
>
> Decision status types:
> - **[LOCKED]** — Immutable. Planner and implementer MUST follow exactly as written.
> - **[DEFERRED]** — Explicitly out of scope for this phase. Do NOT implement.
> - **[DISCRETION]** — Implementer/planner may choose approach freely.

## Phase Goal
{goal from roadmap.md}

## Locked Decisions [LOCKED]
<!-- User-confirmed decisions. Planner MUST follow these exactly. -->
- **{topic}:** {decision} (confirmed: {YYYY-MM-DD})

## Implementation Discretion [DISCRETION]
<!-- Areas where the planner/implementer has freedom to choose. -->
- {topic}: {description of freedom}

## Deferred Decisions [DEFERRED]
<!-- Captured but explicitly out of scope for this phase. -->
- {idea}: deferred to {phase N or "backlog"}

---

## RULES
- Locked Decisions are IMMUTABLE once written. Never modify or remove.
- Claude's Discretion areas give planner freedom -- no need to ask user.
- Deferred Ideas are explicitly OUT OF SCOPE. Do not implement.
- This file is optional. Created during /forge --discuss N or automatically during --autonomous.
