# forge-skills

Claude Code skills and hooks for autonomous development workflow.

[English](#whats-inside) | [한국어](#한국어-가이드)

---

## What's Inside

```
forge-skills/
├── install.sh              # One-command installer (installs everything)
├── forge/                  # Forge skill — autonomous execution engine
│   ├── SKILL.md            # Main skill definition (install to ~/.claude/skills/forge/)
│   ├── checklists/         # Language-specific code review checklists
│   │   ├── general.md
│   │   ├── javascript.md
│   │   ├── python.md
│   │   ├── go.md
│   │   └── csharp-wpf.md
│   ├── prompts/            # Agent role prompts
│   │   ├── implementer.md
│   │   ├── code-reviewer.md
│   │   ├── doc-reviewer.md
│   │   ├── qa-inspector.md
│   │   └── analyst.md
│   ├── resources/
│   │   └── type-guides.md  # Per-type workflow guides (code, docs, analysis, infra, design)
│   └── templates/          # Output templates (research, plan, report)
│
├── creatework/             # CreateWork skill — workspace bootstrapper
│   └── SKILL.md            # Skill definition (install to ~/.claude/skills/creatework/)
│
└── hooks/                  # Hook auto-activation system
    ├── src/
    │   ├── types.ts            # Core type definitions
    │   ├── rules-matcher.ts    # Keyword + intent pattern matching engine
    │   ├── session-tracker.ts  # Session-based dedup tracking
    │   └── skill-activation.ts # UserPromptSubmit hook entry point
    ├── tests/
    │   ├── matcher.test.ts
    │   ├── session-tracker.test.ts
    │   └── skill-activation.test.ts
    ├── skill-rules.json    # Trigger rules (keywords, intent patterns per skill)
    ├── install.sh          # One-command installer
    ├── package.json
    └── tsconfig.json
```

## Forge Skill

Autonomous execution engine that manages the full development lifecycle:

```
research → plan → implement → review → QA
```

Supports task types: `code`, `docs`, `analysis`, `infra`, `design`.

**Usage:**
```
/forge "implement user authentication with JWT"
/forge "refactor the payment module" --scale medium
/forge "security audit on API endpoints" --type analysis
```

## CreateWork Skill

Creates a new workspace directory under `~/` and opens it in VSCode.

**Usage:**
```
/creatework my-project
```

This will:
1. Create `~/my-project` directory
2. Run `code ~/my-project` to open VSCode

**Install:**
```bash
mkdir -p ~/.claude/skills/creatework
cp creatework/SKILL.md ~/.claude/skills/creatework/
```

## Hook Auto-Activation

A `UserPromptSubmit` hook that analyzes every prompt and suggests relevant skills automatically.

**How it works:**

```
User types prompt → Claude Code triggers UserPromptSubmit hook
                              │
                        stdin: JSON {session_id, prompt}
                              │
                    ┌─────────▼──────────┐
                    │ RulesMatcher        │
                    │  ├─ keyword match   │
                    │  └─ intent regex    │
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │ SessionTracker      │
                    │  └─ filter repeats  │
                    └─────────┬──────────┘
                              │
                        stdout → Claude context
                        exit 0 (always)
```

**Design principles:**
- **Zero-dependency** — only Node.js built-in APIs
- **Fail-open** — all errors exit 0 with empty stdout (never blocks Claude)
- **Fast** — TypeScript pre-compiled via `tsc`, no `npx tsx` cold start
- **Session dedup** — same skill not suggested twice per session

## Installation

### Prerequisites

- **Node.js** v18+ (v22 recommended)
- **Claude Code** CLI installed and configured

### Quick Install (Recommended)

```bash
git clone https://github.com/EcoKG/forge-skills.git
cd forge-skills
bash install.sh
```

That's it. The installer automatically:

1. **Checks Node.js** — detects system Node.js or nvm
2. **Installs skills** — copies `forge/` and `creatework/` to `~/.claude/skills/`
3. **Builds hook** — compiles TypeScript to `hooks/dist/`
4. **Deploys rules** — copies `skill-rules.json` to `~/.claude/skills/`
5. **Creates state dir** — `~/.claude/hooks/state/` for session tracking
6. **Registers hook** — adds `UserPromptSubmit` entry to `~/.claude/settings.json`

> The installer merges into your existing `settings.json` — it will not overwrite your current settings.

### Verify

```bash
echo '{"session_id":"test","prompt":"기능 구현 해줘"}' | node hooks/dist/src/skill-activation.js
```

Expected output:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SKILL ACTIVATION CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RECOMMENDED SKILLS:
  → forge [high] (keywords: 기능 구현; intents: 1)

ACTION: Consider using the Skill tool for the above skill(s) if relevant.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Start a new Claude Code session and type a prompt like "implement a new feature" — the hook will suggest the forge skill automatically.

### Manual Install (Advanced)

If you prefer not to use the installer:

**1. Build the hook:**

```bash
cd hooks
npm install
npx tsc
# or: node ./node_modules/typescript/bin/tsc
```

**2. Copy rules file:**

```bash
mkdir -p ~/.claude/skills
cp hooks/skill-rules.json ~/.claude/skills/skill-rules.json
```

**3. Create state directory:**

```bash
mkdir -p ~/.claude/hooks/state
```

**4. Register in settings.json:**

Add the following to `~/.claude/settings.json` under `hooks.UserPromptSubmit`:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/node /absolute/path/to/hooks/dist/src/skill-activation.js",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

> Replace `/path/to/node` with your Node.js binary path (run `which node`) and `/absolute/path/to/hooks/` with the actual path to the cloned repo's `hooks/` directory.

## Customizing Trigger Rules

Edit `hooks/skill-rules.json` (or `~/.claude/skills/skill-rules.json` after install) to add your own skills:

```json
{
  "skills": {
    "my-skill": {
      "type": "domain",
      "enforcement": "suggest",
      "priority": "medium",
      "description": "What this skill does",
      "promptTriggers": {
        "keywords": ["keyword1", "keyword2"],
        "intentPatterns": [
          "(create|build).*?(widget|component)"
        ]
      },
      "skipConditions": {
        "sessionSkillUsed": true
      }
    }
  }
}
```

| Field | Values | Description |
|---|---|---|
| `type` | `domain` / `guardrail` | Skill category |
| `enforcement` | `suggest` / `block` / `warn` | How aggressively to recommend |
| `priority` | `critical` / `high` / `medium` / `low` | Ranking when multiple skills match |
| `keywords` | string[] | Substring match (case-insensitive) |
| `intentPatterns` | string[] | Regex patterns (case-insensitive) |
| `skipConditions.sessionSkillUsed` | boolean | Skip if already suggested this session |

After editing, copy the updated file:
```bash
cp hooks/skill-rules.json ~/.claude/skills/skill-rules.json
```

## Running Tests

```bash
cd hooks
npm install
npx tsc
node --test dist/tests/matcher.test.js
node --test dist/tests/session-tracker.test.js
node --test dist/tests/skill-activation.test.js
```

## Uninstall

Remove the hook entry from `~/.claude/settings.json` (delete the `UserPromptSubmit` block containing `skill-activation`), then optionally:

```bash
rm -rf ~/.claude/hooks/state
rm ~/.claude/skills/skill-rules.json
rm -rf ~/.claude/skills/forge
```

---

## 한국어 가이드

Claude Code용 스킬과 훅을 제공하는 자율 개발 워크플로우 도구입니다.

### 구성 요소

| 디렉토리 | 설명 |
|---|---|
| `forge/` | Forge 스킬 — 자율 실행 엔진 (리서치 → 계획 → 구현 → 리뷰 → QA) |
| `creatework/` | CreateWork 스킬 — 워크스페이스 생성 + VSCode 실행 |
| `hooks/` | Hook 자동 활성화 시스템 — 프롬프트 분석 후 관련 스킬 자동 제안 |

### Forge 스킬

개발 전체 라이프사이클을 자동 관리하는 자율 실행 엔진입니다.

```
리서치 → 계획 → 구현 → 리뷰 → QA
```

지원 유형: `code`(기능 구현, 버그 수정, 리팩토링), `docs`, `analysis`(코드 리뷰, 보안 감사), `infra`(CI/CD, Docker), `design`(아키텍처, 스키마, API)

**사용법:**
```
/forge "JWT 기반 사용자 인증 구현"
/forge "결제 모듈 리팩토링" --scale medium
/forge "API 엔드포인트 보안 감사" --type analysis
```

### CreateWork 스킬

`~/` 아래에 새 워크스페이스 디렉토리를 만들고 VSCode로 엽니다.

**사용법:**
```
/creatework my-project
```

**동작:**
1. `~/my-project` 디렉토리 생성
2. `code ~/my-project`로 VSCode 실행

**설치:**
```bash
mkdir -p ~/.claude/skills/creatework
cp creatework/SKILL.md ~/.claude/skills/creatework/
```

### Hook 자동 활성화

`UserPromptSubmit` 훅으로 모든 프롬프트를 분석해 관련 스킬을 자동 제안합니다.

**동작 방식:**
```
사용자 프롬프트 입력 → Claude Code가 UserPromptSubmit 훅 실행
                              │
                        stdin: JSON {session_id, prompt}
                              │
                    ┌─────────▼──────────┐
                    │ RulesMatcher        │
                    │  ├─ 키워드 매칭     │
                    │  └─ 의도 패턴 매칭  │
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │ SessionTracker      │
                    │  └─ 중복 제안 필터  │
                    └─────────┬──────────┘
                              │
                        stdout → Claude 컨텍스트
                        exit 0 (항상)
```

**설계 원칙:**
- **Zero-dependency** — Node.js 내장 API만 사용
- **Fail-open** — 모든 에러에서 exit 0 + 빈 stdout (Claude 차단 없음)
- **고속** — TypeScript를 `tsc`로 사전 컴파일, `npx tsx` 콜드 스타트 회피
- **세션 중복 방지** — 같은 스킬을 세션 내에서 반복 제안하지 않음

### 설치 방법

#### 사전 요구 사항

- **Node.js** v18 이상 (v22 권장)
- **Claude Code** CLI 설치 및 설정 완료

#### 빠른 설치 (권장)

```bash
git clone https://github.com/EcoKG/forge-skills.git
cd forge-skills
bash install.sh
```

끝입니다. 설치 스크립트가 자동으로 수행하는 작업:

1. **Node.js 확인** — 시스템 Node.js 또는 nvm 감지
2. **스킬 설치** — `forge/`, `creatework/`를 `~/.claude/skills/`에 복사
3. **Hook 빌드** — TypeScript를 `hooks/dist/`로 컴파일
4. **규칙 배포** — `skill-rules.json`을 `~/.claude/skills/`에 복사
5. **상태 디렉토리 생성** — `~/.claude/hooks/state/` (세션 추적용)
6. **Hook 등록** — `~/.claude/settings.json`에 `UserPromptSubmit` 항목 추가

> 기존 `settings.json` 설정을 덮어쓰지 않고 병합합니다.

#### 설치 확인

```bash
echo '{"session_id":"test","prompt":"기능 구현 해줘"}' | node hooks/dist/src/skill-activation.js
```

예상 출력:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SKILL ACTIVATION CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RECOMMENDED SKILLS:
  → forge [high] (keywords: 기능 구현; intents: 1)

ACTION: Consider using the Skill tool for the above skill(s) if relevant.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

새 Claude Code 세션에서 "기능 구현해줘", "버그 수정", "리팩토링" 등을 입력하면 자동으로 관련 스킬이 제안됩니다.

#### 수동 설치 (고급)

설치 스크립트 없이 직접 설정하려면:

**1. Hook 빌드:**
```bash
cd hooks
npm install
npx tsc
# 또는: node ./node_modules/typescript/bin/tsc
```

**2. 규칙 파일 복사:**
```bash
mkdir -p ~/.claude/skills
cp hooks/skill-rules.json ~/.claude/skills/skill-rules.json
```

**3. 상태 디렉토리 생성:**
```bash
mkdir -p ~/.claude/hooks/state
```

**4. settings.json에 Hook 등록:**

`~/.claude/settings.json`의 `hooks.UserPromptSubmit`에 아래 내용을 추가합니다:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "/node/경로 /절대경로/hooks/dist/src/skill-activation.js",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

> `/node/경로`는 `which node`로 확인하고, `/절대경로/hooks/`는 클론한 레포의 실제 경로로 교체하세요.

### 트리거 규칙 커스터마이징

`hooks/skill-rules.json` (설치 후에는 `~/.claude/skills/skill-rules.json`)을 편집해 자신만의 스킬을 추가할 수 있습니다:

```json
{
  "skills": {
    "my-skill": {
      "type": "domain",
      "enforcement": "suggest",
      "priority": "medium",
      "description": "스킬 설명",
      "promptTriggers": {
        "keywords": ["키워드1", "키워드2"],
        "intentPatterns": [
          "(만들|생성).*?(위젯|컴포넌트)"
        ]
      },
      "skipConditions": {
        "sessionSkillUsed": true
      }
    }
  }
}
```

| 필드 | 값 | 설명 |
|---|---|---|
| `type` | `domain` / `guardrail` | 스킬 분류 |
| `enforcement` | `suggest` / `block` / `warn` | 제안 강도 |
| `priority` | `critical` / `high` / `medium` / `low` | 복수 매칭 시 우선순위 |
| `keywords` | string[] | 부분 문자열 매칭 (대소문자 무시) |
| `intentPatterns` | string[] | 정규식 패턴 (대소문자 무시) |
| `skipConditions.sessionSkillUsed` | boolean | 세션 내 이미 제안된 경우 생략 |

편집 후 업데이트된 파일을 복사합니다:
```bash
cp hooks/skill-rules.json ~/.claude/skills/skill-rules.json
```

### 테스트 실행

```bash
cd hooks
npm install
npx tsc
node --test dist/tests/matcher.test.js
node --test dist/tests/session-tracker.test.js
node --test dist/tests/skill-activation.test.js
```

### 삭제

`~/.claude/settings.json`에서 `skill-activation`이 포함된 `UserPromptSubmit` 블록을 삭제한 후:

```bash
rm -rf ~/.claude/hooks/state
rm ~/.claude/skills/skill-rules.json
rm -rf ~/.claude/skills/forge
```

## License

MIT
