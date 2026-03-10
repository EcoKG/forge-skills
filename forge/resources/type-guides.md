# Forge Type-Specific Guides

> Each type has unique workflow, agent config, and quality criteria.
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

---

## analysis — Code Analysis

> Report generation without code modification.

### Workflow
Research → Analysis → Report Generation (skip plan/implement/QA)

### Agent Configuration
- **analyst** (sonnet/opus): Code analysis specialist

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

---

## design — Architecture & Design

> Design documents as primary deliverables. Implementation is optional.

### Workflow
Research → Design Document Creation → Design Review → (Optional) Prototype Implementation

### Agent Configuration
- **analyst** (opus): Design analysis + document creation
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
