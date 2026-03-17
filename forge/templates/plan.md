# Plan Document Template (v6.0)

Use this structure when writing plan.md for an artifact.
The planner agent MUST follow this template exactly.

---

## Template

```markdown
---
type: {code|code-bug|code-refactor|docs|analysis|analysis-security|infra|design}
scale: {small|medium|large}
paradigm: {oop|fp|script|ddd|mixed}
language: {detected language}
# Project mode fields (optional — present only when executing a roadmap phase)
# Omit entirely in task mode.
phase_ref:
  phase_number: {N}
  phase_name: "{name from roadmap}"
  milestone: {N}
  success_criteria_seed:
    - "{criteria from roadmap.md → mapped to must_haves.truths}"
phases: {N}
total_tasks: {N}
waves: {N}
must_haves:
  truths:
    - "{observable user behavior 1}"
    - "{observable user behavior 2}"
  artifacts:
    - path: "{file_path}"
      min_lines: {N}
      exports: [{name1}, {name2}]
    - path: "{file_path}"
      min_lines: {N}
      exports: [{name1}]
  key_links:
    - from: "{file_path}"
      to: "{file_path}"
      pattern: "{regex_pattern}"
    - from: "{file_path}"
      to: "{file_path}"
      pattern: "{regex_pattern}"
---

# Implementation Plan: {title}

## Overview
{1-2 sentence summary of what will be built and why}

## Phase 1: {phase_name}

### Goal
{what this phase achieves — observable outcome}

### Completion Criteria
- {observable behavior 1}
- {observable behavior 2}

### Tasks

<task id="1-1" wave="1" depends_on="">
  <name>{task name — starts with concrete verb}</name>
  <files>{files to create or modify}</files>
  <read_first>{files to read before modifying — must exist}</read_first>
  <action>
    {specific, concrete implementation instructions}
    {with actual values, not "align X with Y"}
    {numbered steps preferred}
  </action>
  <verify>{command to verify completion — grep, build, test}</verify>
  <acceptance_criteria>
    - {grep-verifiable condition 1}
    - {build/test command that must pass}
  </acceptance_criteria>
  <ref>H1, M2</ref>
  <done>false</done>
</task>

<task id="1-2" wave="1" depends_on="">
  <name>{task name}</name>
  <files>{files}</files>
  <read_first>{files}</read_first>
  <action>
    {concrete steps}
  </action>
  <verify>{command}</verify>
  <acceptance_criteria>
    - {condition}
  </acceptance_criteria>
  <ref>H2</ref>
  <done>false</done>
</task>

<task id="1-3" wave="2" depends_on="1-1,1-2">
  <name>{task name}</name>
  <files>{files}</files>
  <read_first>{files}</read_first>
  <action>
    {concrete steps}
  </action>
  <verify>{command}</verify>
  <acceptance_criteria>
    - {condition}
  </acceptance_criteria>
  <ref>M1</ref>
  <done>false</done>
</task>

<!-- Phase 2+ tasks follow same structure with id="2-1", etc. -->

## Design Patterns
- {pattern}: applied to {component} because {reason} [REF:Hx]

## Risk & Mitigation
| Risk | Impact | Mitigation |
|---|---|---|
| {risk description} | {H/M/L} | {specific mitigation action} |
```

---

## Example 1: Small Scale (3 tasks, 1 wave)

