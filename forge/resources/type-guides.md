# Forge Type-Specific Guides

> Each type has unique workflow, agent config, quality criteria, wave strategy, and verification rules.
> The main SKILL.md handles type routing — this file provides type-specific details.

---

## Table of Contents

- [code — Feature Development](#code--feature-development)
- [code (bug) — Bug Fix](#code-bug--bug-fix)
- [code (refactor) — Refactoring](#code-refactor--refactoring)
- [docs — Documentation](#docs--documentation)
- [analysis — Code Analysis](#analysis--code-analysis)
- [analysis (security) — Security Audit](#analysis-security--security-audit)
- [infra — Infrastructure](#infra--infrastructure)
- [design — Architecture & Design](#design--architecture--design)

---

## code — Feature Development

### Workflow
Research → Plan → Implement → Code Review → QA Verification

### Agent Configuration
- **implementer** (sonnet/opus): Code implementation
- **code-reviewer** (opus): Code quality review
- **qa-inspector** (sonnet): Phase-level QA verification

### Core Principles
- **TDD**: Write tests first → implement → refactor
- **SOLID**: Reject on violation
- **DDD**: Respect existing domain boundaries

### Default Overrides
| Option | Value |
|--------|-------|
| --type | code |
| --scale | auto |
| --cost | medium |

### Example Requests
- "Add login functionality"
- "Implement discount coupon feature in payment module"
- "Build chart component for dashboard"

### Wave Strategy

**Typical wave composition:**
- **Wave 1:** Interface definitions, type declarations, shared utilities
- **Wave 2:** Core implementation (business logic, handlers, services)
- **Wave 3:** Integration, wiring, tests, final assembly

**Special rules:**
- Vertical slice preferred when features are independent (each slice in its own wave)
- Shared types/interfaces MUST be in an earlier wave than their consumers
- Test files can be co-located with implementation in the same wave if TDD is used

### Deviation Priorities

| Priority | Deviation | Frequency | Guidance |
|---|---|---|---|
| 1 | R3: Missing types/interfaces | HIGH | Commonly missing shared types — auto-resolve by creating them |
| 2 | R1: Null safety bugs | MEDIUM | New code often misses null checks on existing data |
| 3 | R2: Missing validation | MEDIUM | Input validation frequently omitted on first pass |
| 4 | R4: Schema changes | LOW | New features sometimes need DB changes — always escalate |

### must_haves Example

```yaml
must_haves:
  truths:
    - "Users can create new tasks via POST /api/tasks"
    - "Task list displays all tasks for the authenticated user"
    - "Invalid task data returns 400 with validation errors"
  artifacts:
    - path: src/handlers/task.go
      min_lines: 50
      exports: [CreateTask, ListTasks]
    - path: src/models/task.go
      min_lines: 20
      exports: [Task, TaskInput]
    - path: src/handlers/task_test.go
      min_lines: 30
      exports: [TestCreateTask, TestListTasks]
  key_links:
    - from: src/routes/api.go
      to: src/handlers/task.go
      pattern: "CreateTask|ListTasks"
    - from: src/handlers/task.go
      to: src/models/task.go
      pattern: "Task|TaskInput"
```

### Verification Special Rules
- **Level 2 (Substantive):** Pay extra attention to test files — ensure they have real assertions, not just `t.Skip()` or empty test bodies
- **Level 3 (Wired):** Verify route registration actually maps to handler functions (not just imported)
- TDD compliance: verify test files exist and contain meaningful test cases

---

## code (bug) — Bug Fix

> Lightweight diagnostic cycle. Use when the request is about fixing broken behavior, not adding features.

### Workflow
Diagnostic Research → Lightweight Plan (3-5 tasks) → Fix → Review → Regression Test

### Diagnostic-Focused Research
- Error message / stack trace analysis
- Reproduction path tracing (input → process → output)
- Data flow tracing in related code
- Recent change history review (git log)

### Lightweight Plan
- Task count: 3-5 (vs. 8-20 for general code)
- Phase: 1 (diagnose + fix + verify combined)
- Testing: reproduction test → fix → regression test

### Required Checks
- Bug reproduction confirmed
- Root cause identified
- Fix doesn't affect other features
- Regression tests pass

### Default Overrides
| Option | Value |
|--------|-------|
| --type | code |
| --scale | small |
| --cost | low |

### Example Requests
- "Login button doesn't respond"
- "Data lost when saving file"
- "API returns 500 error intermittently"

### Wave Strategy

**Typical wave composition:**
- **Single wave** (1-3 tasks): Reproduce → Fix → Verify

**Special rules:**
- Bug fixes are almost always single-wave — dependencies are linear (reproduce before fix, fix before verify)
- If the bug spans multiple modules, still keep it single-wave but order tasks by dependency
- Regression test is ALWAYS the last task

### Deviation Priorities

| Priority | Deviation | Frequency | Guidance |
|---|---|---|---|
| 1 | R1: Additional bugs found during investigation | HIGH | Fix only if directly related to the reported bug |
| 2 | R3: Missing test infrastructure | MEDIUM | Auto-add minimal test setup if needed for regression test |
| 3 | R4: Bug root cause is architectural | LOW | Escalate immediately — architectural bugs need design decisions |

### must_haves Example

```yaml
must_haves:
  truths:
    - "Clicking the login button submits the form (previously unresponsive)"
    - "Login with valid credentials succeeds without error"
  artifacts:
    - path: src/components/LoginForm.tsx
      min_lines: 10
      exports: [LoginForm]
    - path: src/components/__tests__/LoginForm.test.tsx
      min_lines: 15
      exports: [TestLoginButton]
  key_links:
    - from: src/components/LoginForm.tsx
      to: src/api/auth.ts
      pattern: "login|authenticate"
```

### Verification Special Rules
- **Level 2 (Substantive):** Verify the fix addresses the ROOT CAUSE, not just a symptom (check for band-aid patterns like try/catch swallowing errors)
- **Level 3 (Wired):** Verify the regression test actually exercises the bug's reproduction path
- Ensure regression test would FAIL without the fix (proves the test is meaningful)

---

## code (refactor) — Refactoring

> Improves code structure while preserving existing behavior. Strict regression verification.

### Workflow
Research → Plan → **Run Existing Tests (baseline)** → Implement → **Regression Test** → Review → QA

### Core Principle: Behavior-Preserving
- Guarantee **identical input/output** before and after refactoring
- All existing tests must pass
- New tests: verify pass **before** refactoring, then verify pass **after**

### Regression Testing
1. **Before**: Run full test suite → record baseline
2. **After**: Run same tests → compare against baseline
3. **Delta**: Immediate rollback if any test fails

### Review Focus
- SOLID compliance (SRP especially important)
- Behavior change detection (reject if feature additions mixed in)
- Test coverage maintained/improved

### Default Overrides
| Option | Value |
|--------|-------|
| --type | code |
| --scale | auto |
| --cost | medium |

### Example Requests
- "Split this class following SRP"
- "Break down God Object into separate services"
- "Convert callback pattern to async/await"

### Wave Strategy

**Typical wave composition:**
- **Wave 1:** Add/strengthen tests for existing behavior (baseline establishment)
- **Wave 2:** Perform the structural refactoring
- **Wave 3:** Update references, clean up imports, verify regression

**Special rules:**
- Tests MUST be in Wave 1 — the baseline must be established before any structural changes
- The refactoring wave must NOT add new features — behavior-preserving only
- If refactoring breaks tests, it's a REJECT, not a revision

### Deviation Priorities

| Priority | Deviation | Frequency | Guidance |
|---|---|---|---|
| 1 | R1: Existing bugs exposed by refactoring | HIGH | Document but do NOT fix — refactoring must be behavior-preserving |
| 2 | R3: Missing test coverage for refactored code | HIGH | Add tests in Wave 1 before refactoring |
| 3 | R2: Temptation to add features during refactoring | MEDIUM | NEVER add features — record as separate task proposal |
| 4 | R4: Refactoring requires module restructure | LOW | Escalate — module boundaries are architectural decisions |

### must_haves Example

```yaml
must_haves:
  truths:
    - "All existing tests pass after refactoring (zero regression)"
    - "API surface is unchanged (same public methods, same signatures)"
  artifacts:
    - path: src/services/order-service.ts
      min_lines: 40
      exports: [OrderService]
    - path: src/services/payment-service.ts
      min_lines: 30
      exports: [PaymentService]
    - path: src/services/__tests__/order-service.test.ts
      min_lines: 50
      exports: [TestOrderService]
  key_links:
    - from: src/controllers/order.ts
      to: src/services/order-service.ts
      pattern: "OrderService"
    - from: src/services/order-service.ts
      to: src/services/payment-service.ts
      pattern: "PaymentService"
```

### Verification Special Rules
- **Level 2 (Substantive):** Verify that refactored code is ACTUALLY restructured, not just renamed. Check for real SRP improvements.
- **Level 3 (Wired):** Verify ALL callers of refactored modules have been updated — partial migration is worse than no migration
- Run the full test suite and compare pass/fail counts against the baseline recorded in Wave 1

---

## docs — Documentation

> Lightweight workflow without plan/QA phases.

### Workflow
Research → Write Documentation → Documentation Review (skip plan/checkpoint/QA)

### Agent Configuration
- **implementer** (sonnet): Documentation writing
- **doc-reviewer** (haiku): Documentation quality review

### Documentation Quality Criteria
- **Accuracy**: Does it match the code?
- **Completeness**: Are required sections present?
- **Clarity**: Can the target audience understand it?
- **Consistency**: Does it match existing doc style?
- **Examples**: Are code examples included?

### Default Overrides
| Option | Value |
|--------|-------|
| --type | docs |
| --scale | small |
| --cost | low |

### Example Requests
- "Document all API endpoints"
- "Write project README"
- "Add JSDoc to all service classes"

### Wave Strategy

**Typical wave composition:**
- **Single wave:** All documentation tasks run in parallel (docs rarely have inter-dependencies)

**Special rules:**
- If documenting APIs, read the actual API code first (research phase handles this)
- No plan/QA phases — doc-reviewer handles quality
- Multiple doc tasks can run in parallel since they modify different files

### Deviation Priorities

| Priority | Deviation | Frequency | Guidance |
|---|---|---|---|
| 1 | R1: Incorrect existing docs found | MEDIUM | Fix only the documents in scope |
| 2 | R3: Missing code examples to reference | MEDIUM | Create minimal working examples |
| 3 | R2: Undocumented APIs discovered | LOW | Document only what's in scope, note the rest |

### must_haves Example

```yaml
must_haves:
  truths:
    - "README includes setup instructions that work on a clean checkout"
    - "All public API endpoints are documented with request/response examples"
  artifacts:
    - path: docs/api-reference.md
      min_lines: 100
      exports: []
    - path: README.md
      min_lines: 50
      exports: []
  key_links: []
```

### Verification Special Rules
- **Level 2 (Substantive):** Verify code examples actually compile/run — copy-paste and execute if possible
- No Level 3 (Wired) for docs type — key_links are typically empty
- Check that all file paths mentioned in documentation actually exist

---

## analysis — Code Analysis

> Report generation without code modification.

### Workflow
Research → Analysis → Report Generation (skip plan/implement/QA)

### Agent Configuration
- **researcher** (sonnet/opus): Code analysis specialist

### Analysis Dimensions
- **Code Quality**: SOLID compliance, complexity, duplication
- **Architecture**: Layer separation, dependency direction, circular references
- **Technical Debt**: Hardcoding, magic numbers, unused code
- **Testing**: Coverage, test quality, missing edge cases

### Report Format
- Findings: Classified by HIGH/MEDIUM/LOW severity
- Each finding: Location + Description + Impact + Recommended Action
- Summary: Overall health score + priority improvement items

### Default Overrides
| Option | Value |
|--------|-------|
| --type | analysis |
| --scale | auto |
| --cost | medium |

### Example Requests
- "Analyze code quality of this module"
- "Create architecture evaluation report"
- "Assess technical debt status"

### Wave Strategy

**Typical wave composition:**
- **Not applicable** — analysis type does not use waves (no implementation phase)

**Special rules:**
- Parallel researchers may explore different dimensions simultaneously
- Synthesis step combines parallel findings into a single report

### Deviation Priorities

| Priority | Deviation | Frequency | Guidance |
|---|---|---|---|
| 1 | R3: Cannot access referenced files/modules | MEDIUM | Note as "unable to verify" in report |
| 2 | R4: Findings suggest architectural issues beyond analysis scope | MEDIUM | Document findings but do not prescribe architectural changes |

### must_haves Example

```yaml
must_haves:
  truths:
    - "Report covers all modules in src/ directory"
    - "Each HIGH finding includes reproduction evidence"
  artifacts:
    - path: .forge/{date}/{slug}/research.md
      min_lines: 100
      exports: []
  key_links: []
```

### Verification Special Rules
- **Level 2 (Substantive):** Verify that all HIGH findings have concrete evidence (file:line references, grep commands)
- No Level 3 (Wired) — analysis produces reports, not code connections
- Verify that file references in the report actually exist

---

## analysis (security) — Security Audit

> OWASP Top 10 based vulnerability analysis. Uses opus by default for thoroughness.

### Workflow
Security Research → OWASP Checklist Analysis → Security Report

### OWASP Top 10 Checklist
1. **Injection**: SQL, NoSQL, OS, LDAP injection
2. **Broken Authentication**: Session management, password policy
3. **Sensitive Data Exposure**: Encryption, transport security
4. **XML External Entities (XXE)**
5. **Broken Access Control**: Privilege escalation, IDOR
6. **Security Misconfiguration**: Default settings, error messages
7. **XSS**: Reflected, Stored, DOM-based
8. **Insecure Deserialization**
9. **Using Components with Known Vulnerabilities**
10. **Insufficient Logging & Monitoring**

### Report Format
- Severity: CRITICAL / HIGH / MEDIUM / LOW / INFO
- Each finding: CWE ID + Location + Description + Reproduction + Recommended Fix
- Summary: Overall security score + items requiring immediate action

### Default Overrides
| Option | Value |
|--------|-------|
| --type | analysis |
| --scale | auto |
| --cost | high |

### Example Requests
- "Security audit this API"
- "Check authentication logic for vulnerabilities"
- "OWASP Top 10 assessment"

### Wave Strategy

**Typical wave composition:**
- **Not applicable** — security analysis does not use waves (no implementation phase)

**Special rules:**
- Parallel researchers may focus on different OWASP categories simultaneously
- Authentication/authorization findings take priority over other categories

### Deviation Priorities

| Priority | Deviation | Frequency | Guidance |
|---|---|---|---|
| 1 | R1: Critical vulnerability found during audit | HIGH | Document with CRITICAL severity — do not attempt to fix |
| 2 | R3: Cannot access security-sensitive files | MEDIUM | Note as "access restricted — manual review required" |

### must_haves Example

```yaml
must_haves:
  truths:
    - "All OWASP Top 10 categories have been evaluated"
    - "Each CRITICAL/HIGH finding includes CWE ID and reproduction steps"
  artifacts:
    - path: .forge/{date}/{slug}/research.md
      min_lines: 150
      exports: []
  key_links: []
```

### Verification Special Rules
- **Level 2 (Substantive):** Verify every CRITICAL/HIGH finding has a CWE ID and concrete reproduction steps
- Verify that no false positives are included (each finding must have evidence)
- Check that the report covers all 10 OWASP categories (even if finding is "No issues found")

---

## infra — Infrastructure

> Deployment and CI/CD with dry-run verification and approval gates.

### Workflow
Research → Plan (including rollback) → Dry-run → Approval Gate → Execute

### Safety Rules
- **Production changes require explicit user approval before execution**
- Show dry-run results first and request confirmation
- Rollback plan mandatory in plan.md
- Verify environment-specific config separation (dev/staging/prod)

### Agent Configuration
- **implementer** (sonnet): Infrastructure code writing
- Code review: includes security perspective

### Checklist
- Environment-specific config separation verified
- No hardcoded secrets/credentials
- Rollback procedure documented
- Dry-run successful
- Monitoring/alerting included

### Default Overrides
| Option | Value |
|--------|-------|
| --type | infra |
| --scale | auto |
| --cost | medium |

### Example Requests
- "Build GitHub Actions CI/CD pipeline"
- "Set up Docker multi-stage build"
- "Configure Nginx reverse proxy"

### Wave Strategy

**Typical wave composition:**
- **Wave 1:** Configuration files, environment setup, dry-run preparation
- **Wave 2:** Actual infrastructure implementation (after dry-run approval)

**Special rules:**
- Wave 1 MUST include dry-run — never apply changes without dry-run verification
- Wave 2 only proceeds after user approval of dry-run results
- Rollback plan must be written in Wave 1 before any execution

### Deviation Priorities

| Priority | Deviation | Frequency | Guidance |
|---|---|---|---|
| 1 | R4: Infrastructure changes affect production | HIGH | ALWAYS escalate — never auto-apply to production |
| 2 | R3: Missing environment variables or secrets | HIGH | Auto-add placeholder configs, flag for manual secret injection |
| 3 | R2: Missing monitoring/alerting | MEDIUM | Auto-add basic health checks |
| 4 | R1: Config syntax errors | MEDIUM | Auto-fix and validate with dry-run |

### must_haves Example

```yaml
must_haves:
  truths:
    - "CI pipeline runs on push to main and pull requests"
    - "Docker build completes successfully"
    - "Rollback can be executed with a single command"
  artifacts:
    - path: .github/workflows/ci.yml
      min_lines: 30
      exports: []
    - path: Dockerfile
      min_lines: 15
      exports: []
    - path: docs/rollback-procedure.md
      min_lines: 10
      exports: []
  key_links:
    - from: .github/workflows/ci.yml
      to: Dockerfile
      pattern: "docker build|docker-compose"
```

### Verification Special Rules
- **Level 2 (Substantive):** Verify configuration files have NO hardcoded secrets (scan for patterns like `password=`, `secret=`, `token=`)
- **Level 3 (Wired):** Verify CI/CD pipeline references correct file paths and commands
- Dry-run results must be captured and included in the verification report

---

## design — Architecture & Design

> Design documents as primary deliverables. Implementation is optional.

### Workflow
Research → Design Document Creation → Design Review → (Optional) Prototype Implementation

### Agent Configuration
- **researcher** (opus): Design analysis + document creation
- Add implementer if implementation needed

### Design Document Structure
1. **Context**: Background, constraints, non-functional requirements
2. **Options**: Alternative comparison (minimum 2)
3. **Decision**: Chosen design + rationale
4. **Detail**: Detailed design (diagrams, schema, API spec)
5. **Trade-offs**: Pros/cons, future extensibility considerations

### Design Principles
- ADR (Architecture Decision Record) format compliance
- Quantitative criteria in alternative comparisons
- Non-functional requirements (performance, scalability, security) explicit
- Implementation feasibility verification (tech stack compatibility)

### Default Overrides
| Option | Value |
|--------|-------|
| --type | design |
| --scale | auto |
| --cost | high |

### Example Requests
- "Design payment system architecture"
- "Design user database schema"
- "Design REST API interface"

### Wave Strategy

**Typical wave composition:**
- **Not applicable for design-only** — no implementation waves
- **If prototype requested:** Wave 1 = core design doc, Wave 2 = prototype implementation

**Special rules:**
- Design documents are the primary deliverable, not code
- If prototype is requested, it should be minimal and prove the design's feasibility
- Alternative comparison must be completed before any implementation begins

### Deviation Priorities

| Priority | Deviation | Frequency | Guidance |
|---|---|---|---|
| 1 | R4: Design reveals need for architectural changes beyond scope | HIGH | Document as a finding, escalate to user |
| 2 | R3: Insufficient information to compare alternatives | MEDIUM | Note assumptions explicitly, request user input |

### must_haves Example

```yaml
must_haves:
  truths:
    - "Design document includes at least 2 alternative comparisons"
    - "Chosen design has explicit rationale with quantitative criteria"
    - "Non-functional requirements are specified with measurable targets"
  artifacts:
    - path: docs/design-{feature}.md
      min_lines: 100
      exports: []
  key_links: []
```

### Verification Special Rules
- **Level 2 (Substantive):** Verify the design document has real content in all 5 sections (Context, Options, Decision, Detail, Trade-offs) — not placeholder headings
- No Level 3 (Wired) unless prototype was implemented
- Verify that alternative comparisons include quantitative criteria, not just subjective opinions
