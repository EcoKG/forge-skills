# Forge Framework v8.0 — 스킬 개발자 가이드 (한국어)

**대상 독자:** Forge Framework v8.0 "Nova" 위에서 커스텀 스킬을 만들려는 개발자.
**사전 조건:** Claude Code와 `/forge` 명령어에 대한 기본적인 이해.

---

## 1. 소개

### Forge Framework 스킬이란?

스킬(Skill)은 이름이 붙은 선언형(Declarative) 행동 단위다. Forge Framework가 라우팅(Routing), 실행(Execution), 품질 게이트(Quality Gate) 적용까지 모두 처리한다. 스킬은 `~/.claude/skills/` 아래에 위치하며, 세션 시작 시 자동으로 감지된다 — 등록 절차도, import도 필요 없다.

스킬의 본질은 **YAML 프론트매터(Front-matter) 매니페스트가 포함된 Markdown 파일**이다. 매니페스트는 프레임워크에 필요한 모든 정보를 담는다: 스킬이 무엇을 하는지, 어떻게 라우팅할지, 어떤 파이프라인을 실행할지, 어떤 파일을 다룰 수 있는지. 매니페스트 아래의 본문(Instructions Body)은 라우팅된 이후 Claude가 어떻게 동작해야 하는지를 기술한다.

### 일반 Claude Code 스킬과의 차이

일반 `~/.claude/skills/my-skill/SKILL.md`는 정적 컨텍스트로 로드된다 — Claude가 읽고 자유롭게 행동한다. Forge Framework 스킬은 그 위에 전체 플랫폼이 얹힌다.

| 일반 스킬 | Forge Framework 스킬 |
|---|---|
| 컨텍스트로 로드 | Gatekeeper(Haiku 서브에이전트)가 라우팅 |
| 파일 접근 제어 없음 | Gate Guard가 워크스페이스 스코프 강제 |
| 파이프라인 없음 | 파이프라인 엔진이 단계별 실행 주도 |
| 품질 검사 없음 | 품질 게이트가 잘못된 커밋 차단 |
| 단일 모드 | 다중 모드 (standard, quick, debug, ...) |

프레임워크는 스킬을 **플러그인**으로 취급한다. 선언형 메타데이터가 인프라를 구동하고, 스킬 자체의 지시문(및 선택적 에이전트 프롬프트)이 로직을 담당한다.

---

## 2. 빠른 시작 (5분)

`~/.claude/skills/my-skill/SKILL.md` 파일을 생성한다:

```yaml
---
name: my-skill
description: "이 스킬이 하는 일을 한 문장으로 설명"
routing:
  triggers: ["키워드1", "키워드2"]
---
여기에 스킬 지시문을 작성한다...
```

이것이 완전하고 유효한 Forge Framework 스킬이다. 5줄의 YAML. 나머지는 프레임워크가 처리한다.

### 파일 위치 구조

```
~/.claude/skills/
  my-skill/
    SKILL.md          ← 필수 (매니페스트 + 지시문)
    templates/        ← 선택 (pipeline.json, 에이전트 프롬프트)
    agents/           ← 선택 (커스텀 에이전트 프롬프트 파일)
```

프레임워크는 `SessionStart` 시점에 `skills/`의 모든 하위 디렉터리를 스캔한다. 유효한 `name`과 `description`이 있는 `SKILL.md`를 포함한 디렉터리는 스킬 카탈로그에 자동 등록된다.

### Gatekeeper가 라우팅하는 방식

매 사용자 턴마다 Haiku 서브에이전트(Gatekeeper)가 스킬 카탈로그를 읽고 사용자 프롬프트를 분류한다:

```
사용자 프롬프트 → Gatekeeper (Haiku) → { skill: "my-skill", confidence: 0.89, ... }
                                               ↓
                                        프레임워크가 my-skill로 라우팅
                                        파이프라인 엔진 초기화
                                        Gate Guard 활성화
```

Gatekeeper는 각 스킬의 `description`과 `routing.triggers`를 기준으로 프롬프트를 매칭한다. 명확하고 구체적인 설명이 모호한 설명을 이긴다. 신뢰도(Confidence)가 높으면(> 0.85) 바로 라우팅하고, 낮으면 기본 `forge-dev` 스킬로 폴백(Fallback)한다.