```markdown
---
type: code-bug
scale: small
paradigm: oop
language: typescript
phases: 1
total_tasks: 3
waves: 1
must_haves:
  truths:
    - "Login form shows validation error when email is empty"
    - "Login form shows validation error when password is shorter than 8 chars"
  artifacts:
    - path: src/components/LoginForm.tsx
      min_lines: 40
      exports: [LoginForm]
    - path: src/utils/validation.ts
      min_lines: 15
      exports: [validateEmail, validatePassword]
    - path: src/components/__tests__/LoginForm.test.tsx
      min_lines: 20
      exports: []
  key_links:
    - from: src/components/LoginForm.tsx
      to: src/utils/validation.ts
      pattern: "validateEmail|validatePassword"
---

# Implementation Plan: Fix Login Form Validation

## Overview
The login form currently submits without validating user input, causing server-side 422 errors. This plan adds client-side validation for email and password fields.

## Phase 1: Add Client-Side Validation

### Goal
Login form validates email format and password length before submission.

### Completion Criteria
- Empty email shows "Email is required" error
- Invalid email format shows "Invalid email format" error
- Password under 8 characters shows "Password must be at least 8 characters" error

### Tasks

<task id="1-1" wave="1" depends_on="">
  <name>Create validation utility functions</name>
  <files>src/utils/validation.ts</files>
  <read_first>src/components/LoginForm.tsx, src/utils/</read_first>
  <action>
    1. Create src/utils/validation.ts
    2. Export validateEmail(email: string): string | null
       - Return "Email is required" if email is empty string
       - Return "Invalid email format" if email does not match /^[^\s@]+@[^\s@]+\.[^\s@]+$/
       - Return null if valid
    3. Export validatePassword(password: string): string | null
       - Return "Password must be at least 8 characters" if password.length < 8
       - Return null if valid
  </action>
  <verify>grep -n "validateEmail\|validatePassword" src/utils/validation.ts</verify>
  <acceptance_criteria>
    - `grep "export function validateEmail" src/utils/validation.ts` returns match
    - `grep "export function validatePassword" src/utils/validation.ts` returns match
    - `npx tsc --noEmit` succeeds
  </acceptance_criteria>
  <ref>H1</ref>
  <done>false</done>
</task>

<task id="1-2" wave="1" depends_on="">
  <name>Integrate validation into LoginForm component</name>
  <files>src/components/LoginForm.tsx</files>
  <read_first>src/components/LoginForm.tsx, src/utils/validation.ts</read_first>
  <action>
    1. Import validateEmail, validatePassword from ../utils/validation
    2. Add state: const [errors, setErrors] = useState<Record<string, string>>({})
    3. In handleSubmit, before fetch call:
       - const emailError = validateEmail(email)
       - const passwordError = validatePassword(password)
       - If either is non-null, setErrors and return early (do not submit)
    4. Display error messages below each input field:
       - {errors.email && <p className="error">{errors.email}</p>}
       - {errors.password && <p className="error">{errors.password}</p>}
    5. Clear errors on input change via onChange handler
  </action>
  <verify>grep -n "validateEmail\|validatePassword" src/components/LoginForm.tsx</verify>
  <acceptance_criteria>
    - `grep "validateEmail" src/components/LoginForm.tsx` returns match
    - `grep "validatePassword" src/components/LoginForm.tsx` returns match
    - `grep "errors" src/components/LoginForm.tsx` returns match
    - `npx tsc --noEmit` succeeds
  </acceptance_criteria>
  <ref>H1</ref>
  <done>false</done>
</task>

<task id="1-3" wave="1" depends_on="">
  <name>Write tests for validation logic and form behavior</name>
  <files>src/components/__tests__/LoginForm.test.tsx</files>
  <read_first>src/utils/validation.ts, src/components/LoginForm.tsx</read_first>
  <action>
    1. Create test file src/components/__tests__/LoginForm.test.tsx
    2. Test validateEmail:
       - Returns error for empty string
       - Returns error for "notanemail"
       - Returns null for "user@example.com"
    3. Test validatePassword:
       - Returns error for "short"
       - Returns null for "longpassword"
    4. Test LoginForm integration:
       - Renders without crashing
       - Shows email error when submitting empty form
       - Shows password error when password is too short
  </action>
  <verify>npx jest src/components/__tests__/LoginForm.test.tsx --passWithNoTests</verify>
  <acceptance_criteria>
    - `npx jest src/components/__tests__/LoginForm.test.tsx` passes
    - `grep "validateEmail" src/components/__tests__/LoginForm.test.tsx` returns match
  </acceptance_criteria>
  <ref>H1</ref>
  <done>false</done>
</task>

## Design Patterns
- Validation Extraction: validation logic separated from UI component for testability and reuse [REF:H1]

## Risk & Mitigation
| Risk | Impact | Mitigation |
|---|---|---|
| Existing server-side validation may conflict | L | Client-side is additive; server validation remains as fallback |
```

---

## Example 2: Medium Scale (8 tasks, 3 waves)

