# Forge Framework v8.0 "Nova" — 시작 가이드 (한국어)

> 설치부터 첫 번째 파이프라인 실행까지, A to Z 완전 가이드.

---

## 목차

1. [소개](#1-소개)
2. [사전 요구사항](#2-사전-요구사항)
3. [설치](#3-설치)
4. [환경 구성](#4-환경-구성)
5. [처음 사용하기](#5-처음-사용하기)
6. [문제 해결 (FAQ)](#6-문제-해결-faq)
7. [다음 단계](#7-다음-단계)

---

## 1. 소개

### Forge Framework v8.0 "Nova"란?

Forge Framework v8.0 "Nova"는 Claude Code 위에서 동작하는 **스킬 실행 플랫폼**입니다.

v7.0까지의 `forge`는 하나의 스킬이었습니다. v8.0 "Nova"는 패러다임이 바뀌었습니다. 이제 forge는 모든 스킬이 그 위에서 실행되는 **플랫폼 그 자체**입니다. 코드 수정 요청이 들어오면 Haiku 기반 Gatekeeper가 의도를 분류하고, 적합한 스킬로 라우팅하고, Pipeline Engine이 단계별로 실행하고, Gate Guard가 품질과 범위를 강제합니다.

즉, 개발자가 파이프라인을 직접 관리하지 않아도 됩니다. 프레임워크가 관리합니다.

### 기존 방식 vs Nova 방식 비교

| 항목 | 기존 방식 (Claude Code 단독) | Nova 방식 (Forge Framework v8.0) |
|---|---|---|
| **코드 수정 진입** | 프롬프트 입력 → 즉시 수정 | 의도 분류 → 스킬 라우팅 → 파이프라인 실행 |
| **파일 접근 제어** | 없음 (모든 파일 자유 접근) | Gate Guard가 워크스페이스 범위 강제 |
| **파이프라인** | 없음 (1회성 응답) | 단계별 실행 (research → plan → execute → verify → finalize) |
| **품질 검사** | 없음 | 7계층 품질 스택 (자체 검사, 피어 리뷰, QA 게이트 등) |
| **스킬 라우팅** | 수동 명령 필요 | Gatekeeper가 자동 분류 및 라우팅 |
| **모드 선택** | 없음 | 상황에 맞는 6가지 파이프라인 모드 |
| **에이전트 모델** | 단일 모델 | 역할별 Haiku / Sonnet / Opus 자동 배정 |

### 이 가이드에서 다루는 것

- 설치 전 요구사항 확인
- 리포지토리 클론부터 hook 등록까지 단계별 설치
- 기본 및 고급 환경 구성
- 첫 번째 `/forge` 명령 실행 및 파이프라인 흐름 이해
- 자주 발생하는 문제와 해결 방법

---

## 2. 사전 요구사항

### Claude Code 설치

Forge Framework는 **Claude Code** 위에서 동작합니다. Claude Code는 Anthropic의 공식 CLI 도구입니다.

- **Claude Max 또는 Pro 구독** 필요 (Claude Code 사용 조건)
- 설치 방법: [Claude Code 공식 문서](https://docs.anthropic.com/claude-code) 참조
- 설치 후 터미널에서 `claude` 명령이 동작하는지 확인하세요.

### Node.js 18 이상

install.js와 모든 hook 스크립트는 Node.js로 실행됩니다.

```bash
# 버전 확인
node --version
# v18.x.x 이상이어야 합니다
```

Node.js가 없거나 버전이 낮다면 [nodejs.org](https://nodejs.org) 에서 LTS 버전을 설치하세요. nvm을 사용 중이라면:

```bash
nvm install --lts
nvm use --lts
```

### Git

리포지토리 클론 및 파이프라인의 git 작업에 필요합니다.

```bash
# 설치 확인
git --version
# git version 2.x.x 이상이면 됩니다
```

Git이 없다면 [git-scm.com](https://git-scm.com) 에서 설치하세요.

### 터미널 기본 사용법 (초보자 안내)

이 가이드에 나오는 모든 명령은 터미널(macOS: Terminal.app 또는 iTerm2, Linux: bash/zsh, Windows: WSL2 권장)에서 실행합니다.

- `#`으로 시작하는 줄은 주석입니다. 실행하지 않아도 됩니다.
- `~`는 홈 디렉터리(`/home/사용자명` 또는 `/Users/사용자명`)를 의미합니다.
- 명령 실행 후 에러가 없으면 정상입니다.

---

## 3. 설치

총 4단계입니다. 순서대로 따라하면 됩니다.

---

### Step 1: 리포지토리 클론

```bash
git clone https://github.com/EcoKG/forge-skills.git ~/.claude/skills/forge-skills
```

**이 경로가 왜 중요한가?**

`~/.claude/skills/`는 Claude Code가 스킬을 자동으로 탐색하는 디렉터리입니다. 세션이 시작될 때 이 경로 아래의 모든 서브디렉터리를 스캔하여 `SKILL.md`가 있는 것을 스킬 카탈로그에 등록합니다. 경로가 다르면 Gatekeeper가 스킬을 인식하지 못합니다.

클론이 완료되면 다음 구조가 생성됩니다:

```
~/.claude/skills/forge-skills/
  forge-framework/       ← 프레임워크 코어
    core/                ← hook 스크립트들
    skills/forge-dev/    ← 내장 개발 스킬
    docs/                ← 이 문서를 포함한 가이드
  ...
```

---

### Step 2: Hook 설치

```bash
node ~/.claude/skills/forge-skills/forge-framework/core/install.js
```

**이 명령이 하는 일:**

이 스크립트는 `~/.claude/settings.json`에 6개의 hook을 등록합니다.

| Hook ID | 이벤트 | 역할 |
|---|---|---|
| `tracker` | PostToolUse | 컨텍스트 모니터 + 에이전트 디스패치 추적 + 빌드/테스트 감지 |
| `statusline` | Notification | 프로젝트/파이프라인 상태를 상태바에 표시 |
| `orchestrator` | UserPromptSubmit | 파이프라인 상태 주입 + 크래시 복구 + 프로젝트 컨텍스트 |
| `gate-guard` | PreToolUse | 9개 게이트 — 8개 하드 블록 + 1개 경고 |
| `gatekeeper-init` | SessionStart | 스킬 카탈로그 스캔 + 세션 시작 시 상태 초기화 |
| `gatekeeper-router` | UserPromptSubmit | 의도 분류 + 스킬 라우팅 |

또한 v7.0 이하의 레거시 hook(`skill-activation`, `skill-activation-guard`, `skill-activation-stop` 등)을 자동으로 제거합니다. 업그레이드 시 충돌을 방지하기 위한 조치입니다.

설치 성공 시 출력 예시:

```
Forge Hooks Installer
────────────────────────────────────────
  tracker — installed (PostToolUse)
  statusline — installed (Notification)
  orchestrator — installed (UserPromptSubmit)
  gate-guard — installed (PreToolUse)
  gatekeeper-init — installed (SessionStart)
  gatekeeper-router — installed (UserPromptSubmit)

Done: 6 installed, 0 skipped (already present)
```

**설치 확인:**

```bash
node ~/.claude/skills/forge-skills/forge-framework/core/install.js verify
```

모든 hook에 대해 `registered + script exists` 가 표시되면 정상입니다.

```
Forge Hooks Verifier
────────────────────────────────────────
  tracker — registered + script exists
  statusline — registered + script exists
  orchestrator — registered + script exists
  gate-guard — registered + script exists
  gatekeeper-init — registered + script exists
  gatekeeper-router — registered + script exists

Verify: 6 OK, 0 FAILED
```

---

### Step 3: Claude Code 재시작

hook은 설치 시점에 `settings.json`에 기록되지만, 실행 중인 Claude Code 세션에는 즉시 반영되지 않습니다. **반드시 재시작이 필요합니다.**

- IDE에서 Claude Code 패널을 닫고 다시 여세요.
- 또는 Claude Code 터미널에서 `/clear` 명령을 실행하세요 (세션 초기화).

재시작 후 `SessionStart` 이벤트가 발생하면 `gatekeeper-init` hook이 자동으로 실행되고 스킬 카탈로그가 구성됩니다.

---

### Step 4: 설치 확인

재시작 후 아래 두 가지 테스트로 정상 설치 여부를 확인합니다.

**테스트 1 — 일반 대화 (Gatekeeper: meta 분류)**

```
안녕
```

기대 결과: Gatekeeper가 `meta` 카테고리로 분류하고 Claude가 자유롭게 응답합니다. 파이프라인 없이 일반 대화가 진행되면 정상입니다.

**테스트 2 — 코드 수정 요청 (Gatekeeper: code-modify 분류)**

```
캐싱 추가해줘
```

기대 결과: Gatekeeper가 `code-modify`로 분류하고 `/forge` 스킬 호출을 제안합니다. 직접 코드를 수정하려 하지 않고 파이프라인 시작을 안내하면 정상입니다.

---

## 4. 환경 구성

### 4.1 기본 설정 (대부분의 사용자에게 권장)

설치만 완료하면 별도 설정 없이 기본값으로 동작합니다.

- **Gatekeeper**: 로컬 키워드 기반 분류 (API 비용 없음, 빠름)
- **Gate Guard**: 코드 수정 시 파이프라인 강제 (항상 활성)
- **Pipeline Engine**: 요청 규모에 따라 자동 모드 선택

대부분의 개인 개발자에게는 이 기본값으로 충분합니다. 아래 고급 설정은 필요할 때만 참고하세요.

---

### 4.2 고급 설정 (선택 사항)

#### Gatekeeper에 LLM 활성화

기본 키워드 분류기가 애매한 의도를 가끔 잘못 분류할 수 있습니다. Haiku LLM을 활성화하면 분류 정확도가 높아집니다.

환경 변수로 설정합니다 (셸 프로필 `~/.bashrc` 또는 `~/.zshrc`에 추가):

```bash
export GATEKEEPER_LLM_ENABLED=true
```

단, Haiku API 호출 비용이 발생합니다. Anthropic API 키가 설정되어 있어야 합니다.

#### Gatekeeper 비활성화

Gate Guard만 남기고 Gatekeeper를 끄고 싶다면:

```bash
export GATEKEEPER_ENABLED=false
```

이 경우 자동 라우팅이 비활성화됩니다. 코드 수정이 필요할 때 수동으로 `/forge` 명령을 입력해야 합니다. Gate Guard는 여전히 작동하므로 보안 수준은 유지됩니다.

#### 모델 언인스톨

모든 hook을 제거하고 싶다면:

```bash
node ~/.claude/skills/forge-skills/forge-framework/core/install.js uninstall
```

---

### 4.3 프로젝트별 설정

프로젝트 루트에 `.forge/config.json`을 생성하면 해당 프로젝트에만 적용되는 설정을 할 수 있습니다. 전역 설정보다 프로젝트 설정이 우선합니다.

주요 설정 항목:

```json
{
  "gitBranching": "auto",
  "modelProfile": "balanced",
  "skipTests": false,
  "workspaceRoot": "."
}
```

| 항목 | 기본값 | 설명 |
|---|---|---|
| `gitBranching` | `"auto"` | `"auto"`: 파이프라인마다 브랜치 생성, `"none"`: 브랜치 생성 안 함 |
| `modelProfile` | `"balanced"` | `"quality"`: Opus 중심, `"balanced"`: Sonnet 중심, `"budget"`: Haiku 중심 |
| `skipTests` | `false` | `true`로 설정하면 verify 단계에서 테스트 실행 생략 |
| `workspaceRoot` | `"."` | 파이프라인이 접근 가능한 루트 경로 |

---

### 4.4 프로젝트 초기화

새 프로젝트에서 처음 forge를 사용할 때 초기화를 실행하면 프로젝트 구조를 자동으로 파악합니다.

```
# Claude Code에서:
/forge --init
```

이 명령은 다음을 수행합니다:

1. 프로젝트 디렉터리 스캔
2. 기술 스택 감지 (언어, 프레임워크, 테스트 도구)
3. `.forge/` 디렉터리 및 `config.json` 생성
4. 언어별 품질 체크리스트 로드

초기화는 선택 사항입니다. 하지 않아도 forge는 동작하지만, 초기화 후에는 파이프라인이 프로젝트 컨텍스트를 더 정확하게 파악합니다.

---

## 5. 처음 사용하기

### 5.1 첫 번째 명령

아무 프로젝트 디렉터리에서 Claude Code를 열고 다음을 입력해보세요:

```
/forge "README.md에 프로젝트 설명 추가해줘"
```

파이프라인이 다음 순서로 진행됩니다:

```
① init       — 워크스페이스 컨텍스트 생성, 파이프라인 상태 초기화
② research   — 프로젝트 구조 파악, README 현재 내용 분석
③ plan       — 추가할 내용의 구조 설계, 변경 범위 확정
④ execute    — README.md 실제 수정
⑤ verify     — 변경 내용 검토, 품질 게이트 통과 확인
⑥ finalize   — 커밋 메시지 작성, git 정리, report.md 생성
```

각 단계는 Pipeline Engine이 자동으로 관리합니다. Gate Guard는 각 도구 호출 전에 현재 단계에서 허용된 작업인지 확인합니다. 단계를 건너뛰거나 역순으로 실행하는 것은 차단됩니다.

---

### 5.2 파이프라인 모드 선택 가이드

모든 요청에 전체 파이프라인이 필요한 것은 아닙니다. 상황에 따라 적절한 모드를 선택하면 불필요한 단계를 건너뛸 수 있습니다.

| 상황 | 명령 예시 | 파이프라인 |
|---|---|---|
| 오타 1개 수정 | `/forge --trivial "오타 수정"` | init → execute |
| 단일 파일 버그 수정 | `/forge --quick "null 체크 누락 수정"` | plan → execute → verify |
| 새 기능 추가 | `/forge "JWT 인증 추가"` | 전체 파이프라인 (6단계) |
| 코드 분석만 | `/forge --analyze "보안 감사"` | init → analyze → finalize |
| 버그 디버깅 | `/forge --debug "로그인 오류"` | reproduce → hypothesize → fix |
| 중단된 작업 재개 | `/forge --resume` | 마지막 완료 단계 이후부터 |

모드를 명시하지 않으면 Gatekeeper가 요청 내용과 규모를 분석하여 자동으로 선택합니다. 처음에는 플래그 없이 사용해도 됩니다.

---

### 5.3 요청 타입 플래그 (선택 사항)

자동 감지가 잘못 분류되는 경우 `--type`으로 명시할 수 있습니다:

```
/forge --type code-bug "로그인 후 세션이 유지되지 않음"
/forge --type analysis-security "OWASP Top 10 감사"
/forge --type infra "Docker 컨테이너 환경 설정"
```

| `--type` 값 | 적용 상황 |
|---|---|
| `code` | 일반 기능 구현 |
| `code-bug` | 버그 수정 |
| `code-refactor` | 리팩토링, 코드 정리 |
| `docs` | 문서 작성/수정 |
| `analysis` | 코드 분석, 리뷰 |
| `analysis-security` | 보안 감사 |
| `infra` | 배포, Docker, CI/CD |
| `design` | 아키텍처, API 설계, ADR |

---

### 5.4 모델 프로필 선택

비용과 품질 사이의 균형을 조절할 수 있습니다:

```
/forge --model quality "복잡한 아키텍처 리팩토링"   # Opus 중심 — 최고 품질
/forge --model balanced "API 엔드포인트 추가"        # Sonnet 중심 — 기본값
/forge --model budget "간단한 주석 추가"              # Haiku 중심 — 저비용
```

---

## 6. 문제 해결 (FAQ)

### "forge가 트리거되지 않아요"

코드 수정 요청을 해도 Gatekeeper가 반응하지 않는 경우입니다.

**확인 방법:**

```bash
node ~/.claude/skills/forge-skills/forge-framework/core/install.js verify
```

`FAILED`가 표시된 hook이 있다면 다시 설치합니다:

```bash
node ~/.claude/skills/forge-skills/forge-framework/core/install.js
```

이후 Claude Code를 재시작하세요. `SessionStart` hook이 실행되어야 Gatekeeper가 초기화됩니다.

---

### "코드 수정이 차단돼요"

Gate Guard가 `exit(2)`로 도구 호출을 차단하는 경우입니다.

**원인:** 활성화된 파이프라인이 없는 상태에서 코드를 직접 수정하려 했습니다.

이것은 **정상 동작**입니다. Gate Guard는 파이프라인 외부의 코드 수정을 허용하지 않습니다. `/forge` 명령으로 파이프라인을 시작하세요:

```
/forge "원하는 작업 설명"
```

---

### "외부 파일 수정이 차단돼요"

파이프라인 실행 중 프로젝트 외부 파일(`~/.claude/settings.json` 등)을 수정하려 할 때 차단되는 경우입니다.

**v8.0에서 해결됨:** `isProjectFile()` 함수가 프로젝트 외부 경로를 올바르게 허용합니다. 여전히 차단된다면 최신 버전인지 확인하세요:

```bash
cd ~/.claude/skills/forge-skills
git pull origin main
node forge-framework/core/install.js
```

---

### "Gatekeeper가 잘못 분류해요"

일반 대화인데 파이프라인을 시작하려 하거나, 코드 수정 요청인데 자유 응답을 하는 경우입니다.

**해결 방법 1 — LLM 활성화:**

```bash
export GATEKEEPER_LLM_ENABLED=true
```

키워드 기반 분류 대신 Haiku LLM이 의미 기반으로 분류하므로 정확도가 높아집니다.

**해결 방법 2 — 명시적 플래그 사용:**

Gatekeeper를 거치지 않고 직접 forge를 호출합니다:

```
/forge "작업 설명"
```

---

### "파이프라인이 중간에 멈췄어요"

네트워크 오류나 타임아웃으로 파이프라인이 중단된 경우입니다.

**재개 방법:**

```
/forge --resume
```

Orchestrator hook이 마지막으로 완료된 단계를 기록하고 있습니다. `--resume` 플래그를 사용하면 처음부터 다시 시작하지 않고 중단 지점 이후부터 재개합니다.

---

### "어떤 스킬이 등록되어 있는지 모르겠어요"

Gatekeeper가 인식하는 스킬 목록을 확인하고 싶을 때:

```
/forge --list-skills
```

또는 `~/.claude/skills/` 디렉터리를 직접 확인합니다:

```bash
ls ~/.claude/skills/
```

`SKILL.md` 파일이 있는 서브디렉터리가 모두 스킬로 등록됩니다.

---

### "settings.json이 손상됐어요"

install.js가 `settings.json`을 파싱하지 못하는 경우입니다.

**확인:**

```bash
cat ~/.claude/settings.json | python3 -m json.tool
```

JSON 문법 오류가 있다면 수동으로 수정하거나, 백업 후 삭제하고 재설치합니다:

```bash
cp ~/.claude/settings.json ~/.claude/settings.json.bak
rm ~/.claude/settings.json
node ~/.claude/skills/forge-skills/forge-framework/core/install.js
```

---

## 7. 다음 단계

설치와 기본 사용법을 마쳤다면 아래 문서로 이어가세요.

### 커스텀 스킬 만들기

자신만의 스킬을 5분 안에 만들 수 있습니다. YAML 5줄이면 Gatekeeper 라우팅과 Gate Guard 보호를 받는 완전한 스킬이 됩니다.

- 가이드: `docs/skill-developer-guide.md`
- 템플릿: `templates/skill-template/SKILL.md`

### 사용 시나리오

실제 개발 상황별 forge 활용 예시를 확인하세요.

- 가이드: `docs/usage-scenarios-ko.md` *(작성 예정)*

### 내장 스킬 forge-dev 상세 가이드

6가지 파이프라인 모드, 17개 에이전트 프롬프트, 언어별 품질 체크리스트 등 내장 개발 스킬의 전체 기능을 알아보세요.

- 위치: `skills/forge-dev/`

### 예제 스킬

커스텀 스킬 작성의 참고 자료로 활용하세요.

- 위치: `examples/` *(있는 경우)*
- 내장 예제: `skills/forge-dev/` (완전한 프로덕션 스킬)

---

*최종 업데이트: 2026-03-21 | Forge Framework v8.0 "Nova"*
