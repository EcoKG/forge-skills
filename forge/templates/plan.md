# Plan Document Template

Use this structure when writing plan.md for an artifact.

---

```markdown
# [Issue-Based Title] Implementation Plan

> Created: YYYY-MM-DD
> Goal: [issue description]
> Reference: [research.md or --from file]
> Methodology: agile
> Scale: [small/medium/large]
> Type: [code/docs/analysis/infra/design]

## 1. Project Overview

Brief description of what will be implemented and why.
Scope boundaries: what's included and what's explicitly excluded.

## 2. Technical Stack (with rationale)

- Language/Framework: [name] — [why this choice]
- Build system: [name] — [command]
- Test framework: [name] — [if applicable]
- Key dependencies: [list significant ones]

## 3. Implementation Phases

### Phase 1: [Phase Title]
**Goal:** [what this phase achieves]
**Completion criteria:** [how to verify phase is done]

### Phase 2: [Phase Title]
...

## 4. Task Checklist

Format: `- [ ] [N-M] Task description [REF:Hx,Mx]`

### Phase 1: [Phase Title]
- [ ] [1-1] Task description [REF:H1]
- [ ] [1-2] Task description [REF:H2,M1]
- [ ] [1-3] Task description [REF:M2]

### Phase 2: [Phase Title]
- [ ] [2-1] Task description [REF:H3]
- [ ] [2-2] Task description [REF:M3,M4]

## 5. Design Patterns (if applicable)

Patterns applied and why:
- [Pattern Name]: applied to [component] because [reason] [REF:Hx]

## 6. Risk & Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| [risk] | [impact] | [mitigation] |
```

---

## Quality Rules

- Task IDs: `[N-M]` prefix mandatory (Phase-Task)
- Traceability: `[REF:Hx,Mx]` tags link each task to research findings
- Verbs: start each task with concrete verb (implement, add, create, configure, write, test)
- Granularity: each task completable and verifiable independently
- Minimums: small ≥3, medium ≥8, large ≥20 tasks
- Per phase: 3–10 tasks (avoid oversized phases)
- **TDD (MANDATORY)**: test tasks MUST be placed before implementation tasks. Skip only with explicit justification in plan (e.g., platform runtime unavailable)
- **OOP/SOLID (MANDATORY)**: all code changes must comply with SRP, OCP, LSP, ISP, DIP. Violations cause REJECT
- Phase goals: each phase has explicit goal and completion criteria

## Traceability Verification

- All HIGH research findings must be referenced by at least one task
- No phantom refs: every [REF:xx] must correspond to an existing research finding ID
- Tasks not linked to research findings should have clear justification