```markdown
---
type: code
scale: medium
paradigm: oop
language: go
phases: 1
total_tasks: 8
waves: 3
must_haves:
  truths:
    - "Authenticated users can access GET /api/protected and receive 200"
    - "Unauthenticated requests to /api/protected receive 401 with {\"error\": \"invalid_token\"}"
    - "Expired tokens are rejected with 401"
    - "Token refresh endpoint issues a new valid token"
  artifacts:
    - path: src/auth/middleware.go
      min_lines: 40
      exports: [ValidateToken]
    - path: src/auth/jwt.go
      min_lines: 30
      exports: [ParseToken, ValidateClaims, GenerateToken]
    - path: src/auth/jwt_test.go
      min_lines: 50
      exports: []
    - path: src/routes/api.go
      min_lines: 20
      exports: [RegisterAPIRoutes]
    - path: src/auth/refresh.go
      min_lines: 25
      exports: [RefreshHandler]
  key_links:
    - from: src/routes/api.go
      to: src/auth/middleware.go
      pattern: "ValidateToken"
    - from: src/auth/middleware.go
      to: src/auth/jwt.go
      pattern: "ParseToken|ValidateClaims"
    - from: src/auth/refresh.go
      to: src/auth/jwt.go
      pattern: "GenerateToken|ValidateClaims"
---

# Implementation Plan: JWT Authentication Middleware

## Overview
Add JWT-based authentication middleware to protect API endpoints. Includes token parsing, validation, refresh, and integration with the existing router.

## Phase 1: JWT Authentication System

### Goal
API endpoints behind /api/ require a valid JWT Bearer token. Expired or invalid tokens return 401.

### Completion Criteria
- `go build ./...` succeeds
- `go test ./src/auth/...` passes
- Middleware is wired into the router for /api/ routes

### Tasks

<task id="1-1" wave="1" depends_on="">
  <name>Create JWT parsing and validation module</name>
  <files>src/auth/jwt.go</files>
  <read_first>src/config/auth.go, go.mod</read_first>
  <action>
    1. Create src/auth/jwt.go
    2. Import "github.com/golang-jwt/jwt/v5"
    3. Define Claims struct embedding jwt.RegisteredClaims with UserID string and Role string
    4. Implement ParseToken(tokenString string, publicKey *rsa.PublicKey) (*Claims, error):
       - Parse token with jwt.ParseWithClaims using RS256
       - Return parsed claims or wrapped error
    5. Implement ValidateClaims(claims *Claims) error:
       - Check claims.ExpiresAt is not nil and is after time.Now()
       - Return ErrTokenExpired if expired
       - Return nil if valid
    6. Implement GenerateToken(userID string, role string, privateKey *rsa.PrivateKey, ttl time.Duration) (string, error):
       - Create claims with given UserID, Role, and ExpiresAt = time.Now().Add(ttl)
       - Sign with RS256 and return token string
    7. Define package-level errors: ErrTokenExpired, ErrTokenInvalid
  </action>
  <verify>grep -n "func ParseToken\|func ValidateClaims\|func GenerateToken" src/auth/jwt.go</verify>
  <acceptance_criteria>
    - `grep "func ParseToken" src/auth/jwt.go` returns match
    - `grep "func ValidateClaims" src/auth/jwt.go` returns match
    - `grep "func GenerateToken" src/auth/jwt.go` returns match
    - `grep "RS256\|SigningMethodRS256" src/auth/jwt.go` returns match
    - `go build ./src/auth/...` succeeds
  </acceptance_criteria>
  <ref>H1, H2</ref>
  <done>false</done>
</task>

<task id="1-2" wave="1" depends_on="">
  <name>Write unit tests for JWT module</name>
  <files>src/auth/jwt_test.go</files>
  <read_first>src/auth/jwt.go</read_first>
  <action>
    1. Create src/auth/jwt_test.go
    2. Generate test RSA key pair in TestMain or helper function
    3. Test ParseToken:
       - Valid token returns correct claims
       - Tampered token returns error
       - Wrong algorithm (HS256) token returns error
    4. Test ValidateClaims:
       - Valid non-expired claims return nil
       - Expired claims return ErrTokenExpired
    5. Test GenerateToken:
       - Generated token can be parsed back with ParseToken
       - Claims in parsed token match input
    6. Test roundtrip: GenerateToken -> ParseToken -> ValidateClaims
  </action>
  <verify>go test ./src/auth/ -run TestParseToken -v</verify>
  <acceptance_criteria>
    - `go test ./src/auth/...` passes
    - `grep "func TestParseToken" src/auth/jwt_test.go` returns match
    - `grep "func TestValidateClaims" src/auth/jwt_test.go` returns match
    - `grep "func TestGenerateToken" src/auth/jwt_test.go` returns match
  </acceptance_criteria>
  <ref>H1</ref>
  <done>false</done>
</task>

<task id="1-3" wave="1" depends_on="">
  <name>Create authentication middleware</name>
  <files>src/auth/middleware.go</files>
  <read_first>src/config/auth.go, src/auth/jwt.go</read_first>
  <action>
    1. Create src/auth/middleware.go
    2. Implement ValidateToken(publicKey *rsa.PublicKey) func(http.Handler) http.Handler:
       - Extract Authorization header
       - Check "Bearer " prefix, return 401 if missing
       - Call ParseToken with token string
       - Call ValidateClaims with parsed claims
       - On any error: respond with 401 and {"error": "invalid_token"} JSON body
       - On success: inject claims into request context via context.WithValue(ctx, "claims", claims)
       - Call next.ServeHTTP(w, r.WithContext(ctx))
  </action>
  <verify>grep -n "func ValidateToken" src/auth/middleware.go</verify>
  <acceptance_criteria>
    - `grep "func ValidateToken" src/auth/middleware.go` returns match
    - `grep "invalid_token" src/auth/middleware.go` returns match
    - `grep "context.WithValue" src/auth/middleware.go` returns match
    - `go build ./src/auth/...` succeeds
  </acceptance_criteria>
  <ref>H1, H3</ref>
  <done>false</done>
</task>

<task id="1-4" wave="2" depends_on="1-1">
  <name>Create token refresh handler</name>
  <files>src/auth/refresh.go</files>
  <read_first>src/auth/jwt.go, src/config/auth.go</read_first>
  <action>
    1. Create src/auth/refresh.go
    2. Implement RefreshHandler(privateKey *rsa.PrivateKey, publicKey *rsa.PublicKey, ttl time.Duration) http.HandlerFunc:
       - Extract Bearer token from Authorization header
       - Parse and validate existing token (allow expired within 7-day grace period)
       - Generate new token with same UserID and Role using GenerateToken
       - Respond with 200 and {"token": "new_token_string"} JSON body
       - On invalid token: respond with 401 and {"error": "invalid_token"}
  </action>
  <verify>grep -n "func RefreshHandler" src/auth/refresh.go</verify>
  <acceptance_criteria>
    - `grep "func RefreshHandler" src/auth/refresh.go` returns match
    - `grep "GenerateToken" src/auth/refresh.go` returns match
    - `go build ./src/auth/...` succeeds
  </acceptance_criteria>
  <ref>M1</ref>
  <done>false</done>
</task>

<task id="1-5" wave="2" depends_on="1-2">
  <name>Write tests for middleware and refresh handler</name>
  <files>src/auth/middleware_test.go, src/auth/refresh_test.go</files>
  <read_first>src/auth/middleware.go, src/auth/refresh.go, src/auth/jwt_test.go</read_first>
  <action>
    1. Create src/auth/middleware_test.go:
       - Test valid token passes through, claims in context
       - Test missing Authorization header returns 401
       - Test invalid token returns 401 with {"error": "invalid_token"}
       - Test expired token returns 401
    2. Create src/auth/refresh_test.go:
       - Test valid refresh returns new token
       - Test expired (within grace) refresh returns new token
       - Test invalid token refresh returns 401
  </action>
  <verify>go test ./src/auth/ -v</verify>
  <acceptance_criteria>
    - `go test ./src/auth/...` passes
    - `grep "func TestValidateToken" src/auth/middleware_test.go` returns match
    - `grep "func TestRefreshHandler" src/auth/refresh_test.go` returns match
  </acceptance_criteria>
  <ref>H1, M1</ref>
  <done>false</done>
</task>

<task id="1-6" wave="2" depends_on="1-3">
  <name>Wire middleware into API router</name>
  <files>src/routes/api.go</files>
  <read_first>src/routes/api.go, src/auth/middleware.go, src/config/auth.go</read_first>
  <action>
    1. Open src/routes/api.go
    2. Import "project/src/auth"
    3. In RegisterAPIRoutes function:
       - Load public key from config: pubKey := config.GetAuthPublicKey()
       - Create middleware: authMiddleware := auth.ValidateToken(pubKey)
       - Wrap all /api/ route handlers with authMiddleware
       - Add POST /api/auth/refresh route using auth.RefreshHandler(privKey, pubKey, 24*time.Hour)
  </action>
  <verify>grep -n "ValidateToken\|RefreshHandler" src/routes/api.go</verify>
  <acceptance_criteria>
    - `grep "ValidateToken" src/routes/api.go` returns match
    - `grep "RefreshHandler" src/routes/api.go` returns match
    - `go build ./...` succeeds
  </acceptance_criteria>
  <ref>H1, H3, M1</ref>
  <done>false</done>
</task>

<task id="1-7" wave="3" depends_on="1-4,1-5,1-6">
  <name>Write integration tests for auth flow</name>
  <files>src/auth/integration_test.go</files>
  <read_first>src/routes/api.go, src/auth/middleware.go, src/auth/refresh.go</read_first>
  <action>
    1. Create src/auth/integration_test.go with build tag "integration"
    2. Test full flow:
       - Generate token for test user
       - Request GET /api/protected with valid token -> expect 200
       - Request GET /api/protected without token -> expect 401
       - Request GET /api/protected with expired token -> expect 401
       - Request POST /api/auth/refresh with valid token -> expect 200 with new token
       - Use new token to access /api/protected -> expect 200
  </action>
  <verify>go test ./src/auth/ -tags=integration -run TestIntegration -v</verify>
  <acceptance_criteria>
    - `go test ./src/auth/ -tags=integration` passes
    - `grep "func TestIntegration" src/auth/integration_test.go` returns match
  </acceptance_criteria>
  <ref>H1, H2, H3, M1</ref>
  <done>false</done>
</task>

<task id="1-8" wave="3" depends_on="1-6">
  <name>Update API documentation with auth requirements</name>
  <files>docs/api.md</files>
  <read_first>docs/api.md, src/auth/middleware.go</read_first>
  <action>
    1. Open docs/api.md
    2. Add "Authentication" section after introduction:
       - All /api/ endpoints require Bearer token in Authorization header
       - Token format: JWT signed with RS256
       - Error response: 401 with {"error": "invalid_token"}
    3. Add POST /api/auth/refresh endpoint documentation:
       - Request: Authorization: Bearer {expired_or_valid_token}
       - Response: 200 {"token": "new_jwt_token"}
       - Error: 401 {"error": "invalid_token"}
    4. Add authentication requirement note to each existing /api/ endpoint
  </action>
  <verify>grep -n "Authentication\|Bearer" docs/api.md</verify>
  <acceptance_criteria>
    - `grep "Authentication" docs/api.md` returns match
    - `grep "Bearer" docs/api.md` returns match
    - `grep "/api/auth/refresh" docs/api.md` returns match
  </acceptance_criteria>
  <ref>M2</ref>
  <done>false</done>
</task>

## Design Patterns
- Middleware Pattern: ValidateToken returns a chainable http middleware for clean separation of auth from business logic [REF:H1]
- Strategy Pattern: JWT signing algorithm (RS256) is configured, not hardcoded, allowing future algorithm changes [REF:H2]

## Risk & Mitigation
| Risk | Impact | Mitigation |
|---|---|---|
| RSA key loading fails at startup | H | ValidateToken returns clear error; config validates keys at init |
| Token refresh grace period too long | M | Grace period is configurable; default 7 days matches industry standard |
| Middleware wrapping breaks existing routes | M | Integration tests verify both auth and non-auth paths |
```