---

## 3. Level 0: 기본 라우팅 (Basic Routing)

최소한의 스킬 — 트리거(Triggers)와 설명(Description)만 있으면 된다. 파이프라인 커스터마이징도, 워크스페이스 스코핑도 없다. 나머지는 프레임워크가 기본값으로 처리한다.

```yaml
---
name: docs-writer
description: |
  기술 문서, README, API 문서, 변경 이력(Changelog)을 작성하고 업데이트한다.
  문서 생성 또는 수정 작업 전반에 사용한다.
routing:
  triggers:
    - write docs
    - update README
    - API documentation
    - changelog
    - document this
    - 문서 작성
    - README 수정
    - API 문서
    - 변경 이력
    - 문서화
  anti-triggers:
    - code explanation only
    - just describe
    - 코드 설명만
    - 어떻게 작동하는지 설명
  priority: normal
  categories:
    - docs
---

# docs-writer

명확하고 정확한 문서를 작성한다...
```

### Gatekeeper의 분류 결과

Gatekeeper는 분류 객체(Classification Object)를 생성한다:

```json
{
  "category": "docs",
  "skill": "docs-writer",
  "confidence": 0.92,
  "config": { "mode": "standard", "type": "docs", "scale": "small" }
}
```

`category`는 의도 유형에 매핑된다. `skill`은 결정된 스킬 이름이다. `confidence`는 라우팅 강도를 결정한다.

### Anti-trigger로 오탐(False Positive) 줄이기

Anti-trigger는 트리거가 매칭되더라도 **라우팅하지 말아야 할** 경우를 Gatekeeper에게 알려준다:

```yaml
routing:
  triggers:
    - deploy
    - release
    - rollback
    - 배포
    - 릴리즈
    - 롤백
  anti-triggers:
    - "explain deployment"
    - "what is a deployment"
    - "how does deploy work"
    - "배포란 무엇"
    - "배포 방법 설명"
    - "배포 프로세스를 설명해줘"
```

인접 도메인(Adjacent Domain)에서는 anti-trigger를 적극적으로 활용한다. 예를 들어 배포를 실행하는 스킬과 별도의 `docs-writer` 스킬이 공존한다면, 배포 스킬에 `"deployment docs"` anti-trigger를 추가해 문서 요청이 배포 스킬을 잘못 트리거하지 않도록 한다.

### 우선순위(Priority) 설정

```yaml
routing:
  priority: high    # high | normal | low
```

두 스킬이 비슷한 신뢰도로 동시에 매칭될 때 `priority`가 결정권을 갖는다. `high`는 아껴 써야 한다 — 더 많은 프롬프트를 가로채려는 용도가 아니라, 해당 도메인을 진정으로 소유하는 스킬에만 사용해야 한다. `forge-dev`는 모든 코드 수정 작업을 소유하기 때문에 `high`를 사용한다.

---

## 4. Level 1: 커스텀 파이프라인 (Custom Pipeline)

파이프라인 정의를 추가해 스킬의 실행 단계를 변경한다.

### `templates/pipeline.json` 생성

`~/.claude/skills/my-skill/templates/pipeline.json`에 파이프라인 정의를 작성한다:

```json
{
  "name": "my-skill-pipeline",
  "steps": [
    {
      "name": "init",
      "actor": "pm",
      "gate": null,
      "produces": ["meta.json"]
    },
    {
      "name": "research",
      "actor": "agent",
      "gate": "meta.json",
      "produces": ["research.md"]
    },
    {
      "name": "execute",
      "actor": "agent",
      "gate": "research.md",
      "produces": ["output/"]
    },
    {
      "name": "finalize",
      "actor": "pm",
      "gate": "execute:done",
      "produces": ["report.md"]
    }
  ]
}
```

그런 다음 매니페스트에 선언한다:

```yaml
framework:
  pipeline: my-skill-pipeline
```

### 게이트(Gate)와 산출물(Produces)을 사용한 스텝 정의

