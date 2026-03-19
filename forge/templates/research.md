# Research Report Template (v7.0)

Use this structure when writing research.md for an artifact.
The researcher agent MUST follow this template exactly.

**Maximum: 300 lines.** If findings exceed 300 lines, prioritize HIGH and MEDIUM; summarize or omit LOW findings.

---

## Template

```markdown
# Research Report: {title}

> Created: {YYYY-MM-DD}
> Issue: {original issue description}
> Scale: {small|medium|large}
> Type: {code|code-bug|code-refactor|docs|analysis|analysis-security|infra|design}

## Summary

{3-5 line executive summary covering:}
{- What the request is about}
{- Key risks or blockers discovered}
{- Recommended high-level approach}
{- Estimated complexity/scope}

---

## Findings

### Critical (HIGH)

#### [H1] {finding title}
- **Location:** {file_path:line_number}
- **Evidence:** `{grep command that reproduces the finding}`
  ```
  {grep output or relevant code snippet, 3-5 lines max}
  ```
- **Impact:** {what breaks, degrades, or is at risk if not addressed}
- **Recommendation:** {specific action — not "fix it" but "replace X with Y in file Z"}

#### [H2] {finding title}
- **Location:** {file_path:line_number}
- **Evidence:** `{grep command}`
  ```
  {output}
  ```
- **Impact:** {description}
- **Recommendation:** {specific action}

### Important (MEDIUM)

#### [M1] {finding title}
- **Location:** {file_path:line_number}
- **Evidence:** `{grep command}`
  ```
  {output}
  ```
- **Impact:** {description}
- **Recommendation:** {specific action}

### Minor (LOW)

#### [L1] {finding title}
- **Location:** {file_path:line_number}
- **Evidence:** `{grep command}`
- **Impact:** {description}
- **Recommendation:** {specific action}

---

## Current Architecture

{How the relevant parts of the codebase are structured today.}
{Include:}
{- Directory structure of affected modules}
{- Key files and their responsibilities}
{- Data flow between components}
{- Existing patterns/conventions observed}

```
{ASCII diagram if helpful, e.g.:}
{  ComponentA --calls--> ComponentB --reads--> Database}
{  ComponentA --emits--> EventBus --notifies--> ComponentC}
```

---

## Recommended Approach

{High-level strategy for implementation:}
{1. Step/phase description}
{2. Step/phase description}
{3. Step/phase description}

{Why this approach:}
{- Reasoning for chosen strategy over alternatives}
{- Alignment with existing codebase patterns}
{- Risk mitigation considerations}

---

## References (verified)

| # | Path | Contains | Verified |
|---|---|---|---|
| 1 | {file_path} | {what this file contains / why it matters} | {verified_glob / verified_grep} |
| 2 | {file_path} | {what this file contains / why it matters} | {verified_glob / verified_grep} |
| 3 | {file_path} | {what this file contains / why it matters} | {verified_glob / verified_grep} |
```

---

## Finding Severity Definitions

| Severity | Criteria | Examples |
|---|---|---|
| **HIGH** | Breaking bugs, security vulnerabilities, data loss risks, blockers for the requested feature | Null pointer crash, SQL injection, missing required module |
| **MEDIUM** | Degraded UX, performance issues, maintainability concerns, non-blocking but important | Slow query, missing error handling, duplicated logic |
| **LOW** | Code style, minor improvements, tech debt, nice-to-have | Inconsistent naming, unused imports, missing comments |

---

## Evidence Rules

1. **Every finding MUST include a grep-able command** in the Evidence field
   - GOOD: `grep -n "func handleAuth" src/auth/handler.go`
   - BAD: "The auth handler has issues"
2. **Evidence commands must be copy-pasteable** — anyone should be able to run the command and see the same result
3. **Code snippets in evidence are limited to 5 lines** — use `...` for longer sections and reference the file path
4. **Location must include line numbers** when possible — `file.go:42` not just `file.go`

---

## Reference Verification Rules

The Verified column MUST contain one of:
- `verified_glob` — file existence confirmed via Glob tool
- `verified_grep` — file content confirmed via Grep tool (pattern found)
- `verified_both` — both existence and content confirmed
- `UNVERIFIED` — could not verify (must include reason)

**Every reference in the table must be verified.** Unverified references must be flagged and explained. Do NOT include paths that do not exist in the codebase.

---

## Rules

1. **Maximum 300 lines** — trim LOW findings first, then summarize MEDIUM if still over
2. **Summary section is mandatory** — the PM reads ONLY this section (3-5 lines)
3. **All finding IDs must be unique** — H1, H2, M1, M2, L1, L2, etc. Never reuse an ID
4. **Finding IDs are sequential within severity** — H1 before H2, M1 before M2
5. **Every HIGH finding must map to a plan task** — the planner uses [REF:Hx] tags to ensure coverage
6. **No speculative findings** — if evidence is not found via Grep/Glob, mark as "needs investigation" not as confirmed
7. **Current Architecture section is mandatory** — even for small scale (can be abbreviated)
8. **Recommended Approach section is mandatory** — gives the planner a starting point
9. **References table must have the Verified column** — unverified references are flagged
10. **Do not modify any code** — the researcher only reads and reports