---

## YAML Frontmatter Rules

### must_haves.truths
- Each truth MUST be an observable user behavior (not implementation detail)
- BAD: "JWT tokens use RS256 algorithm" (implementation detail)
- GOOD: "Unauthenticated requests to /api/protected receive 401"
- Each truth should be testable via an HTTP request, CLI command, or UI interaction

### must_haves.artifacts
- `path`: exact file path relative to project root
- `min_lines`: minimum expected lines (prevents empty/stub files)
- `exports`: list of exported functions/classes/constants that MUST exist in the file

### must_haves.key_links
- `from` file MUST import/use something from `to` file
- `pattern`: regex that MUST match when grepping `from` file
- Verifier checks: `grep -E "{pattern}" {from}` returns at least one match
- If import exists but pattern does not match in function bodies, verification FAILS (import-only is not enough)

---

## XML Task Structure Rules

### Required Fields (every task)
- `id`: format "{phase}-{sequence}" (e.g., "1-3")
- `wave`: integer, determines parallel execution order
- `depends_on`: comma-separated task IDs, or empty string for no dependencies
- `name`: starts with a concrete verb (Create, Implement, Write, Add, Configure, Wire, Update)
- `files`: files this task will create or modify
- `read_first`: files to read before modifying (MUST exist — verified by Glob)
- `action`: numbered steps with specific values (no "align", "update accordingly", "as needed")
- `verify`: single command to run after completion
- `acceptance_criteria`: list of machine-verifiable conditions (grep, build, test commands)
- `ref`: comma-separated research finding IDs (H1, M2, etc.)
- `done`: "false" initially, changed to "true" when completed

