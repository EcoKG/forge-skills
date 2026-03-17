# forge-skills

Claude Code skills and hooks for autonomous development workflow.

[English](#whats-inside) | [한국어](#한국어-가이드)

---

## What's Inside

```
forge-skills/
├── install.sh              # One-command installer (installs everything)
├── forge/                  # Forge v5.0 — Context-Engineered Autonomous Dev System
│   ├── SKILL.md            # Main skill definition + project layer
│   ├── hooks/              # Workspace runtime hooks
│   │   ├── forge-context-monitor.js   # Context pressure warnings
│   │   ├── forge-statusline.js        # Project status in terminal
│   │   ├── forge-session-init.js      # Auto-detect project on session start
│   │   └── install.js                 # Hook auto-installer
│   ├── references/         # PM execution manuals (loaded per-section)
│   │   ├── execution-flow.md          # 10-step pipeline (Step 0-10)
│   │   ├── project-lifecycle.md       # Project operations (init/phase/auto/milestone)
│   │   ├── context-engineering.md     # Context rot prevention rules
│   │   ├── wave-execution.md          # Parallel execution rules
│   │   └── deviation-rules.md         # R1-R4 deviation handling
│   ├── prompts/            # 10 agent role prompts
│   │   ├── researcher.md       # Codebase exploration + domain investigation
│   │   ├── planner.md          # must_haves + deep work task planning
│   │   ├── plan-checker.md     # 8-dimension plan verification
│   │   ├── implementer.md      # Code implementation + deviation rules
│   │   ├── code-reviewer.md    # 10-perspective code review
│   │   ├── qa-inspector.md     # Build/test/anti-pattern verification
│   │   ├── verifier.md         # Goal-backward 3-level verification
│   │   ├── doc-reviewer.md     # Documentation quality review
│   │   ├── roadmapper.md       # Project roadmap generation
│   │   └── integration-checker.md  # Cross-phase milestone verification
│   ├── templates/          # Output templates
│   │   ├── plan.md             # YAML frontmatter + XML deep work tasks
│   │   ├── research.md         # Severity-tagged findings (H/M/L)
│   │   ├── verification.md     # 3-level goal-backward results
│   │   ├── summary.md          # Per-task execution summary
│   │   ├── report.md           # Final report with traceability
│   │   ├── output.md           # User-facing progress formats
│   │   ├── project.json        # Project definition template
│   │   ├── roadmap.md          # Roadmap structure template
│   │   ├── state.md            # Session continuity template
│   │   ├── context.md          # Phase decision capture template
│   │   └── forge-claude-md.md  # Auto-generated CLAUDE.md snippet
│   ├── checklists/         # Language-specific code review checklists
│   │   ├── general.md, javascript.md, python.md, go.md
│   │   ├── java.md, rust.md, csharp-wpf.md
│   └── resources/
│       └── type-guides.md  # Per-type workflow guides (8 types)
│
├── creatework/             # CreateWork skill — workspace bootstrapper
│   └── SKILL.md
│
└── hooks/                  # Hook auto-activation system
    ├── src/                # TypeScript source
    ├── tests/              # Test suite
    ├── skill-rules.json    # Trigger rules
    └── install.sh          # Hook-only installer
```

## Forge v5.0 — Overview

Context-Engineered Autonomous Development System with project lifecycle management.

### v3.1 New Features (GSD-inspired)

| Feature | Description |
|---|---|
| **Atomic Commits** | Per-task git commit with conventional format (`feat/fix/refactor/docs/chore`). Enables `git bisect` and individual task revert. |
| **Crash Recovery** | `execution-lock.json` detects interrupted executions. Session-init warns on startup. |
| **Execution Resume** | `--resume` flag continues from last completed task via `completed_tasks[]` tracking. |
| **Stuck Detection** | 3-tier protocol: read loop (5 warn / 7 force), same-file 3x, error loop 3x → auto-escalation. |
| **Context Recovery** | After context compression, PM recovers state from disk artifacts using per-step essentials table. |
| **Decision Locking** | `[LOCKED]/[DEFERRED]/[DISCRETION]` statuses enforced in planner and implementer. |
| **Token Tracking** | Dispatch-level recording with by_model/by_agent aggregation in metrics.json and report. |
| **Deterministic CLI** | `forge-tools.js` functions: `detect-stack`, `git-state`, `create-lock`, `remove-lock`, `check-lock`, `metrics-record-dispatch`. |

### Two Modes

| Mode | Command | What It Does |
|---|---|---|
| **Task Mode** | `/forge "add login feature"` | Single task: research → plan → execute → verify |
| **Project Mode** | `/forge --init` then `/forge --phase N` | Multi-phase: roadmap → milestones → phases → verify |

### Task Mode Pipeline (10 Steps)

```
Step 0: Project Router (if project flags detected)
Step 1: INIT        → Parse request, detect type/scale/paradigm
Step 2: RESEARCH    → Parallel codebase exploration (haiku×N → sonnet synthesis)
Step 3: PLAN        → must_haves + deep work tasks with wave assignments
Step 4: PLAN-CHECK  → 8-dimension verification (max 3 revision loops)
Step 5: CHECKPOINT  → User approval gate
Step 6: BRANCH      → Git feature branch
Step 7: EXECUTE     → Wave-based parallel implementation with per-task review
Step 8: VERIFY      → Goal-backward 3-level verification (Exists → Substantive → Wired)
Step 9: FINALIZE    → Report generation, PR proposal
Step 10: CLEANUP    → State update, agent cleanup
```

### Project Mode Lifecycle

```
/forge --init          Create project: define vision → generate roadmap → initialize state
        │
/forge --phase 1       Execute phase 1 through the 10-step pipeline
        │
/forge --phase 2       Execute phase 2 (depends on phase 1 completion)
        │
/forge --milestone     Verify cross-phase integration at milestone boundary
        │
/forge --autonomous    Auto-chain all remaining phases
```

### Key Innovations

| Feature | Description |
|---|---|
| **Context Engineering** | PM uses ≤15% of context window. Agents get fresh context each. File-based communication prevents context rot. |
| **Goal-Backward Verification** | Not "did tasks complete?" but "does the codebase deliver what was promised?" 3 levels: Exists → Substantive → Wired. |
| **Deep Work Rules** | Every task MUST have `read_first`, `acceptance_criteria`, concrete `action`. No vague instructions. |
| **must_haves** | Plan frontmatter defines verifiable success: `truths` (user behaviors), `artifacts` (files + exports), `key_links` (connections). |
| **Wave-Based Execution** | Dependency-graph based parallel execution. Independent tasks run concurrently (max 3). |
| **Deviation Rules R1-R4** | Auto-fix bugs (R1), add missing features (R2), resolve blockers (R3), STOP for architecture changes (R4). |
| **8D Plan Checker** | Requirements coverage, task completeness, dependency correctness, key links, scope sanity, verification derivation, deep work compliance, test coverage. |
| **Session Continuity** | `state.md` persists project state across sessions. New session auto-detects and restores context. |

### 10 Specialized Agents

| Agent | Role |
|---|---|
| **researcher** | Parallel codebase exploration + domain investigation |
| **planner** | must_haves + deep work task plan generation |
| **plan-checker** | 8-dimension plan quality gate |
| **implementer** | Code implementation with deviation rules + self-check |
| **code-reviewer** | 10-perspective review (bugs, security, SOLID, wiring, anti-patterns) |
| **qa-inspector** | Build/test verification + caller impact + anti-pattern scan |
| **verifier** | Goal-backward 3-level verification |
| **doc-reviewer** | Documentation quality review |
| **roadmapper** | Project roadmap generation from requirements |
| **integration-checker** | Cross-phase integration verification at milestones |

### 8 Task Types

| Type | Flow |
|---|---|
| `code` | Full pipeline with TDD |
| `code-bug` | Lightweight: reproduce → diagnose → fix |
| `code-refactor` | Behavior-preserving: baseline tests → refactor → regression |
| `docs` | Research → write → doc-review (skip plan/QA/verify) |
| `analysis` | Research → report only (no code changes) |
| `analysis-security` | OWASP Top 10 audit with CWE IDs (opus model) |
| `infra` | Dry-run → approve → execute with rollback plan |
| `design` | ADR format with alternative comparison |

### Workspace Hooks

Installed automatically by `/forge --init` or manually via `node forge/hooks/install.js`:

| Hook | Trigger | What It Does |
|---|---|---|
| `forge-context-monitor` | PostToolUse | Monitors context usage. WARNING at 35%, CRITICAL at 25% remaining. |
| `forge-statusline` | Notification | Shows `⚒ project | Ph 2/5 ⏳ Auth | 35%` in terminal statusline. |
| `forge-session-init` | UserPromptSubmit | Auto-detects `.forge/state.md` on session start, injects project context. |

### Usage Examples

**Task mode:**
```
/forge "implement user authentication with JWT"
/forge "refactor the payment module" --scale medium --paradigm oop
/forge "security audit on API endpoints" --type analysis-security
/forge "fix the login crash on empty password" --type code-bug
```

**Project mode:**
```
/forge --init                    # Create project with roadmap
/forge --init --from prd.md     # Create from existing PRD document
/forge --status                  # Show project progress dashboard
/forge --phase 1                 # Execute phase 1
/forge --discuss 2               # Capture decisions for phase 2
/forge --phase 2                 # Execute phase 2
/forge --milestone               # Verify milestone integration
/forge --autonomous              # Auto-execute all remaining phases
/forge --autonomous --from 3     # Auto-execute starting from phase 3
```

### Quality System (5-Layer Defense)

```
L1: Deep Work (Planning)       — 8D plan checker, read_first + acceptance_criteria
L2: Self-Check (Implementation) — 6-item checklist, stuck detection protocol, decision lock compliance
L3: Peer Review (Code Review)   — 10 perspectives, language checklists
L4: QA Gate (Wave Boundary)     — Build, test, caller impact, anti-patterns
L5: Goal-Backward (Verification) — Exists → Substantive → Wired
```

### Supported Languages (Checklists)

JavaScript/TypeScript, Python, Go, Java, Rust, C#/WPF + General checklist

---

## CreateWork Skill

Creates a new workspace directory under `~/` and opens it in VSCode.

**Usage:**
```
/creatework my-project
```

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

The installer automatically:

1. **Checks Node.js** — detects system Node.js or nvm
2. **Installs skills** — copies `forge/` and `creatework/` to `~/.claude/skills/`
3. **Builds hook** — compiles TypeScript to `hooks/dist/`
4. **Deploys rules** — copies `skill-rules.json` to `~/.claude/skills/`
5. **Creates state dir** — `~/.claude/hooks/state/` for session tracking
6. **Registers hooks** — adds forge workspace hooks + skill-activation to `~/.claude/settings.json`

> The installer merges into your existing `settings.json` — it will not overwrite your current settings.

### Verify

```bash
echo '{"session_id":"test","prompt":"기능 구현 해줘"}' | node hooks/dist/src/skill-activation.js
```

Expected output:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SKILL ACTIVATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  → forge [high] (keywords: 기능 구현; intents: 1)
    Autonomous execution engine for complex development tasks

IMPORTANT: This task requires the "forge" skill.
You MUST invoke it using the Skill tool (skill: "forge") BEFORE doing any other work.
Do not analyze, implement, or modify code directly — the skill handles the full workflow.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Manual Install (Advanced)

If you prefer not to use the installer:

**1. Copy skills:**
```bash
cp -r forge ~/.claude/skills/forge
cp -r creatework ~/.claude/skills/creatework
```

**2. Install forge workspace hooks:**
```bash
node ~/.claude/skills/forge/hooks/install.js
```

**3. Build activation hook:**
```bash
cd hooks && npm install && npx tsc
```

**4. Deploy rules + register activation hook:**
```bash
mkdir -p ~/.claude/skills ~/.claude/hooks/state
cp hooks/skill-rules.json ~/.claude/skills/skill-rules.json
```

Add to `~/.claude/settings.json` under `hooks.UserPromptSubmit`:
```json
{
  "type": "command",
  "command": "/path/to/node /absolute/path/to/hooks/dist/src/skill-activation.js",
  "timeout": 5
}
```

## Customizing Trigger Rules

Edit `hooks/skill-rules.json` to add your own skills:

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
        "intentPatterns": ["(create|build).*?(widget|component)"]
      },
      "skipConditions": { "sessionSkillUsed": true }
    }
  }
}
```

| Field | Values | Description |
|---|---|---|
| `type` | `domain` / `guardrail` | Skill category |
| `enforcement` | `suggest` / `block` / `warn` | Message strength |
| `priority` | `critical` / `high` / `medium` / `low` | Ranking when multiple skills match |
| `keywords` | string[] | Substring match (case-insensitive) |
| `intentPatterns` | string[] | Regex patterns (case-insensitive) |

## Running Tests

```bash
cd hooks
npm install && npx tsc
node --test dist/tests/matcher.test.js
node --test dist/tests/session-tracker.test.js
node --test dist/tests/skill-activation.test.js
```

## Uninstall

```bash
# Remove forge workspace hooks
node ~/.claude/skills/forge/hooks/install.js uninstall

