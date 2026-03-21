---
name: review
description: |
  Code review skill for PR review, quality assessment, and security analysis.
  Analysis-only — reads code and produces structured reports. Makes no code changes.
  Part of the Forge Framework v8.0 ecosystem.
routing:
  triggers:
    - review, 리뷰
    - PR review, pull request review
    - code quality, 코드 품질
    - review this, 이거 리뷰해줘
    - check this code, 코드 검토
    - security review, 보안 리뷰
    - OWASP, vulnerability check
  anti-triggers:
    - write code, implement this
    - fix this, 이거 고쳐줘
    - refactor, 리팩토링해줘
    - add feature, 기능 추가
  modes:
    quick-review: "Fast pass: obvious bugs, style, naming — 5-minute scan"
    deep-review: "Thorough review: logic, architecture, test coverage, edge cases"
    security-review: "Security-focused: OWASP Top 10, auth, injection, secrets"
  priority: normal
  categories:
    - discuss
framework:
  pipeline: review-pipeline
  workspace:
    scope: []
    readonly:
      - "**"
    ignore:
      - node_modules/
      - .git/
      - dist/
      - build/
      - "*.lock"
  quality:
    inherit: false
---

# review — Code Review Skill

> Part of the Forge Framework v8.0 "Nova".
> Pipeline: analyze → assess → report.
> **This skill is read-only. It produces reports and findings. It never modifies files.**

---

## 1. Pipeline Overview

```
analyze   — Read the target files and build a structural understanding
assess    — Apply review checklists per mode, score each dimension
report    — Produce a structured review report with findings and recommendations
```

---

## 2. Mode Behavior

### quick-review
- Scope: files changed in the PR or explicitly named files
- Focus: obvious bugs, naming conventions, dead code, missing error handling
- Time budget: fast scan — flag critical and major issues only
- Output: inline findings + severity summary

### deep-review
- Scope: changed files + their dependencies and callers
- Focus: logic correctness, edge cases, test coverage gaps, architectural alignment, performance
- Produces a full structured report with all severity levels

### security-review
- Scope: changed files, auth/middleware layers, database access, API boundaries
- Focus: OWASP Top 10, injection risks, broken auth, sensitive data exposure,
  insecure deserialization, hardcoded secrets, CSRF, CORS misconfiguration
- All findings are classified by OWASP category
- Critical and High findings must include a remediation example

---

## 3. Step Instructions

### analyze
1. Identify the set of files to review (PR diff, explicit list, or current directory).
2. Read each file in full — do not skip sections.
3. For each file, note: language, purpose, key dependencies, test file (if any).
4. Build a dependency map: which functions call which, what external services are touched.
5. Identify the reviewer's lens for this session (quick / deep / security) and load the
   relevant checklist from Section 4.

### assess
Apply the checklist for the active mode. For each item:
- Mark: PASS / FAIL / WARN / N/A
- If FAIL or WARN: record file, line range, description, and severity.

Severity levels:
| Level | Meaning |
|---|---|
| Critical | Must fix before merge. Security hole, data loss risk, crash. |
| Major | Should fix before merge. Logic error, broken functionality. |
| Minor | Should address soon. Style, naming, maintainability. |
| Suggestion | Optional improvement. No merge blocker. |

### report
Produce `review-report.md` with:
1. **Summary**: files reviewed, total findings by severity, overall recommendation
   (APPROVE / REQUEST CHANGES / APPROVE WITH COMMENTS)
2. **Findings**: grouped by severity, each with file:line, description, recommendation
3. **Checklist Results**: which items passed, failed, or were N/A
4. **Positive Notes**: things done well — always include at least one if warranted

---

## 4. Review Checklists

### quick-review checklist
- [ ] No obvious null / undefined dereferences
- [ ] No unused variables or imports left in
- [ ] Error paths are handled (no silent swallows)
- [ ] Naming is clear and consistent with the codebase
- [ ] No dead code or commented-out blocks left in
- [ ] Console.log / debug prints removed before merge

### deep-review checklist
All quick-review items, plus:
- [ ] Logic matches the stated intent (trace the happy path)
- [ ] Edge cases handled: empty input, nulls, boundary values
- [ ] Async operations: no unhandled rejections, no race conditions
- [ ] Test coverage: new logic has corresponding tests
- [ ] Performance: no O(n²) loops on unbounded data, no blocking calls in hot paths
- [ ] Coupling: changes don't create hidden dependencies
- [ ] API contracts maintained: no breaking changes to public interfaces

### security-review checklist
- [ ] Input validation on all external inputs (query params, body, headers)
- [ ] No SQL / NoSQL / command injection vectors
- [ ] Auth checks present and consistent (no missing middleware)
- [ ] Sensitive data not logged or returned in error messages
- [ ] No hardcoded secrets, tokens, or credentials
- [ ] File uploads restricted by type, size, and destination
- [ ] CORS policy is intentional and not wildcard in production
- [ ] Dependencies: no known critical CVEs in newly added packages
- [ ] Rate limiting present on auth and sensitive endpoints
- [ ] Cryptography: no MD5/SHA1 for passwords, no custom crypto

---

## 5. Rules

- This skill NEVER modifies any file. If a tool call would write to a file, STOP.
- Do not hallucinate findings. If unsure, say "needs verification" in the finding.
- Always cite the exact file and line range for every finding.
- Do not review files outside the declared scope without asking the user first.