### Wave Assignment
- Tasks with no dependencies: wave 1
- Tasks depending only on wave N tasks: wave N+1
- Tasks depending on multiple waves: max(dependency waves) + 1
- Tasks modifying the same file MUST NOT be in the same wave

---

## Scale-Based Rules

| Scale | Min Tasks | Max Tasks | Max Phases | Max Waves |
|---|---|---|---|---|
| small | 2 | 5 | 1 | 2 |
| medium | 6 | 15 | 1-2 | 5 |
| large | 16 | 50 | 2-5 | 10 |

- **Per wave:** 1-5 tasks recommended (6+ triggers scope warning)
- **Per phase:** 3-10 tasks (avoid oversized phases)

---

## Quality Rules

1. **All HIGH findings from research MUST have corresponding tasks** — no HIGH finding can be left unaddressed
2. **Every task MUST have read_first, action, verify, acceptance_criteria** — no field can be empty or omitted
3. **No vague actions** — the following phrases are BANNED in `<action>`:
   - "align X with Y"
   - "update accordingly"
   - "as needed"
   - "ensure proper"
   - "handle appropriately"
   - "fix as necessary"
   - "similar to X" (without specifying what exactly)
4. **acceptance_criteria must be machine-verifiable** — every criterion must be checkable via:
   - `grep` command (pattern exists in file)
   - `build` command (compilation succeeds)
   - `test` command (tests pass)
   - `curl` / CLI command (endpoint responds correctly)
5. **No phantom refs** — every [REF:Hx,Mx] must correspond to an actual research finding ID
6. **TDD compliance** — for paradigm oop/fp/mixed: test tasks must exist (unless --skip-tests)
7. **read_first files must exist** — all paths in read_first are verified via Glob before plan is finalized
8. **Single responsibility** — each task addresses exactly one concern; do not bundle unrelated changes
9. **Wave correctness** — dependency graph must be a valid DAG with no cycles
10. **Design Patterns section required** — at least one pattern for medium/large scale
11. **Project mode:** When executing via `/forge --phase N`, the `phase_ref` field is populated from roadmap.md. `success_criteria_seed` provides initial truths for `must_haves`. The planner MUST expand these seeds into full `must_haves.truths` (add implementation-specific truths beyond the roadmap criteria).
12. **Task mode:** When executing via standard `/forge [request]`, omit the `phase_ref` block entirely.

## Traceability Verification

- All HIGH research findings must be referenced by at least one task via [REF:Hx]
- All MEDIUM research findings should be referenced (warning if not)
- No phantom refs: every [REF:xx] must correspond to an existing research finding ID
- Tasks not linked to research findings must have clear justification in their action
