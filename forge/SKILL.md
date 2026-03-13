---
name: forge
description: |
  Use forge for feature implementation, non-trivial bug fixes, refactoring, or multi-file changes. Research + planning prevents costly mistakes.

  ALWAYS: feature impl (기능 구현, 만들어줘, implement, build, add feature), bug fixes (버그, 에러, 안 됨, 크래시, bug, crash, broken, fix this), refactoring (리팩토링, SOLID, refactor, clean up), perf/code analysis (성능 분석, 최적화, 코드 분석, profiling, optimize, analyze), security (보안, 취약점, audit, OWASP), architecture (설계, 아키텍처, schema, API), CI/CD Docker deploy (배포, pipeline, infrastructure), env setup (환경 세팅, 개발환경, configure), migrations (마이그레이션, upgrade), multi-file ripple effects, /forge or 포지

  DO NOT (overrides above): trivial single-line edits (오타, typo, 변수명 하나, one import, one env var), code explanation only, simple commands (git log, npm install), new standalone files from scratch
---

# Forge

> Autonomous execution engine: research → plan → execute → deliver.
> **컨텍스트가 불완전하면 이 SKILL.md를 다시 읽어 플로우를 복구하라.**

---

## 핵심 규칙

1. **코드 전 이해**: Step 1~4 완료 전에 구현 코드를 작성하지 않는다 (`--direct` 제외).
2. **단계 순서 준수**: 필수 단계는 순서대로 실행. 이전 단계 미완료 시 다음 진행 불가.
3. **자동 트리거 시 확인**: 복잡한 요청 자동 감지 시 사용자 확인 후 Step 1 진입.
4. **`--direct` 자가 선택 금지**: 사용자가 `/forge --direct`를 명시한 경우에만 허용.
5. **산출물 필수**: 모든 실행은 최소 `meta.json` + `research.md` + `report.md` 생성.

## 컨텍스트 엔지니어링 — 최우선 원칙

forge는 컨텍스트 윈도우를 적극적으로 관리한다. 모든 중간 결과와 상태는 **파일에 외부화**하고, 컨텍스트에는 **현재 단계에 필요한 최소 정보만** 유지한다.

**원칙:**
- **상태는 파일에**: research.md, plan.md, meta.json이 기억 역할. 컨텍스트에 누적하지 않는다.
- **단계별 로딩**: 각 Step 진입 시 해당 참조 파일만 읽는다. 미리 읽지 않는다.
- **execution-flow.md 섹션별 읽기**: `references/execution-flow.md`는 전체를 한 번에 읽지 않는다. 현재 Step의 `## Step N:` 헤더부터 다음 `---` 구분선까지만 읽는다. (예: Step 2 진입 시 `## Step 2: 리서치` ~ 다음 `---`까지만 참조)
- **작업 단위 원자화**: 각 작업이 컨텍스트의 50%를 넘지 않도록 분할한다.
- **결과 요약 후 폐기**: 에이전트 출력은 핵심만 요약 → 다음 단계에 전달. 전체 출력은 파일 저장 후 컨텍스트에서 제거.
- **Plan = Prompt**: 계획 파일이 곧 실행 지시서. 에이전트에 직접 전달.

**단계별 로딩 맵:**