각 스텝은 네 가지 필드를 갖는다:

| 필드 | 역할 |
|---|---|
| `name` | 스텝 식별자 — 엔진 명령에서 사용 |
| `actor` | `"pm"` (최상위 턴의 Claude 직접 실행) 또는 `"agent"` (서브에이전트 위임) |
| `gate` | 이 스텝이 실행되기 전에 반드시 존재해야 하는 아티팩트(Artifact) 또는 조건 |
| `produces` | 이 스텝이 반드시 생성해야 하는 아티팩트 (엔진이 완료 후 검증) |

게이트(Gate)는 파이프라인의 무결성(Integrity) 메커니즘이다. 엔진은 게이트 조건이 충족되지 않은 스텝으로의 전환(Transition)을 거부한다. 이를 통해 계획(Plan)이 없는 상태에서 코드를 실행하는 흔한 실패 패턴을 방지한다.

### 프레임워크 제공 스텝 활용

모든 스텝을 처음부터 정의할 필요는 없다. 프레임워크는 재사용 가능한 스텝 구현을 제공한다:

- `init` — `meta.json`과 `workspace-context.json` 생성
- `checkpoint` — 코드 변경 전 사용자 승인을 위한 일시 중단
- `finalize` — `report.md` 작성, git finalize 실행, 락(Lock) 정리

파이프라인 정의에서 이름으로 참조하면 내장 로직이 자동으로 실행된다.

### 기존 파이프라인 상속

처음부터 정의하는 대신 기존 파이프라인을 확장할 수 있다:

```yaml
framework:
  pipeline: forge-dev-standard   # 표준 파이프라인 상속
```

이렇게 하면 스킬에 `research → plan → execute → verify → finalize` 전체 흐름과 모든 게이트가 적용된다. 스킬의 매니페스트는 라우팅과 워크스페이스 스코프만 오버라이드한다.

---

## 5. Level 2: 워크스페이스 스코핑 (Workspace Scoping)

스킬이 읽거나 쓸 수 있는 파일을 선언한다. Gate Guard(`core/gate-guard.js`)가 `PreToolUse` 훅에서 이를 강제한다 — 선언된 스코프 밖의 파일 접근은 도구가 실행되기도 전에 하드 블록(Hard Block)된다.

### scope, readonly, ignore 배열

```yaml
framework:
  workspace:
    scope:
      - "src/"          # 읽기/쓰기 허용
      - "tests/"
      - "package.json"
    readonly:
      - "docs/"         # 읽기만 허용, 쓰기 차단
      - "CHANGELOG.md"
    ignore:
      - "src/generated/" # 모든 접근 차단
      - "*.lock"
```

우선순위 (높음 → 낮음): `ignore` > `readonly` > `scope` > 스코프 외부.

- `scope` — 스킬이 읽고 쓸 수 있는 파일
- `readonly` — 읽을 수는 있지만 쓸 수 없는 파일
- `ignore` — 아예 접근 불가 (읽기도 쓰기도 안 됨)

프레임워크는 선언 여부에 상관없이 다음 경로를 항상 `ignore`에 추가한다:

```
node_modules/**
.git/**
dist/**
.forge/**
```

### Gate Guard의 스코프 적용 방식

Gate Guard는 모든 `Edit`, `Write`, `Bash` 도구 호출 시 실행된다. 현재 파이프라인 아티팩트 디렉터리에서 `workspace-context.json`을 로드하고 `classifyFile(absFilePath, context)`를 호출한다. 반환값은 다음 중 하나다:

- `"scope"` — 허용됨, 파이프라인 게이트 적용
- `"readonly"` — 읽기 허용, 쓰기 차단 (exit 2)
- `"ignore"` — 모든 접근 차단 (exit 2)
- `"out-of-scope"` — 활성 컨텍스트가 있으면 차단 (exit 2)

활성 파이프라인 컨텍스트가 없으면, Gate Guard는 보수적인 `isCodeFile` 검사로 폴백한다. 활성 파이프라인 없이 코드를 수정하려는 시도는 차단된다.

### 워크스페이스 컨텍스트 API (Workspace Context API)

