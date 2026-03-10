# Research Report Template

Use this structure when writing research.md for an artifact.

---

```markdown
# [Issue-Based Title] Research Report

> Created: YYYY-MM-DD
> Issue: [original issue description]
> Scale: [small/medium/large]
> Type: [code/docs/analysis/infra/design]

## 1. Current State Analysis

Describe the current state of the system/code relevant to the issue.
Include file paths, class names, and data flow diagrams where helpful.

## 2. Findings (by severity)

Each finding has a unique ID: H1, H2 (HIGH), M1, M2 (MEDIUM), L1, L2 (LOW).
These IDs are used for traceability in plan.md [REF:Hx,Mx] tags.

### HIGH

#### H1. [Finding Title]
- **Location:** file:line or module
- **Description:** What was found
- **Impact:** What breaks or degrades
- **Evidence:** Code snippet or trace

#### H2. [Finding Title]
...

### MEDIUM

#### M1. [Finding Title]
...

### LOW

#### L1. [Finding Title]
...

## 3. Related Code Structure

Key files, classes, and their relationships.
Call graphs or dependency maps for affected modules.

## 4. Recommended Approach & Patterns

Suggested fix strategy, applicable design patterns (GoF, CQRS, Repository, etc.).
Existing patterns in the codebase to reuse or follow.
```

---

## Guidelines

- Every finding MUST have a unique severity-prefixed ID (H1, M1, L1)
- Reference actual file paths and line numbers — verify they exist via Glob/Grep
- HIGH findings: breaking bugs, security issues, data loss risks
- MEDIUM findings: degraded UX, performance issues, maintainability concerns
- LOW findings: code style, minor improvements, tech debt
- Keep findings actionable — each should map to at least one plan task
