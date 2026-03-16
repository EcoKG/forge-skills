# Forge v3.1 — 상세 한국어 가이드

> Context-Engineered Autonomous Development System
> 컨텍스트 엔지니어링 기반 자율 개발 시스템

---

## 목차

1. [개요](#1-개요)
2. [설치](#2-설치)
3. [빠른 시작](#3-빠른-시작)
4. [상세 스펙](#4-상세-스펙)
5. [사용 시나리오](#5-사용-시나리오)
6. [명령어 레퍼런스](#6-명령어-레퍼런스)
7. [아키텍처](#7-아키텍처)
8. [v3.1 신규 기능](#8-v31-신규-기능)
9. [FAQ](#9-faq)
10. [문제 해결](#10-문제-해결)

---

## 1. 개요

Forge는 Claude Code 위에서 동작하는 **자율 개발 실행 엔진**입니다.

하나의 `/forge` 명령으로:
- 코드베이스를 자동 분석하고 (Research)
- 검증 가능한 실행 계획을 세우고 (Plan)
- 병렬로 구현하고 (Execute)
- 목표 달성 여부를 역방향 검증합니다 (Verify)

### 왜 Forge인가?

| 일반 Claude Code | Forge |
|---|---|
| 하나의 긴 세션에서 작업 → 품질 저하 | 태스크마다 fresh context → 품질 일정 |
| 컨텍스트 관리 없음 | PM 15% 예산 룰 + 파일 기반 통신 |
| 계획 없이 바로 코딩 | 리서치 → 계획 → 8차원 검증 → 실행 |
| 검증 = "잘 된 것 같아요" | Goal-Backward 3단계 검증 (Exists → Substantive → Wired) |
| 에러 시 수동 디버깅 | Deviation Rules R1-R4 자동 처리 |
| 단일 모델 | 복잡도 기반 Smart Model Routing (haiku/sonnet/opus) |

### 지원 작업 유형

| 유형 | 명령어 예시 |
|---|---|
| 기능 구현 | `/forge "JWT 사용자 인증 구현"` |
| 버그 수정 | `/forge "로그인 시 500 에러 수정" --type code-bug` |
| 리팩토링 | `/forge "결제 모듈 SOLID 리팩토링" --type code-refactor` |
| 보안 감사 | `/forge "API 보안 감사" --type analysis-security` |
| 문서 작성 | `/forge "API 문서 작성" --type docs` |
| 코드 분석 | `/forge "성능 병목 분석" --type analysis` |
| 인프라 | `/forge "Docker 배포 파이프라인" --type infra` |
| 설계 | `/forge "마이크로서비스 아키텍처 설계" --type design` |

---

## 2. 설치

### 필수 조건

- **Node.js** v18+ (v22 권장)
- **Claude Code** CLI 설치 및 설정 완료

### 원라인 설치 (권장)

```bash
curl -sL https://raw.githubusercontent.com/EcoKG/forge-skills/main/setup.sh | bash
```

또는:

```bash
git clone https://github.com/EcoKG/forge-skills.git
cd forge-skills
bash install.sh
```

### 설치 과정

설치 스크립트가 자동으로 수행하는 작업:

```
[1/7] Node.js 확인
[2/7] forge 스킬 → ~/.claude/skills/forge/ 복사
[3/7] creatework 스킬 → ~/.claude/skills/creatework/ 복사
[4/7] Hook TypeScript 빌드 (최초 1회)
[5/7] 활성화 훅 + skill-rules.json 배포
[6/7] forge 워크스페이스 훅 설치
[7/7] settings.json에 활성화 훅 등록
```

### 설치 확인

```bash
echo '{"session_id":"test","prompt":"기능 구현 해줘"}' | node ~/.claude/skills/forge/hooks/activation/skill-activation.js
```

정상이면 `SKILL ACTIVATION → forge [high]` 메시지가 출력됩니다.

### 수동 설치

```bash
# 1. 스킬 복사
cp -r forge ~/.claude/skills/forge
cp -r creatework ~/.claude/skills/creatework

# 2. 워크스페이스 훅 설치
node ~/.claude/skills/forge/hooks/install.js

# 3. 활성화 훅 빌드
cd hooks && npm install && npx tsc

# 4. 규칙 배포
mkdir -p ~/.claude/skills ~/.claude/hooks/state
cp hooks/skill-rules.json ~/.claude/skills/skill-rules.json
```

### 삭제

```bash
node ~/.claude/skills/forge/hooks/install.js uninstall
rm -rf ~/.claude/skills/forge ~/.claude/skills/creatework
rm -rf ~/.claude/hooks/state ~/.claude/skills/skill-rules.json
```

---

## 3. 빠른 시작

### 첫 번째 작업: 기능 구현

```
/forge "사용자 프로필 API 엔드포인트 구현"
```

Forge가 자동으로:
1. 코드베이스 분석 (리서치)
2. 실행 계획 수립 + 8차원 검증
3. 계획 확인 요청 → 승인 시 실행
4. Wave 병렬 구현 + 코드 리뷰
5. Goal-Backward 검증
6. 최종 보고서 생성

### 빠른 수정: Quick 모드

```
/forge "로그인 폼 유효성 검사 추가" --quick
```

리서치/계획검증/검증을 건너뛰고 3단계로 완료:
Plan(1 task) → Execute → Commit

### 버그 수정

```
/forge "장바구니 총액 계산 오류" --type code-bug
```

경량 파이프라인: 재현 → 진단 → 수정 → 검증

### 디버그 모드

```
/forge --debug "로그인 시 500 에러"
```

과학적 방법론: 재현 → 가설 → 검증 → 수정 → 확인

### 프로젝트 모드

```bash
/forge --init                    # 프로젝트 생성 + 로드맵
/forge --status                  # 진행 상황 대시보드
/forge --discuss 1               # 1번 페이즈 의사결정 캡처
/forge --phase 1                 # 1번 페이즈 실행
/forge --milestone               # 마일스톤 검증
/forge --autonomous              # 남은 페이즈 자동 실행
```

---

## 4. 상세 스펙

### 4.1 실행 파이프라인 (10 Steps)

```
Step 0: 프로젝트 라우터      (프로젝트 플래그 감지 시만)
Step 1: INIT                  요청 파싱, 유형/규모/패러다임 감지
Step 2: RESEARCH              병렬 코드베이스 탐색 (haiku×N → sonnet 합성)
Step 3: PLAN                  must_haves + deep work 태스크 생성
Step 4: PLAN-CHECK            8차원 검증 (최대 3회 수정 루프)
Step 5: CHECKPOINT            사용자 승인 게이트
Step 6: BRANCH                Git feature 브랜치 생성
Step 7: EXECUTE               Wave 병렬 구현 + 태스크별 리뷰 + atomic commit
Step 8: VERIFY                Goal-Backward 3단계 검증
Step 9: FINALIZE              보고서 생성, 학습 기록
Step 10: CLEANUP              Lock 제거, meta.json 마무리
```

### 4.2 에이전트 구성 (12+2)

| # | 에이전트 | 역할 | 기본 모델 |
|---|---|---|---|
| 1 | **researcher** | 코드베이스 탐색 + 도메인 조사 | haiku(병렬) → sonnet(합성) |
| 2 | **planner** | must_haves + deep work 플랜 | sonnet (medium: opus) |
| 3 | **plan-checker** | 8차원 플랜 품질 검증 | sonnet |
| 4 | **implementer** | 코드 구현 + deviation rules | sonnet |
| 5 | **code-reviewer** | 10관점 코드 리뷰 | sonnet |
| 6 | **qa-inspector** | 빌드/테스트/anti-pattern 검사 | sonnet |
| 7 | **verifier** | Goal-Backward 3단계 검증 | sonnet |
| 8 | **doc-reviewer** | 문서 품질 리뷰 | sonnet |
| 9 | **roadmapper** | 프로젝트 로드맵 생성 | sonnet |
| 10 | **integration-checker** | 크로스 페이즈 통합 검증 | sonnet |
| 11 | **debugger** | 과학적 방법론 버그 진단 | sonnet |
| 12 | **test-auditor** | Nyquist 테스트 커버리지 분석 | sonnet |

### 4.3 품질 시스템 (5단계 방어)

```
L1: Deep Work (계획)     — 8차원 plan checker, read_first + acceptance_criteria
L2: Self-Check (구현)    — 6항목 체크리스트, stuck detection, decision lock 준수
L3: Peer Review (리뷰)   — 10관점 리뷰, 언어별 체크리스트
L4: QA Gate (Wave 경계)  — 빌드, 테스트, caller impact, anti-pattern
L5: Goal-Backward (검증) — Exists → Substantive → Wired
```

### 4.4 모델 선택 매트릭스

**Smart Routing (기본, --model balanced):**

| 복잡도 점수 | 모델 | 비용 |
|---|---|---|
| 0-3 (Low) | haiku | 1x |
| 4-6 (Medium) | sonnet | ~5x |
| 7-10 (High) | opus | ~25x |

**수동 프로필:**

| 단계 | quality | balanced | budget |
|---|---|---|---|
| Research (병렬) | sonnet | haiku | haiku |
| Research (합성) | opus | sonnet | haiku |
| Planning | opus | sonnet | sonnet |
| Implementation | opus | sonnet | sonnet |
| Code Review | opus | sonnet | haiku |
| Verification | opus | sonnet | sonnet |

### 4.5 규모 자동 감지

| 규모 | 기준 | 태스크 | 체크포인트 |
|---|---|---|---|
| **small** | 1-3 파일, 독립 변경 | 1-5 | 자동 진행 |
| **medium** | 4-10 파일, 크로스 모듈 | 6-15 | 사용자 확인 |
| **large** | 10+ 파일, 시스템 전체 | 16+ | 사용자 확인 + 페이즈별 보고 |

### 4.6 Deviation Rules (이탈 규칙)

| 규칙 | 트리거 | 동작 | 한계 |
|---|---|---|---|
| **R1** | 관련 버그 발견 | 즉시 수정 | 태스크당 3회 |
| **R2** | 누락된 기능 발견 | 30줄 미만이면 구현 | 태스크당 3회 |
| **R3** | 차단 이슈 (타입 불일치 등) | 최소 변경으로 해결 | 태스크당 3회 |
| **R4** | 아키텍처 변경 필요 | **즉시 중단**, 사용자에게 보고 | 자동 수정 없음 |

### 4.7 에러 복구 (3단계 에스컬레이션)

| 단계 | 트리거 | 동작 |
|---|---|---|
| **Tier 1** | 빌드/테스트 실패 | 에러 분석 → 자동 수정 → 재실행 |
| **Tier 2** | Tier 1 실패 | 대안 접근법 시도, 모델 업그레이드 |
| **Tier 3** | Tier 2 실패 | 사용자 개입 (문제 + 선택지 제시) |

### 4.8 산출물 구조

```
.forge/
  project-profile.json              # 프로젝트 캐시 (스택, 언어, 패러다임)
  {YYYY-MM-DD}/
    {slug}-{HHMM}/
      meta.json                     # 실행 상태 + 진행 추적
      execution-lock.json           # 크래시 복구 락 (정상 종료 시 삭제)
      research.md                   # 리서치 결과 (심각도 태그: H/M/L)
      plan.md                       # 플랜 (YAML must_haves + XML 태스크)
      task-{N-M}-summary.md         # 태스크별 실행 요약
      qa-report.md                  # QA 검사 결과
      verification.md               # Goal-Backward 검증 결과
      validation.md                 # 테스트 커버리지 갭 분석
      trace.jsonl                   # 에이전트 디스패치 추적 로그
      report.md                     # 최종 보고서
  memory/                           # 학습 시스템 (영속)
    patterns.json                   # 성공 패턴
    failures.json                   # 실패 접근법 + 대안
    decisions.json                  # 아키텍처 결정 + 근거
  metrics.json                      # 토큰/비용 추적 + 실행 메트릭
```

---

## 5. 사용 시나리오

### 시나리오 1: 신규 기능 구현

**상황:** Next.js 프로젝트에 사용자 인증 기능 추가

```
/forge "JWT 기반 사용자 인증 시스템 구현. 회원가입, 로그인, 토큰 갱신 API 포함"
```

**Forge 실행 과정:**

```
Forge v3.1 | type: code | scale: medium | lang: typescript | paradigm: oop
Artifact: .forge/2026-03-17/jwt-auth-1430/

[Step 2] Research — 3 haiku agents 병렬 탐색
  → 12 findings (3 HIGH, 5 MEDIUM, 4 LOW)

[Step 3] Plan — 8 tasks, 3 waves
  must_haves:
    truths: "사용자가 이메일/비밀번호로 로그인할 수 있다"
    artifacts: src/auth/handler.ts (min 80 lines)
    key_links: routes.ts → handler.ts (LoginHandler|RegisterHandler)

[Step 5] Checkpoint — 계획 확인 요청
  → 사용자 승인

[Step 7] Execute
  Wave 1: [1-1] 타입 정의, [1-2] JWT 유틸리티     → 2 commits
  Wave 2: [1-3] 핸들러, [1-4] 미들웨어, [1-5] DB  → 3 commits
  Wave 3: [1-6] 라우팅, [1-7] 통합 테스트         → 2 commits

[Step 8] Verify — 3-level 검증
  Level 1 (Exists): 7/7 files ✓
  Level 2 (Substantive): 7/7 real code ✓
  Level 3 (Wired): 5/5 key_links connected ✓
  Verdict: VERIFIED

[Report] 7/7 tasks completed, 0 deviations, 7 atomic commits
```

### 시나리오 2: 프로덕션 버그 긴급 수정

**상황:** 결제 처리 시 금액이 0원으로 처리되는 버그

```
/forge "결제 금액이 0원으로 처리되는 버그. 에러 메시지: 'amount is NaN'" --type code-bug
```

**Forge 실행 과정:**

```
Forge v3.1 | type: code-bug | scale: small | lang: typescript

[Step 2] Research (light) — 빠른 원인 탐색
  → [H1] parseFloat 누락: req.body.amount가 string인데 number로 사용

[Step 3] Plan (1 phase)
  Task 1: 재현 테스트 작성
  Task 2: parseFloat 변환 + NaN 체크 추가
  Task 3: 회귀 테스트 확인

[Step 7] Execute (single wave)
  → fix(payment-nan-fix/1-2): add parseFloat conversion for payment amount

[Step 8] Verify (light)
  → VERIFIED: 테스트 통과, 기존 테스트 회귀 없음
```

### 시나리오 3: 프로젝트 모드 — 전자상거래 플랫폼

```bash
# 1. 프로젝트 초기화
/forge --init "전자상거래 플랫폼. 상품 관리, 장바구니, 결제, 주문 처리"

# 2. 로드맵 확인
/forge --status

# 출력:
# Milestone 1: 핵심 기능
#   Phase 1: 상품 관리 API          [pending]
#   Phase 2: 장바구니 시스템         [pending]
#   Phase 3: 결제 연동              [pending]
# Milestone 2: 사용자 경험
#   Phase 4: 검색 + 필터            [pending]
#   Phase 5: 주문 추적              [pending]

# 3. 1번 페이즈 의사결정
/forge --discuss 1
# → DB 선택: PostgreSQL [LOCKED]
# → ORM: Prisma [LOCKED]
# → 이미지 저장: S3 [DEFERRED — Phase 4에서]

# 4. 1번 페이즈 실행
/forge --phase 1

# 5. 마일스톤 검증
/forge --milestone

# 6. 나머지 자동 실행
/forge --autonomous
```

### 시나리오 4: 중단된 실행 재개

```bash
# 세션 시작 시 자동 감지:
# ⚠ Interrupted Forge Execution Detected ⚠
#   2026-03-17/jwt-auth-1430: step 7, tasks 4/8

# 재개
/forge --resume
# → Resuming from task 1-5 (wave 3). 4/8 tasks already completed.
```

### 시나리오 5: 코드베이스 분석

```
/forge --map
```

4개 병렬 에이전트가 코드베이스를 분석하여 7개 문서 생성:
- `STACK.md` — 기술 스택 상세
- `ARCHITECTURE.md` — 아키텍처 다이어그램
- `STRUCTURE.md` — 디렉토리 구조 + 모듈 맵
- `INTEGRATIONS.md` — 외부 연동
- `CONVENTIONS.md` — 코딩 컨벤션
- `TESTING.md` — 테스트 전략
- `CONCERNS.md` — 잠재 이슈

---

## 6. 명령어 레퍼런스

### 기본 명령어

```
/forge [요청] [옵션]
```

### 옵션 플래그

| 플래그 | 값 | 기본값 | 설명 |
|---|---|---|---|
| `--type` | code, code-bug, code-refactor, docs, analysis, analysis-security, infra, design | auto | 작업 유형 |
| `--scale` | small, medium, large | auto | 규모 오버라이드 |
| `--model` | quality, balanced, budget | balanced | 모델 프로필 |
| `--review` | strict, normal, light | normal | 리뷰 강도 |
| `--paradigm` | oop, fp, script, ddd, mixed | auto | 설계 패러다임 |
| `--direct` | flag | off | 리서치 + 계획검증 건너뛰기 |
| `--quick` | flag | off | 3단계 빠른 모드 |
| `--skip-tests` | flag | off | 테스트 생성/실행 건너뛰기 |
| `--resume` | flag | off | 중단된 실행 재개 |
| `--from` | 파일 경로 | - | 기존 research.md 또는 plan.md 재사용 |

### 프로젝트 명령어

| 플래그 | 설명 |
|---|---|
| `--init` | 프로젝트 생성 + 로드맵 |
| `--phase N` | N번 페이즈 실행 |
| `--autonomous` | 남은 페이즈 자동 실행 |
| `--milestone [N]` | 마일스톤 검증 |
| `--status` | 진행 상황 대시보드 |
| `--discuss N` | N번 페이즈 의사결정 |

### 특수 명령어

| 플래그 | 설명 |
|---|---|
| `--debug` | 과학적 방법론 디버그 (5단계) |
| `--map` | 코드베이스 4에이전트 병렬 분석 |
| `--retrospective` | 마일스톤 회고 분석 |

---

## 7. 아키텍처

### 컨텍스트 엔지니어링

Forge의 핵심 혁신은 **컨텍스트 관리**입니다.

```
PM (오케스트레이터)          에이전트
├── 컨텍스트 15% 이하 사용    ├── 매번 fresh 200k context
├── 파일 경로만 전달          ├── 파일을 직접 읽기
├── 요약만 수신 (≤20줄)       ├── 전체 내용 처리
└── 상태는 디스크에           └── 결과를 디스크에 쓰기
```

**왜 중요한가?**

| 컨텍스트 사용량 | 출력 품질 |
|---|---|
| 0-30% | 최고 — 꼼꼼하고 정확 |
| 30-50% | 양호 — 안정적 |
| 50-70% | 저하 — 코너 커팅 시작 |
| 70%+ | 나쁨 — 환각, 요구사항 망각 |

Forge는 PM을 30% 이하로 유지하고, 실제 작업은 fresh context 에이전트에 위임합니다.

### 파일 기반 통신

```
PM ──(파일 경로)──→ Agent
Agent ──(파일 읽기)──→ Disk
Agent ──(결과 쓰기)──→ Disk
Agent ──(경로 반환)──→ PM
PM ──(요약만 읽기)──→ Disk
```

에이전트 간 직접 통신은 없습니다. 모든 정보는 디스크 파일을 통해 전달됩니다.

### Wave 기반 병렬 실행

```
의존성 없는 태스크 → Wave 1 (동시 최대 3개)
Wave 1에 의존하는 태스크 → Wave 2
Wave 2에 의존하는 태스크 → Wave 3

같은 파일을 수정하는 태스크 → 반드시 다른 Wave
```

각 Wave 완료 시:
1. QA 게이트 (빌드/테스트/anti-pattern)
2. Atomic Git Commit (태스크별)
3. 진행 상황 보고
4. 컨텍스트 정리

---

## 8. v3.1 신규 기능

### 8.1 Atomic Commits (태스크별 커밋)

각 태스크 완료 시 자동으로 개별 git commit:

```
feat(jwt-auth/1-1): define auth types and interfaces
feat(jwt-auth/1-2): implement JWT utility functions
feat(jwt-auth/1-3): create login and register handlers
fix(payment-fix/1-1): add parseFloat conversion for amount
refactor(auth-cleanup/1-1): extract middleware to separate module
```

**장점:**
- `git bisect`로 정확한 회귀 지점 추적
- 개별 태스크 `git revert` 가능
- 커밋 히스토리가 구현 순서 문서화

### 8.2 Crash Recovery (크래시 복구)

실행 시작 시 `execution-lock.json` 생성. 정상 완료 시 삭제.

비정상 종료 시:
```
⚠ Interrupted Forge Execution Detected ⚠
  2026-03-17/jwt-auth-1430: step 7, tasks 4/8
Use /forge --resume to continue from where it stopped.
```

### 8.3 Execution Resume (실행 재개)

```
/forge --resume
```

`meta.json`의 `completed_tasks[]` 배열을 기반으로 마지막 완료된 태스크 다음부터 재개:

```
Resuming from task 1-5 (wave 3). 4/8 tasks already completed.
Commits from previous run: abc1234, def5678, ghi9012, jkl3456
```

### 8.4 Stuck Detection (교착 탐지)

| 상황 | 임계값 | 동작 |
|---|---|---|
| 연속 Read/Grep 호출 | 5회 | 경고: 코드 작성 시도 |
| 연속 Read/Grep 호출 | 7회 | 강제: 작성 또는 STUCK 보고 |
| 같은 파일 재읽기 | 3회 | STUCK:SAME_FILE 보고 |
| 같은 에러 반복 | 3회 | 즉시 Tier 3 에스컬레이션 |

### 8.5 Context Recovery (컨텍스트 복구)

대화 컨텍스트가 압축되면 PM이 자동으로:
1. `meta.json` 읽기 → 현재 step/wave 확인
2. Loading Map에 따라 최소 필수 파일만 재로드
3. 실행 재개

### 8.6 Decision Locking (결정 잠금)

`/forge --discuss N` 으로 캡처한 결정:

| 상태 | 의미 | 강제 |
|---|---|---|
| `[LOCKED]` | 불변. 반드시 따라야 함 | planner + implementer 필수 참조 |
| `[DEFERRED]` | 이번 페이즈에서 제외 | 구현 금지 |
| `[DISCRETION]` | 구현자 재량 | 자유 선택 |

### 8.7 Token Tracking (토큰 추적)

에이전트 디스패치별 토큰 사용량 추적:

```json
// trace.jsonl
{"agent":"researcher","task_id":"research-1","model":"haiku","timestamp":"...","result":"PASS"}
{"agent":"implementer","task_id":"1-3","model":"sonnet","timestamp":"...","result":"PASS"}
```

최종 보고서에 모델별/에이전트별 토큰 요약 포함.

### 8.8 Deterministic CLI (결정론적 CLI)

LLM 판단 대신 확정적 결과를 반환하는 도구 함수:

```bash
forge-tools.js detect-stack         # 프로젝트 언어/프레임워크 감지
forge-tools.js git-state            # Git 브랜치/상태/최근 커밋
forge-tools.js create-lock <dir>    # 실행 락 생성
forge-tools.js remove-lock <dir>    # 실행 락 제거
forge-tools.js check-lock <dir>     # 실행 락 확인
forge-tools.js metrics-record-dispatch <json>  # 디스패치 기록
```

---

## 9. FAQ

**Q: Forge는 어떤 언어를 지원하나요?**
A: 모든 언어를 지원합니다. 추가로 JavaScript/TypeScript, Python, Go, Java, Rust, C#에 대해 언어별 코드 리뷰 체크리스트가 있습니다.

**Q: 비용은 얼마나 드나요?**
A: Claude Code API 비용만 발생합니다. balanced 프로필 기준, medium 프로젝트(8 tasks) 예상: ~735k tokens. `--model budget`으로 40-60% 절감 가능.

**Q: 기존 프로젝트에 바로 사용할 수 있나요?**
A: 네. `/forge "요청"` 만 입력하면 됩니다. 코드베이스를 자동으로 분석합니다.

**Q: 실행 중 Forge가 잘못된 방향으로 가면?**
A: Step 5 (Checkpoint)에서 계획을 검토하고 수정/취소할 수 있습니다. 실행 중에도 R4 deviation이 발생하면 자동 중단하고 사용자에게 보고합니다.

**Q: 프로젝트 모드와 태스크 모드의 차이는?**
A: 태스크 모드는 단일 작업 (1회 실행). 프로젝트 모드는 로드맵 기반 다단계 작업 (여러 세션에 걸쳐 진행). `.forge/project.json`이 있으면 프로젝트 모드.

**Q: Forge 없이도 할 수 있는 작업은?**
A: 한 줄 수정 (오타, 변수명), 코드 설명만 필요한 경우, 단순 CLI 명령. 이런 건 Forge 오버헤드가 불필요합니다.

---

## 10. 문제 해결

### "forge 스킬을 찾을 수 없습니다"

```bash
ls ~/.claude/skills/forge/SKILL.md
```

파일이 없으면 `bash install.sh` 재실행.

### Hook이 작동하지 않음

```bash
cat ~/.claude/settings.json | grep -A 5 "skill-activation"
```

`skill-activation.js` 경로가 올바른지 확인. Node.js 경로도 확인:
```bash
which node
```

### 실행 중 "Context pressure CRITICAL"

컨텍스트가 부족합니다. 옵션:
1. 새 세션에서 `/forge --resume`으로 이어하기
2. `--model budget`으로 토큰 절약
3. `--quick`으로 간소화된 실행

### Lock 파일이 남아있음

비정상 종료 후 수동 정리:
```bash
find .forge -name "execution-lock.json" -delete
```

### 에이전트가 계속 같은 에러를 반복

v3.1의 Stuck Detection이 3회 반복 시 자동 에스컬레이션합니다. 그래도 반복되면:
1. `--model quality`로 더 강력한 모델 사용
2. `--direct`로 리서치 건너뛰고 직접 계획 수립
3. `--type code-bug --debug`로 디버그 파이프라인 사용

---

## 라이선스

MIT