# Remove everything
rm -rf ~/.claude/skills/forge ~/.claude/skills/creatework
rm -rf ~/.claude/hooks/state ~/.claude/skills/skill-rules.json
```

Then remove the `skill-activation` entry from `~/.claude/settings.json`.

---

## 한국어 가이드

Claude Code용 스킬과 훅을 제공하는 자율 개발 워크플로우 도구입니다.

### 구성 요소

| 디렉토리 | 설명 |
|---|---|
| `forge/` | Forge v5.0 — 컨텍스트 엔지니어링 기반 자율 개발 시스템 |
| `creatework/` | CreateWork — 워크스페이스 생성 + VSCode 실행 |
| `hooks/` | Hook 자동 활성화 시스템 — 프롬프트 분석 후 관련 스킬 자동 제안 |

### Forge v5.0

개발 전체 라이프사이클을 자율 관리하는 실행 엔진입니다.

**v3.1 신규:** Atomic Commits, Crash Recovery, --resume, Stuck Detection, Context Recovery, Decision Locking, Token Tracking, Deterministic CLI

#### 두 가지 모드

| 모드 | 커맨드 | 설명 |
|---|---|---|
| **태스크 모드** | `/forge "로그인 기능 구현"` | 단일 작업: 리서치 → 계획 → 구현 → 검증 |
| **프로젝트 모드** | `/forge --init` → `/forge --phase N` | 다단계: 로드맵 → 마일스톤 → 페이즈 → 검증 |

#### 태스크 모드 (10스텝 파이프라인)

```
리서치 → 계획 → 계획검증(8차원) → 체크포인트 → 브랜치 → 실행(Wave병렬) → 검증(3단계) → 보고서
```

#### 프로젝트 모드 (수명주기 관리)

```
/forge --init              프로젝트 생성: 비전 정의 → 로드맵 생성 → 상태 초기화
/forge --status            진행 상황 대시보드
/forge --phase N           N번 페이즈 실행 (10스텝 파이프라인으로)
/forge --discuss N         N번 페이즈 의사결정 캡처
/forge --milestone         마일스톤 통합 검증
/forge --autonomous        남은 페이즈 자동 연속 실행
```

#### 핵심 혁신

| 기능 | 설명 |
|---|---|
| **컨텍스트 엔지니어링** | PM은 컨텍스트 15% 이하만 사용. 에이전트는 매번 fresh context. 파일 기반 통신으로 context rot 방지. |
| **Goal-Backward 검증** | "태스크 완료 여부"가 아닌 "코드가 약속한 것을 실제로 전달하는가" 검증. Exists → Substantive → Wired 3단계. |
| **Deep Work** | 모든 태스크에 `read_first`, `acceptance_criteria`, 구체적 `action` 필수. 모호한 지시 금지. |
| **must_haves** | 플랜에 검증 가능한 성공 기준 정의: `truths`(사용자 행동), `artifacts`(파일+exports), `key_links`(연결). |
| **Wave 병렬 실행** | 의존성 그래프 기반 병렬. 독립 태스크 동시 실행 (최대 3개). |
| **Deviation Rules** | 버그 자동 수정(R1), 누락 기능 추가(R2), 차단 해결(R3), 아키텍처 변경은 중단(R4). |
| **세션 연속성** | `state.md`가 세션 간 상태 유지. 새 세션에서 자동 감지 + 컨텍스트 복원. |

#### 10개 전문 에이전트

| 에이전트 | 역할 |
|---|---|
| **researcher** | 코드베이스 탐색 + 도메인 조사 (병렬 haiku → sonnet 합성) |
| **planner** | must_haves + deep work 태스크 플랜 생성 |
| **plan-checker** | 8차원 플랜 품질 검증 |
| **implementer** | 코드 구현 + deviation rules + self-check |
| **code-reviewer** | 10관점 리뷰 (버그, 보안, SOLID, wiring, anti-pattern) |
| **qa-inspector** | 빌드/테스트 + caller impact + anti-pattern 스캔 |
| **verifier** | Goal-Backward 3단계 검증 |
| **doc-reviewer** | 문서 품질 리뷰 |
| **roadmapper** | 프로젝트 로드맵 생성 |
| **integration-checker** | 크로스 페이즈 통합 검증 |

#### 지원 타입

`code`, `code-bug`, `code-refactor`, `docs`, `analysis`, `analysis-security`, `infra`, `design`

#### 워크스페이스 훅

`/forge --init` 시 자동 설치 또는 `node forge/hooks/install.js`로 수동 설치:

| 훅 | 트리거 | 기능 |
|---|---|---|
| `forge-context-monitor` | PostToolUse | 컨텍스트 사용량 모니터링. 35% 남으면 WARNING, 25% 남으면 CRITICAL. |
| `forge-statusline` | Notification | 터미널에 프로젝트/페이즈 상태 표시 |
| `forge-session-init` | UserPromptSubmit | 세션 시작 시 프로젝트 자동 감지 + 컨텍스트 복원 |

#### 사용 예시

**태스크 모드:**
```
/forge "JWT 기반 사용자 인증 구현"
/forge "결제 모듈 리팩토링" --scale medium
/forge "API 보안 감사" --type analysis-security
/forge "빈 비밀번호 로그인 크래시 수정" --type code-bug
```

**프로젝트 모드:**
```
/forge --init                    # 프로젝트 생성
/forge --init --from prd.md     # 기존 PRD 문서로 프로젝트 생성
/forge --status                  # 진행 상황 대시보드
/forge --phase 1                 # 1번 페이즈 실행
/forge --autonomous              # 남은 페이즈 자동 실행
/forge --milestone               # 마일스톤 통합 검증
```

#### 품질 시스템 (5단계 방어)

```
L1: Deep Work (계획)     — 8차원 plan checker, read_first + acceptance_criteria
L2: Self-Check (구현)    — 6항목 체크리스트, stuck detection protocol, decision lock 준수
L3: Peer Review (리뷰)   — 10관점 리뷰, 언어별 체크리스트
L4: QA Gate (Wave 경계)  — 빌드, 테스트, caller impact, anti-pattern
L5: Goal-Backward (검증) — Exists → Substantive → Wired
```

### 설치

```bash
git clone https://github.com/EcoKG/forge-skills.git
cd forge-skills
bash install.sh
```

자세한 설치 방법은 [영문 Installation 섹션](#installation)을 참고하세요.

### 삭제

```bash
node ~/.claude/skills/forge/hooks/install.js uninstall
rm -rf ~/.claude/skills/forge ~/.claude/skills/creatework
rm -rf ~/.claude/hooks/state ~/.claude/skills/skill-rules.json
```

## License

MIT