프레임워크는 `core/workspace-context.js`에서 다음 함수들을 제공한다:

| 함수 | 역할 |
|---|---|
| `createContext(root, stackProfile, artifactDir)` | `engine-init` 중 `workspace-context.json` 생성 |
| `loadContext(artifactDir, cwd)` | 활성 파이프라인의 워크스페이스 컨텍스트 로드 |
| `classifyFile(absFilePath, context)` | `"scope"`, `"readonly"`, `"ignore"`, `"external"`, `"out-of-scope"` 중 하나 반환 |
| `expandScope(artifactDir, cwd, pattern, reason, step)` | 런타임 중 `scope_expansions`에 경로 추가 |

보통 이 함수들을 직접 호출할 일은 없다 — 파이프라인 엔진과 Gate Guard가 내부적으로 사용한다. 그러나 디버깅할 때 유용하다:

```bash
# 런타임 중 스코프 확장 (예: 스킬이 마이그레이션 파일을 생성해야 할 때)
node core/pipeline-engine.js engine-expand-scope .forge/2026-03-21/my-session "migrations/**" "new migration needed" "execute"
```

### detect-stack 자동 스코프

수동 스코프 선언을 건너뛰고 엔진이 자동으로 감지하게 할 수 있다:

```yaml
framework:
  workspace:
    auto_scope: true
```

`engine-init`이 내부적으로 `detect-stack`을 호출하며, 알려진 프로젝트 레이아웃을 기본 스코프에 매핑한다:

| 스택 | 자동 스코프 |
|---|---|
| Express | `src/routes/`, `src/middleware/`, `tests/` |
| React | `src/pages/`, `src/components/`, `tests/` |
| Flask | `app/`, `tests/`, `migrations/` |
| Go | `cmd/`, `internal/`, `pkg/`, `*_test.go` |

자동 스코프는 합리적인 기본값이다. 프로젝트 레이아웃이 관례에서 벗어나는 경우에만 특정 경로를 오버라이드한다.

---

## 6. Level 3: 품질 체크 (Quality Checks)

품질 시스템은 실행 이후, 파이널라이즈(Finalize) 이전에 검증 레이어를 실행한다. 품질 체크에 실패하면 `finalize` 스텝이 차단된다.

### 품질 레이어 상속

`inherit: true`로 프레임워크 기본 품질 레이어(빌드 검증, 테스트 검증, 린트)를 그대로 받는다:

```yaml
framework:
  quality:
    inherit: true
```

이것이 권장 기본값이다. `forge-dev`가 강제하는 품질 게이트를 스킬이 우회하지 않도록 보장한다.

### 커스텀 검증 레이어 추가

상속된 레이어 위에 추가 레이어를 얹는다:

```yaml
framework:
  quality:
    inherit: true
    add_layers:
      - { name: "security-scan", after: "build" }
      - { name: "schema-validate", after: "test" }
```

각 레이어는 `after`에 지정된 스텝 이후 순서대로 실행된다. 엔진은 레이어 정의에 명시된 명령으로 `engine-verify-build` 또는 `engine-verify-tests`를 호출하고, 결과를 `pipeline-state.json`에 기록한다.

### 빌드/테스트 검증

엔진이 제공하는 두 가지 검증 명령을 파이프라인의 `verify` 스텝에서 명시적으로 호출한다:

```bash
node "$FORGE_ENGINE" engine-verify-build <artifact_dir> "npm run build"
node "$FORGE_ENGINE" engine-verify-tests <artifact_dir> "npm test"
```

둘 다 `{ "passed": true }` 또는 `{ "passed": false, "reason": "..." }`를 반환한다. `false` 결과는 엔진이 `finalize`로 전환하지 못하게 막는다 (Gate 3: 빌드/테스트 실패 시 커밋 하드 블록).

---

## 7. Level 4: 에이전트 프롬프트 (Agent Prompts)

완전 자율(Fully Autonomous) 스킬은 각 파이프라인 스텝에 전문화된 서브에이전트를 위임한다. 파이프라인 엔진이 생성과 조율을 관리하고, 스킬은 에이전트 프롬프트 파일을 제공한다.