| 진입 단계 | 읽을 파일 | 읽지 않을 파일 |
|---|---|---|
| Step 1 초기화 | `templates/output.md`, `.claude/forge-rules.md` | prompts/*, checklists/*, templates/research,plan,report |
| Step 2 리서치 | `templates/research.md` | prompts/*, checklists/* |
| Step 3 계획 | `templates/plan.md`, 산출물 `research.md` | prompts/*, checklists/* |
| Step 7 에이전트 | 유형별 prompts + checklists | 이미 불필요한 templates |
| Step 9 마무리 | `templates/report.md` | 나머지 전부 |

## 실행 플로우 — 요약

> **각 Step의 상세 지침은 [references/execution-flow.md](references/execution-flow.md)에서 현재 Step 섹션만 읽는다.**

### Step 1 빠른 시작 (execution-flow.md 없이 실행 가능)

Step 1은 SKILL.md만으로 바로 시작한다. execution-flow.md는 Step 2부터 참조.

1. 사용자 입력에서 요청 추출 (불명확하면 질문)
2. 언어, 요청 유형(`--type`), 규모(`--scale`) 감지 — 위 테이블 참조
3. 실행 전략 추천 → `--exec` 미설정 시 사용자에게 질문 (subagent: 소규모/빠름 vs team: 중대규모/역할분리)
4. 병렬 읽기: `templates/output.md` + `.claude/forge-rules.md` (있으면)
5. 프로젝트 패러다임 감지 → `.claude/project-profile.json` 캐시
6. 산출물 디렉토리 생성: `.claude/artifacts/{YYYY-MM-DD}/{slug}-{HHMM}/` → meta.json 초기화
7. meta.json에 `"step": "init_done"` 기록 → Step 2로 진행 (이때 execution-flow.md의 Step 2 섹션 읽기)

### Step 2~9 요약

| Step | 이름 | 핵심 행동 | 산출물 |
|---|---|---|---|
| 1 | 초기화 | 요청 파싱, 유형/규모 감지, 산출물 디렉토리 생성 | meta.json |
| 2 | 리서치 | 코드베이스 탐색, 발견사항 합성 (H/M/L 등급) | research.md |
| 3 | 계획 | 작업 분해 [N-M], 페이즈 구성, 리뷰 | plan.md |
| 4 | 체크포인트 | 규모 요약 표시, 사용자 승인 (small은 자동) | — |
| 5 | Git 브랜치 | `feature/{slug}` 생성 제안 | — |
| 6 | 작업 목록 | plan.md → TaskCreate | — |
| 7 | 에이전트 설정 | 프롬프트 로드, 에이전트 생성 | — |
| 8 | 실행 | 구현→GATE→리뷰→QA 루프 (페이즈별) | 코드 변경 |
| 9 | 마무리 | 검증, 보고서 생성, 학습 기록 | report.md |

## 활성화

1. **명시적**: `/forge "요청" [옵션]`
2. **자동 트리거**: 복잡도 판단 후 → 사용자 확인 → Step 1

### 복잡도 판단

아래 중 하나라도 "예"이면 forge 사용:
1. **파급 효과**: 다른 모듈/시스템에 영향?
2. **도메인 이해 필요**: 비즈니스 규칙을 이해해야 안전하게 수정?
3. **Chesterton's Fence**: 제거 대상 코드의 존재 이유가 불분명?
4. **이해 비용 > 코딩 비용**: 리서치 후 한 번에 구현이 더 효율적?

## 커맨드 옵션

```
/forge "요청 설명" [옵션]
```

| 옵션 | 값 | 기본값 | 설명 |
|---|---|---|---|
| `--type` | `code`/`docs`/`analysis`/`infra`/`design` | auto | 요청 유형 |
| `--direct` | 플래그 | off | 리서치+계획 생략 |
| `--no-research` | 플래그 | off | 리서치만 생략 |
| `--from` | 파일 경로 | — | 기존 research/plan에서 시작 |
| `--model` | `opus`/`sonnet`/`haiku` | auto | 모델 강제 지정 |
| `--review` | 1–5 | 1 | 검토자 수 |
| `--scale` | `auto`/`small`/`medium`/`large` | auto | 작업 규모 |
| `--exec` | `auto`/`subagent`/`team` | auto | 실행 전략 |
| `--lang` | `ko`/`en`/… | auto | 출력 언어 (입력에서 감지) |
| `--cost` | `low`/`medium`/`high` | medium | 비용 등급 |
| `--paradigm` | `oop`/`functional`/`script`/`mixed`/`auto` | auto | 설계 패러다임 |
| `--skip-tests` | 플래그 | off | TDD 생략 |
| `--resume` | slug | — | 중단된 작업 재개 |
| `--init` | 플래그 | off | 프로젝트 초기화 |

## 요청 유형 분류

> 상세 워크플로우: [resources/type-guides.md](resources/type-guides.md) (해당 Step에서 읽기)

**서브타입 구분 기준:**
- `code (bug)`: 사용자 메시지에 버그/에러/오류/crash/broken/not working/안 됨/안돼/고쳐줘/fix 키워드가 포함되거나, 기존 동작의 오작동을 보고하는 경우
- `code (refactor)`: 기능 변경 없이 구조 개선 요청 — 리팩토링/분리/정리/clean up/reorganize/SOLID 키워드
- `analysis (security)`: 보안/취약점/OWASP/인증/인가 키워드가 포함된 분석 요청

| 유형 | 핵심 플로우 | 에이전트 |
|---|---|---|
| `code` | 리서치→계획→구현→리뷰→QA | implementer + code-reviewer + qa-inspector |
| `code` (bug) | 진단→경량계획→수정→리뷰 | implementer + code-reviewer |
| `code` (refactor) | 리서치→계획→기존테스트→구현→회귀→리뷰 | implementer + code-reviewer + qa-inspector |
| `docs` | 리서치→작성→문서리뷰 | implementer + doc-reviewer |
| `analysis` | 리서치→보고서 | analyst |
| `analysis` (security) | 보안리서치→OWASP→보고서 (opus 필수) | analyst (opus) |
| `infra` | 리서치→계획→dry-run→승인→실행 | implementer |
| `design` | 리서치→설계문서→리뷰 | analyst |

## 규모 감지

| 규모 | 파일 수 | 페이즈 | 작업 수 | 추천 전략 |
|---|---|---|---|---|
| small | 1–3 | 1 | 3–8 | subagent |
| medium | 4–10 | 2–3 | 8–20 | team |
| large | 10+ | 3–5 | 20+ | team |

## 모델 선택 (`--cost medium`)

| 단계 | 모델 |
|---|---|
| 파일 탐색 | haiku |
| 리서치/계획 | sonnet |
| 계획 리뷰 | haiku |
| 구현 (단순/핵심) | sonnet / opus |
| 코드 리뷰 | opus |
| QA | sonnet |

`--cost low`: 전부 haiku (리뷰 생략 불가). `--cost high`: 전부 opus. 보안 분석은 기본 opus.
적응형: 연속 3회 PASS → 리뷰 haiku 하향. 같은 파일 편집 → 마지막만 리뷰.

## 유형별 필수 단계

| 단계 | code | docs | analysis | infra | design |
|---|---|---|---|---|---|
| 1. 초기화 | ✓ | ✓ | ✓ | ✓ | ✓ |
| 2. 리서치 | ✓ | ✓ | ✓ | ✓ | ✓ |
| 3. 계획 | ✓ | — | — | ✓ | ✓ |
| 4. 체크포인트 | ✓ | — | — | ✓ | ✓ |
| 5. Git 브랜치 | ✓ | 선택 | — | 선택 | 선택 |
| 6. 작업 목록 | ✓ | ✓ | — | ✓ | — |
| 7. 에이전트 설정 | ✓ | ✓ | ✓ | ✓ | ✓ |
| 8. 실행 | ✓ | ✓ | 보고서 | ✓ | 보고서 |
| 9. 마무리 | ✓ | ✓ | ✓ | ✓ | ✓ |

## 설계 원칙

패러다임(`--paradigm`)에 따라 적용. 감지 기준: 클래스 비율, import 패턴, 프레임워크, 확장자.
- **OOP/mixed**: SOLID, DDD 경계 존중, Ubiquitous Language
- **Functional**: Pure functions, immutable data, composition
- **Script**: TDD 의무 없음, 가독성+안전성 중심
- **TDD**: `script` 외 기본 적용 (Red→Green→Refactor). 생략: `--skip-tests` 또는 테스트 인프라 부재.

## 산출물 구조

```
.claude/artifacts/{YYYY-MM-DD}/{slug}-{HHMM}/
├── meta.json, research.md, plan.md, report.md, feedback.md(선택)
```
산출물 = 마스터. 프로젝트 루트에는 단방향 복사. index.json으로 이력 관리.

## 언어 / 재개 / 초기화

- **언어**: `--lang` 미설정 시 사용자 입력에서 감지. 코드/변수명은 영어 유지.
- **재개** (`--resume slug`): meta.json → 체크포인트에서 재개.
- **초기화** (`--init`): 새 프로젝트 스캐폴딩 또는 기존 프로젝트 profile 생성.
