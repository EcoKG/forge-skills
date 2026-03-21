# Forge Framework v8.0 "Nova" — 실제 사용 시나리오

> 이 문서는 Forge Framework가 실제로 어떻게 동작하는지를 대화 형식으로 보여줍니다.
> 각 시나리오는 사용자 요청 → Gatekeeper 분류 → 파이프라인 실행 → 산출물 생성까지의 전체 흐름을 담고 있습니다.

---

## 목차

1. [새 기능 추가 — Standard 모드](#시나리오-1-새-기능-추가-feature-implementation)
2. [버그 수정 — Debug 모드](#시나리오-2-버그-수정-bug-fix)
3. [리팩토링 — Large Scale](#시나리오-3-리팩토링-refactoring)
4. [코드 분석 — Analyze 모드](#시나리오-4-코드-분석-analysis)
5. [간단한 수정 — Trivial 모드](#시나리오-5-간단한-수정-trivial)
6. [커스텀 스킬 만들기](#시나리오-6-커스텀-스킬-만들기)
7. [브레인스토밍 — Forge 트리거 안 됨](#시나리오-7-브레인스토밍-forge-트리거-안-됨)

---

## 시나리오 1: 새 기능 추가 (Feature Implementation)

### 요청

```
사용자: "이 Express 앱에 JWT 인증을 추가해줘"
```

### Gatekeeper 분류

Haiku 서브에이전트가 요청을 분석합니다.

```json
{
  "category": "code-modify",
  "skill": "forge-dev",
  "confidence": 0.97,
  "config": {
    "mode": "standard",
    "type": "code",
    "scale": "medium"
  }
}
```

`code-modify`로 분류 → `forge-dev` 스킬로 라우팅. 사용자가 별도로 `/forge`를 입력할 필요가 없습니다.

---

### 파이프라인 흐름 (Standard 모드)

#### Step 1: INIT

엔진이 워크스페이스를 초기화합니다.

```
[forge-dev] Starting pipeline...
Artifact dir: .forge/2026-03-21/jwt-auth-1430/
Stack detected: Express (Node.js)
Workspace scope: src/routes/, src/middleware/, src/tests/
Pipeline: standard (8 steps)
```

내부적으로 실행되는 엔진 명령:

```bash
node "$FORGE_ENGINE" engine-init \
  .forge/2026-03-21/jwt-auth-1430 \
  "add JWT authentication to Express app" \
  "code" "medium"
```

생성되는 파일:
- `.forge/2026-03-21/jwt-auth-1430/meta.json`
- `.forge/2026-03-21/jwt-auth-1430/pipeline-state.json`
- `.forge/2026-03-21/jwt-auth-1430/workspace-context.json`

---

#### Step 2: RESEARCH

researcher 에이전트가 기존 코드와 관련 패키지를 분석합니다.

```
[forge-dev] Step 2/8: Research
Dispatching: researcher (Sonnet)
```

researcher 에이전트가 수행하는 작업:
- 현재 Express 앱 구조 파악 (`src/routes/`, `src/app.js`)
- 기존 미들웨어 패턴 확인
- `jsonwebtoken`, `bcrypt` 등 관련 패키지 조사
- 유사 프로젝트의 JWT 구현 패턴 조사

산출물: `.forge/2026-03-21/jwt-auth-1430/research.md`

---

#### Step 2.5: ARCHITECT GUIDE

architect 에이전트가 설계 가이드를 작성합니다.

```
[forge-dev] Step 2.5/8: Architecture Review
Dispatching: architect (Sonnet)
```

설계 가이드 내용:
- JWT 미들웨어 배치 위치 (`src/middleware/auth.js`)
- 토큰 발급/검증 분리 설계
- 환경변수 관리 방식 (`JWT_SECRET`, `JWT_EXPIRES_IN`)
- 보안 고려사항 (OWASP A07 - 인증 실패 방지)

산출물: `.forge/2026-03-21/jwt-auth-1430/design-guide.md`

---

#### Step 3: PLAN

planner 에이전트가 구체적인 태스크 목록을 작성합니다.

```
[forge-dev] Step 3/8: Planning
Dispatching: planner (Sonnet)
```

`plan.md` 내용 (예시):

```markdown
## Task List

1. Install dependencies: jsonwebtoken, bcryptjs
2. Create src/middleware/auth.js — JWT verify middleware
3. Create src/routes/auth.js — /login, /register endpoints
4. Update src/app.js — mount auth routes
5. Add JWT_SECRET to .env.example
6. Write tests: middleware/auth.test.js, routes/auth.test.js
```

---

#### Step 4: PLAN CHECK

plan-checker 에이전트가 계획을 검증합니다.

```
[forge-dev] Step 4/8: Plan Verification
Dispatching: plan-checker (Haiku)
Result: PASS
```

Gate Guard가 `plan.md` 존재를 확인. `research.md` 없이 `plan.md` 작성 시도 시 **exit(2)** 로 하드 블록됩니다 (Gate 1).

---

#### Step 5: CHECKPOINT — 사용자 승인

```
[forge-dev] Step 5/8: Checkpoint

계획을 검토하고 승인해주세요:

파일 변경 예정:
  - NEW  src/middleware/auth.js
  - NEW  src/routes/auth.js
  - MOD  src/app.js
  - NEW  src/middleware/auth.test.js
  - NEW  src/routes/auth.test.js
  - MOD  .env.example

예상 범위: 5개 파일, ~120 LOC

승인하시겠습니까? [y/n/수정]
```

**사용자:** `y`

---

#### Step 5.5: BRANCH

```bash
# 엔진이 자동으로 브랜치를 생성합니다
git checkout -b forge/jwt-auth-1430
```

---

#### Step 6: EXECUTE

4개 에이전트가 순차적으로 실행됩니다.

```
[forge-dev] Step 6/8: Execute

Wave 1/1
  ├── implementer (Sonnet) — 코드 작성
  ├── code-reviewer (Sonnet) — 코드 리뷰
  ├── qa-inspector (Haiku) — QA 검사
  └── verification-pm (Haiku) — 웨이브 검증
```

implementer가 코드를 작성하면, code-reviewer가 즉시 리뷰합니다. qa-inspector는 테스트 커버리지와 엣지케이스를 확인합니다.

Gate Guard가 각 파일 쓰기 전에 확인:
- 계획에 포함된 파일인가? (범위 외 수정 차단)
- `execute` 단계인가? (순서 위반 차단 — Gate 2)
- 시크릿이 하드코딩되지 않았는가? (Gate 6)

산출물:
- `src/middleware/auth.js` (신규)
- `src/routes/auth.js` (신규)
- `src/app.js` (수정)
- 테스트 파일 2개 (신규)
- `.forge/.../vpm-wave-1.md`

---

#### Step 7: VERIFY

```
[forge-dev] Step 7/8: Verification

Build check: npm run build → PASS
Test check:  npm test     → PASS (14/14)

Dispatching: verification-pm (Sonnet) — final verify mode
```

verification-pm이 원래 요청("JWT 인증 추가")을 기준으로 역추적 검증:
- `/login` 엔드포인트가 JWT를 발급하는가?
- 보호된 라우트에서 미들웨어가 동작하는가?
- 테스트가 실패 케이스를 커버하는가?

산출물: `.forge/2026-03-21/jwt-auth-1430/verification.md`

---

#### Step 8: FINALIZE

```
[forge-dev] Step 8/8: Finalize

Report generated: .forge/2026-03-21/jwt-auth-1430/report.md

Git summary:
  Branch: forge/jwt-auth-1430
  Files changed: 5
  Insertions: 134, Deletions: 3

Merge suggestion:
  git merge forge/jwt-auth-1430
  또는 PR을 통해 main에 병합하세요.
```

`report.md`에는 변경 사항 요약, 설계 결정, 남은 TODO 항목이 포함됩니다.

---

## 시나리오 2: 버그 수정 (Bug Fix)

### 요청

```
사용자: "주문 할인 계산에서 100% 넘는 할인이 음수 가격을 만들어"
```

### Gatekeeper 분류

```json
{
  "category": "code-modify",
  "skill": "forge-dev",
  "confidence": 0.95,
  "config": {
    "mode": "debug",
    "type": "code-bug",
    "scale": "small"
  }
}
```

루트 원인이 불명확하므로 `debug` 모드로 자동 라우팅됩니다.

---

### Debug 모드 파이프라인

Debug 모드는 Standard 모드와 다른 단계를 거칩니다:

```
reproduce → hypothesize → test → fix → verify_fix
```

#### REPRODUCE

```
[forge-dev/debug] Step 1: Reproduce

debugger 에이전트가 버그를 재현합니다.
```

debugger 에이전트가 수행하는 작업:
- `src/orders/discount.js` 코드 읽기
- 할인율 > 100%일 때의 계산 경로 추적
- 재현 케이스 작성

```javascript
// 재현 케이스
calculateDiscount(price=100, discountRate=1.5)
// 결과: -50 (기대값: 0 또는 에러)
```

---

#### HYPOTHESIZE

```
[forge-dev/debug] Step 2: Hypothesize

가설 목록:
  H1: discountRate 입력 검증 없음 (확률 85%)
  H2: 계산 순서 버그 (확률 10%)
  H3: 부동소수점 오버플로우 (확률 5%)
```

---

#### TEST

```
[forge-dev/debug] Step 3: Test Hypothesis

H1 검증: discountRate 값 범위 체크 코드 부재 → CONFIRMED
```

---

#### FIX

```
[forge-dev/debug] Step 4: Fix

Implementing fix in src/orders/discount.js
Gate Guard: execute step confirmed — write allowed
```

수정 내용:
- `discountRate`를 `[0, 1]` 범위로 클램핑
- 유효하지 않은 할인율에 대한 에러 던지기 (또는 경고 로그)

---

#### VERIFY FIX

```
[forge-dev/debug] Step 5: Verify Fix

재현 케이스 재실행:
  calculateDiscount(100, 1.5) → 0 (또는 ValidationError) ✓
  calculateDiscount(100, 0.5) → 50 ✓
  calculateDiscount(100, 0)   → 100 ✓

Tests: npm test -- --grep "discount" → 8/8 PASS
```

---

### --debug vs 일반 모드 비교

| 항목 | Standard 모드 | Debug 모드 |
|---|---|---|
| 시작 단계 | research | reproduce |
| 접근 방식 | 기능 구현 중심 | 과학적 분석 (가설 → 검증) |
| 주요 에이전트 | researcher, planner, implementer | debugger |
| 산출물 | plan.md, code, report.md | 가설 목록, fix, verification.md |
| 적합한 상황 | 명확한 구현 요청 | 원인 불명확한 버그 |

---

## 시나리오 3: 리팩토링 (Refactoring)

### 요청

```
사용자: "서비스 레이어를 Repository 패턴으로 리팩토링해줘"
```

### Gatekeeper 분류

```json
{
  "category": "code-modify",
  "skill": "forge-dev",
  "confidence": 0.93,
  "config": {
    "mode": "standard",
    "type": "code-refactor",
    "scale": "large"
  }
}
```

6개 이상 파일 수정이 예상되므로 `large` 스케일 자동 감지 → Standard 모드.

---

### Large Scale 자동 감지

엔진이 스케일을 판단하는 기준:

```
small:  1개 파일, ≤50 LOC
medium: 2–5개 파일, ≤300 LOC
large:  6개 이상 파일, 또는 새 API/스키마 도입
```

Repository 패턴 도입은 `large`에 해당합니다. 새로운 추상화 레이어가 생기고, 기존 서비스 파일 전체가 수정됩니다.

---

### Research 단계 — 현재 구조 파악

researcher 에이전트:
- `src/services/` 디렉토리 전체 분석
- DB 직접 접근 패턴 식별 (Mongoose, Knex 등)
- 공통 쿼리 패턴 추출

```markdown
## 현재 구조 (research.md)

서비스 파일: 8개 (UserService, OrderService, ProductService ...)
DB 접근 위치: 각 서비스에 직접 ORM 쿼리 분산
반복 패턴: findById, findAll, save, delete (표준화 가능)
```

---

### Plan 단계 — 멀티 웨이브 계획

planner 에이전트가 대규모 변경을 안전하게 분리합니다.

```markdown
## plan.md

### Wave 1: Repository 생성 (신규 파일)
- NEW src/repositories/base.repository.js
- NEW src/repositories/user.repository.js
- NEW src/repositories/order.repository.js
- NEW src/repositories/product.repository.js
- NEW src/repositories/index.js

### Wave 2: Service 수정 (기존 파일)
- MOD src/services/UserService.js
- MOD src/services/OrderService.js
- MOD src/services/ProductService.js

### Wave 3: 테스트 업데이트
- NEW src/repositories/__tests__/
- MOD src/services/__tests__/
```

---

### Execute 단계 — 멀티 웨이브 실행

```
[forge-dev] Step 6: Execute

Wave 1/3 — Repository 생성
  ├── implementer (Sonnet)
  ├── code-reviewer (Sonnet)
  ├── qa-inspector (Haiku)
  └── verification-pm (Haiku) — wave 1 검증

Wave 1 완료: 5개 파일 생성, 리뷰 PASS

Wave 2/3 — Service 수정
  ├── implementer (Sonnet) — ORM 쿼리 → Repository 호출로 교체
  ├── code-reviewer (Sonnet) — 인터페이스 일관성 검토
  ├── qa-inspector (Haiku) — 동작 등가성 확인
  └── verification-pm (Haiku) — wave 2 검증

Wave 2 완료: 3개 파일 수정

Wave 3/3 — 테스트 업데이트
  ...
```

각 웨이브가 완료된 후 verification-pm이 해당 웨이브의 산출물을 검증합니다. 실패 시 해당 웨이브에서 멈추고 사용자에게 알립니다.

---

### 코드 리뷰 + QA 게이트

code-reviewer가 집중적으로 확인하는 항목:
- 기존 서비스 인터페이스가 유지되는가? (외부 호출 코드 변경 불필요)
- Repository 메서드 시그니처가 일관적인가?
- DI(의존성 주입) 패턴이 올바른가?

qa-inspector가 확인하는 항목:
- 기존 테스트가 여전히 통과하는가?
- Repository mock이 올바르게 설정되었는가?
- 에러 핸들링이 누락된 Repository 메서드는 없는가?

Gate Guard는 `execute` 단계 외 코드 수정을 차단합니다 (Gate 2). 웨이브 중간에 `plan.md` 없이 새 파일을 만드는 시도도 차단됩니다.

---

## 시나리오 4: 코드 분석 (Analysis)

### 요청

```
사용자: "이 프로젝트 보안 감사해줘"
```

### Gatekeeper 분류

```json
{
  "category": "code-modify",
  "skill": "forge-dev",
  "confidence": 0.91,
  "config": {
    "mode": "analyze",
    "type": "analysis-security",
    "scale": "medium"
  }
}
```

`analyze` 타입 → `--mode analyze` 자동 적용. **코드 변경 없음.**

---

### Analyze 모드 파이프라인

```
init → analyze_search → finalize
```

Standard 모드의 plan/execute/verify 단계가 없습니다. 읽기 전용 파이프라인입니다.

```
[forge-dev/analyze] Analyze mode — read-only
Gate Guard: write operations will be BLOCKED in this mode
```

---

### analyze_search 단계

analyzer 에이전트 (Sonnet)가 적응형 검색을 수행합니다:

1. **인증/인가** — OWASP A07 검사
   - JWT 검증 누락 라우트
   - 권한 체크 우회 가능성
2. **입력 검증** — OWASP A03 검사
   - SQL Injection 가능 패턴
   - XSS 취약점 (unescaped user input)
3. **민감 데이터 노출** — OWASP A02 검사
   - 하드코딩된 시크릿
   - 로그에 비밀번호 출력 여부
4. **의존성 취약점**
   - `package.json` CVE 알려진 버전 확인

---

### 분석 결과 리포트

산출물: `.forge/2026-03-21/security-audit-1530/report.md`

```markdown
## Security Audit Report

### Critical (즉시 수정 필요)
- [ ] src/routes/admin.js:42 — JWT 검증 없이 관리자 엔드포인트 접근 가능
- [ ] src/config/database.js:8 — DB 비밀번호 하드코딩

### High
- [ ] src/controllers/user.js:67 — SQL 쿼리에 사용자 입력 직접 삽입

### Medium
- [ ] src/utils/logger.js:23 — 에러 로그에 사용자 비밀번호 포함 가능성

### Low
- [ ] dependencies: express@4.17.1 → CVE-2022-24999 (DoS)

### Score: 3/10 (즉각 개선 필요)
```

코드 파일은 하나도 수정되지 않습니다. 분석 결과는 리포트 파일로만 전달됩니다.

---

## 시나리오 5: 간단한 수정 (Trivial)

### 요청

```
사용자: "이 오타 고쳐줘: cosnt → const"
```

### Gatekeeper 분류

```json
{
  "category": "code-modify",
  "skill": "forge-dev",
  "confidence": 0.99,
  "config": {
    "mode": "trivial",
    "type": "code",
    "scale": "small"
  }
}
```

1줄 수정, 의도 100% 명백 → `trivial` 모드 자동 감지.

---

### Trivial 모드 파이프라인

```
init → execute → cleanup
```

research, plan, checkpoint, verify 단계가 없습니다. 최소한의 파이프라인으로 빠르게 처리합니다.

```
[forge-dev/trivial] Trivial mode
Estimated: 1 file, 1 line

Executing...
  src/utils/helper.js:15: cosnt → const

Done. No tests required for trivial fix.
Cleanup complete.
```

Gate Guard가 trivial 모드에서 과도한 변경을 감지하면 차단합니다 (Gate 5T):

> 만약 execute 단계에서 5줄 이상 수정이 발생하면:
> `Gate 5T violation: trivial mode limit exceeded. Switch to quick/standard mode.`

이 경우 파이프라인이 중단되고 사용자에게 모드 전환을 안내합니다.

---

## 시나리오 6: 커스텀 스킬 만들기

### 요청

```
사용자: "배포 자동화 스킬을 만들고 싶어"
```

### 개요

Forge Framework는 커스텀 스킬을 지원합니다. 최소 5줄의 YAML로 시작해 점진적으로 기능을 추가합니다.

---

### Step 1: 템플릿 복사

```bash
# 스킬 템플릿 복사
cp -r ~/.claude/skills/forge-framework/templates/skill-template \
       ~/.claude/skills/forge-framework/skills/deploy-auto

cd ~/.claude/skills/forge-framework/skills/deploy-auto
```

생성된 구조:
```
deploy-auto/
├── SKILL.md        ← 스킬 정의 (수정 대상)
└── prompts/
    └── agent.md    ← 에이전트 프롬프트 (수정 대상)
```

---

### Step 2: SKILL.md 수정

```yaml
---
name: deploy-auto
description: |
  자동화된 배포 파이프라인. Docker 빌드 → 스테이징 배포 →
  승인 게이트 → 프로덕션 배포 순으로 실행.
routing:
  triggers:
    - deploy
    - release to production
    - rollback
    - push to staging
  anti-triggers:
    - explain deployment
    - what does deploy mean
  categories:
    - code-modify
---

# deploy-auto — 배포 자동화 스킬

## Pipeline

1. **pre-check**: 현재 브랜치, 빌드 상태 확인
2. **build**: Docker 이미지 빌드
3. **staging**: 스테이징 환경 배포
4. **smoke-test**: 기본 동작 확인
5. **approval**: 사용자 승인 게이트
6. **production**: 프로덕션 배포
7. **verify**: 헬스체크 + 알림

## Instructions

...
```

---

### Step 3: 스킬 인식 확인

스킬 설치 후 Claude Code를 재시작하면 Gatekeeper가 자동으로 새 스킬을 카탈로그에 추가합니다.

```bash
# 설치 확인
node ~/.claude/skills/forge-framework/core/gatekeeper-init.js --dry-run

# 출력 예시
Skill catalog:
  - forge-dev (built-in)
  - deploy-auto (custom) ← 새로 추가됨
```

---

### Step 4: 테스트

```
사용자: "스테이징에 배포해줘"
```

Gatekeeper 분류:
```json
{
  "category": "code-modify",
  "skill": "deploy-auto",
  "confidence": 0.94
}
```

`forge-dev` 대신 `deploy-auto`로 라우팅됩니다.

---

### 점진적 확장

| 레벨 | 추가 항목 | 효과 |
|---|---|---|
| Level 0 | `name + description + routing.triggers` | 라우팅만 |
| Level 1 | `+ framework.pipeline` | 커스텀 파이프라인 단계 |
| Level 2 | `+ framework.workspace` | 파일 접근 범위 제어 |
| Level 3 | `+ framework.gates + framework.quality` | 커스텀 품질 게이트 |
| Level 4 | `+ agent prompts + templates` | 완전 자율 스킬 |

스킬은 기존 품질 레이어를 비활성화할 수 없습니다. 추가만 가능합니다 (보안 원칙).

---

## 시나리오 7: 브레인스토밍 (Forge 트리거 안 됨)

### 요청

```
사용자: "이 아키텍처에 대해 어떻게 생각해?
        단일 DB에서 마이크로서비스로 분리하려고 하는데,
        각 서비스가 자체 DB를 갖는 방식이 맞을까?"
```

### Gatekeeper 분류

```json
{
  "category": "discuss",
  "skill": null,
  "confidence": 0.96,
  "action": "PASS"
}
```

`discuss` 분류 → **forge 트리거 안 됨.** 파이프라인 없이 자유롭게 대화합니다.

---

### 대화 흐름

**Claude:**

마이크로서비스 각자 DB를 갖는 패턴은 맞습니다. 이유는 세 가지입니다.

첫째, 서비스 간 데이터 결합 제거. 공유 DB를 쓰면 스키마 변경이 다른 서비스를 깨뜨립니다. 각 서비스가 자체 DB를 가지면 스키마를 독립적으로 진화시킬 수 있습니다.

둘째, 확장성. Order 서비스에만 부하가 몰릴 때, 해당 서비스와 DB만 독립적으로 스케일 아웃이 가능합니다.

셋째, 장애 격리. User DB가 다운되어도 Product 서비스는 계속 동작합니다.

다만 트레이드오프가 있습니다. 기존에 JOIN으로 처리했던 쿼리를 이제 API 호출로 구현해야 합니다. 특히 여러 서비스의 데이터가 필요한 집계 쿼리가 복잡해집니다. Saga 패턴이나 CQRS를 고려하셨나요?

**사용자:** "Saga 패턴을 쓰면 어떤 복잡도가 생기는지 알려줘"

**Claude:**

Saga 패턴에서 주로 맞닥뜨리는 복잡도는 다음과 같습니다...

*(대화 계속)*

---

### v7.0과 v8.0의 핵심 차이

이것이 Forge Framework v8.0 "Nova"의 가장 중요한 변화입니다.

| 항목 | v7.0 | v8.0 |
|---|---|---|
| forge 스킬 호출 | 모든 요청에서 수동 `/forge` 입력 | Gatekeeper가 자동 분류 + 라우팅 |
| discuss 처리 | forge 파이프라인으로 넘어감 | PASS — 자유 대화 |
| question 처리 | forge 파이프라인으로 넘어감 | PASS — 직접 답변 |
| 브레인스토밍 | 파이프라인 오버헤드 | 즉시 대화 |
| 아키텍처 토론 | 파이프라인 오버헤드 | 즉시 대화 |

v8.0에서 Gatekeeper는 "코드 수정이 필요한가?"를 정확히 판단합니다. 코드 변경 없이 생각을 나누는 대화에는 파이프라인이 개입하지 않습니다.

단, Gatekeeper는 **최적화 레이어**이지 **보안 경계**가 아닙니다. Gatekeeper가 실패하거나 우회되어도 Gate Guard(PreToolUse hook)가 코드 수정을 독립적으로 차단합니다.

---

## 요약: 모드별 파이프라인 비교

| 모드 | 단계 | 적합한 상황 | 주요 산출물 |
|---|---|---|---|
| **standard** | research → plan → check → checkpoint → branch → execute → verify → finalize | 다중 파일, 불명확한 범위, 위험한 변경 | research.md, plan.md, code, verification.md, report.md |
| **quick** | plan → execute → verify → finalize | 단일 파일, ≤50 LOC, 명확한 요청 | plan.md, code, report.md |
| **trivial** | init → execute → cleanup | 1줄 수정, 의도 명백 | code (수정) |
| **analyze** | init → analyze_search → finalize | 읽기 전용 분석, 코드 변경 없음 | report.md |
| **debug** | reproduce → hypothesize → test → fix → verify_fix | 원인 불명확한 버그 | 가설 목록, fix, verification.md |
| **ralph** | init → iterate loop | 테스트 통과할 때까지 반복 | code, test results |

---

## 관련 문서

- [README.md](../README.md) — 프레임워크 개요 및 아키텍처
- [SKILL.md](../SKILL.md) — 명령어 인터페이스 및 Gatekeeper 분류
- [skills/forge-dev/SKILL.md](../skills/forge-dev/SKILL.md) — forge-dev 파이프라인 상세
- [docs/skill-developer-guide.md](./skill-developer-guide.md) — 커스텀 스킬 개발 가이드