### 에이전트 프롬프트 파일 생성

스킬 디렉터리의 `agents/` 아래에 에이전트 프롬프트를 배치한다:

```
~/.claude/skills/my-skill/
  agents/
    researcher.md     ← research 스텝용 프롬프트
    executor.md       ← execute 스텝용 프롬프트
    verifier.md       ← verify 스텝용 프롬프트
```

엔진은 파이프라인 스텝에 선언된 `actor` 역할을 기반으로 적절한 프롬프트 파일을 로드한다. 에이전트는 프롬프트에 더해 주입된 컨텍스트(workspace-context.json, pipeline-state.json, 이전 스텝 아티팩트)를 함께 받는다.

### 모델 라우팅 (haiku / sonnet / opus)

비용 대 품질을 조정하기 위해 스텝별 모델 프로파일을 선언한다:

```yaml
framework:
  model_routing:
    research: haiku     # 빠르고 저렴 — 스캔 및 요약
    plan:     sonnet    # 균형 — 계획 수립 및 구조화
    execute:  sonnet    # 균형 — 코드 생성
    verify:   sonnet    # 균형 — 정확성 검토
```

또는 호출 시 전역 `--model` 플래그를 사용한다:

```
/forge implement JWT auth --model quality   # 모든 스텝에 opus 강제
/forge fix typo --model budget              # 모든 스텝에 haiku 강제
```

모델 플래그 매핑: `budget` = Haiku, `balanced` = Sonnet (기본값), `quality` = Opus.

### 파이프라인 엔진을 통한 에이전트 위임

PM(최상위 턴의 Claude)이 위임을 주도한다:

```bash
# 다음 스텝과 로드할 내용 확인
node "$FORGE_ENGINE" engine-transition <artifact_dir> research

# 해당 스텝의 에이전트 스펙 조회
node "$FORGE_ENGINE" engine-dispatch-spec <artifact_dir> researcher

# ... 에이전트 위임, 에이전트 실행, research.md 생성 ...

# 결과 기록
node "$FORGE_ENGINE" engine-record-result <artifact_dir> researcher task-001 PASS
```

모든 명령은 JSON을 반환한다. 그것을 읽고, 그것을 따른다. 다음 스텝을 추측하지 않는다 — 엔진이 게이트 의존성을 알고 있으며, 추측하면 Gate Guard 차단을 트리거한다.

---

## 8. 스킬 매니페스트 레퍼런스

지원되는 모든 필드를 포함한 전체 YAML 스키마:

```yaml
---
# 필수 (Required)
name: my-skill                      # 고유 식별자, kebab-case
description: |                      # Gatekeeper가 라우팅에 사용 — 구체적으로 작성
  이 스킬이 정확히 무엇을 하는지 한두 문장으로 설명한다.
  사용자가 이 스킬을 원할 때 실제로 입력할 핵심 명사와 동사를 포함한다.

# 라우팅 (triggers 외 모든 필드 선택)
routing:
  triggers:                         # 스킬을 활성화하는 키워드/문구
    - keyword1
    - "multi word phrase"
    - 한국어키워드
    - "한국어 복합 문구"
  anti-triggers:                    # 이 스킬을 활성화해서는 안 될 문구
    - "just explain"
    - "what is"
    - "설명만 해줘"
    - "어떻게 작동해"
  modes:                            # 이름 있는 서브 모드와 설명
    standard: "전체 파이프라인"
    quick: "경량화 버전"
  priority: normal                  # high | normal | low (기본값: normal)
  categories:                       # 의도 카테고리: code-modify, docs, analysis, command
    - code-modify

# 프레임워크 통합 (모든 필드 선택)
framework:
  pipeline: pipeline-name           # 사용할 파이프라인 정의 (기본값: forge-dev-standard)
  gates:                            # 추가로 강제할 게이트 이름
    - build-pass
    - test-pass
  workspace:
    scope:                          # 스킬이 읽고 쓸 수 있는 경로
      - "src/"
      - "tests/"
    readonly:                       # 읽을 수는 있지만 쓸 수 없는 경로
      - "docs/"
    ignore:                         # 접근 불가 경로
      - "src/generated/"
    auto_scope: false               # true로 설정 시 detect-stack 자동 스코프 사용
  quality:
    inherit: true                   # 프레임워크 기본 품질 레이어 상속
    add_layers:                     # 커스텀 검증 레이어 추가
      - { name: "security-scan", after: "build" }
  model_routing:                    # 스텝별 모델 오버라이드
    research: haiku
    execute: sonnet
---

스킬 지시문 본문 — 스킬이 활성화되면 Claude가 읽는 내용이다.
명확하고 명령형(Imperative)으로 작성한다. 파이프라인 스텝을 참조한다.
어떤 아티팩트를 생성해야 하는지, 어떤 품질 기준을 충족해야 하는지 명시한다.
```

---

## 9. 모범 사례 (Best Practices)

### 설명은 구체적이고 키워드가 풍부하게

Gatekeeper는 `description` 필드를 가장 먼저 매칭한다. "다양한 코드 작업을 수행합니다" 같은 모호한 설명은 "기능 구현, 버그 수정, 코드 리팩토링을 수행합니다" 같은 구체적인 설명에 진다. 사용자가 실제로 입력할 정확한 동사와 명사를 포함시킨다.

### 트리거는 한국어와 영어 모두 작성

Gatekeeper는 다국어 프롬프트를 처리한다. 사용자가 한국어로 작성한다면, 한국어 트리거를 영어와 함께 추가한다:

```yaml
triggers:
  - deploy
  - 배포
  - release
  - 릴리즈
  - rollback
  - 롤백
  - 스테이징에 배포
  - 프로덕션 릴리즈
```

### 인접 도메인에는 anti-trigger 사용

두 스킬이 어휘를 공유할 때 (예: `deploy` 스킬과 `docs-writer` 스킬이 모두 "deployment"에 매칭) 각각에 anti-trigger를 추가해 경계를 명확히 한다. Anti-trigger는 신뢰도 임계값을 조정하는 것보다 훨씬 저렴한 방법이다.

### 관례 우선, 설정 최소화

`skills/security-audit/SKILL.md`에 `name: security-audit`만 있으면 설정 없이 자동 감지된다. 기본 `forge-dev-standard` 파이프라인이 스킬의 워크플로에 진정으로 맞지 않을 때만 `framework.pipeline`을 추가한다. 모든 커스텀 설정 필드는 유지 보수 부담이다.

### Level 0부터 시작해서 필요할 때만 레벨 업

워크스페이스 스코핑은 스킬이 프로젝트 루트 밖에서 동작해야 할 때 추가한다. 품질 레이어는 도메인에 특정 검증 요구사항이 있을 때 추가한다 (예: 데이터베이스 마이그레이션 스킬은 스키마 무결성을 검증해야 한다). 투기적으로(Speculatively) 필드를 추가하지 않는다.

### 다양한 프롬프트 스타일로 테스트

Gatekeeper는 구조화된 명령이 아닌 자연어를 처리한다. 짧은 프롬프트("배포 스크립트 고쳐줘"), 긴 프롬프트, 오타, 혼합 언어로 스킬을 테스트한다. 어느 경우에서든 라우팅에 실패하면 설명을 강화하거나 트리거를 추가한다.

### 프로덕션 배포 전 `engine-state`로 검증

```bash
node "$FORGE_ENGINE" engine-state <artifact_dir>
```

현재 파이프라인 상태를 JSON으로 출력한다 — 어떤 스텝이 실행됐는지, 어떤 아티팩트가 있는지, 엔진이 다음에 무엇을 기대하는지 확인할 수 있다. 스킬을 다른 사람에게 배포하기 전에 파이프라인 정의가 의도대로 동작하는지 검증한다.

---

## 10. 문제 해결 (Troubleshooting)

### 스킬이 트리거되지 않는 경우

Gatekeeper가 스킬로 라우팅하지 않은 경우다.

1. `SKILL.md`가 `skills/`의 하위 디렉터리 안에 있는지 확인한다 (`skills/` 바로 아래에 있으면 안 됨).
2. 프론트매터에 `name`과 `description`이 모두 있는지 확인한다.
3. 설명을 더 구체적으로 만든다 — 일반적인 설명은 구체적인 설명에 진다.
4. 트리거를 더 추가한다. 동의어, 사용자가 실제로 입력하는 문구를 포함한다.
5. 세션 시작 시 `core/gatekeeper-init.js` 출력을 확인한다 — 빌드된 스킬 카탈로그를 로그에 출력한다. 카탈로그에 없는 스킬은 감지되지 않은 것이다.

### Gate Guard가 파일 접근을 차단하는 경우

```
Gate Guard: BLOCKED — file out of scope: src/config/secrets.js
```

1. 파일 또는 상위 디렉터리를 `framework.workspace.scope`에 추가한다.
2. 파일을 읽을 수만 있어야 한다면 `readonly`에 추가한다.
3. 의도하지 않은 파일에서 차단이 발생한다면, 에이전트 프롬프트가 너무 광범위한 것 — 지시문을 좁힌다.
4. `engine-state`를 실행해 `workspace-context.json`이 올바르게 작성됐는지 확인한다.

### 파이프라인이 멈춰서 다음 스텝으로 넘어가지 않는 경우

```
{"allowed": false, "reason": "Missing required artifacts: research.md"}
```

게이트 아티팩트가 없어 엔진이 전환을 거부한 경우다.

1. `engine-state <artifact_dir>`을 실행해 어떤 아티팩트가 존재하는지 확인한다.
2. 이전 스텝의 에이전트가 실제로 아티팩트 디렉터리에 기대하는 아티팩트를 작성했는지 확인한다.
3. 파이프라인 정의의 `produces`를 확인한다 — 파일명이 정확히 일치해야 한다 (대소문자 구분).
4. 중단된 실행을 재개하는 경우, `/forge --resume`으로 엔진이 상태를 조정하게 한다.

### finalize 단계에서 품질 게이트가 실패하는 경우

Gate 3(빌드 실패로 커밋) 또는 Gate 4(검증 없이 리포트)가 차단하고 있는 경우다.

1. `engine-verify-build`와 `engine-verify-tests`를 수동으로 실행해 에러 출력을 확인한다.
2. finalize를 재시도하기 전에 근본적인 빌드 또는 테스트 실패를 수정한다.
3. 이를 우회하기 위해 quality에 `inherit: false`를 설정하지 않는다 — 근본 원인을 해결한다.

### 두 스킬이 동시에 트리거되는 경우 (라우팅 충돌)

1. **이겨서는 안 될** 스킬에 anti-trigger를 추가한다.
2. 이 도메인에서 **항상 이겨야 할** 스킬에 `priority: high`를 설정한다.
3. 겹침이 근본적이라면 (두 스킬이 진정으로 같은 일을 한다), `modes`를 사용해 하나의 스킬로 병합한다.

---

## 부록: deploy 스킬 예제 분석

실제 프로덕션 스킬(`examples/deploy-skill/SKILL.md`)을 보면 앞서 설명한 모든 레벨이 어떻게 조합되는지 확인할 수 있다.

**라우팅 설정의 핵심 포인트:**
- 한/영 트리거 혼용: `배포`, `롤백`, `스테이징 배포` 등
- `priority: high` — 배포 도메인의 명확한 소유권
- anti-trigger가 "설명" 요청을 명확히 차단

**워크스페이스 스코핑 전략:**
- `scope`: `infra/**`, `k8s/**`, `Dockerfile`, CI 설정만 허용
- `readonly`: `src/**` — 소스 코드는 읽기만 가능, 배포 스킬이 비즈니스 로직을 건드리지 못하도록 강제
- 이 조합으로 "배포 스킬이 실수로 소스 코드를 수정하는" 사고를 구조적으로 차단

**품질 레이어 확장:**
```yaml
quality:
  inherit: true
  add_layers:
    - { name: "security-scan", after: "build" }    # 이미지 보안 스캔
    - { name: "config-drift-check", after: "validate" }  # 설정 드리프트 검사
```
기본 품질 레이어 위에 배포 도메인 특화 검증을 추가하는 패턴이다.
