# forge-skills

Claude Code skills and hooks for autonomous development workflow.

[English](#whats-inside) | [한국어](#한국어-가이드)

---

## What's Inside

```
forge-skills/
├── setup.sh               # One-line setup (clone + install)
├── install.sh              # Full installer (installs everything)
├── package.json            # Dependencies + test scripts
├── vitest.config.js        # Test configuration
├── forge/                  # Forge v7.1 "Bastion" — Context-Engineered Autonomous Dev System
│   ├── SKILL.md            # Main skill definition (engine-driven pipeline)
│   ├── hooks/              # Runtime hooks (v7.1)
│   │   ├── forge-gate-guard.js      # PreToolUse: 9 gates (8 hard blocks + 1 warning)
│   │   ├── forge-orchestrator.js    # UserPromptSubmit: pipeline state injection
│   │   ├── forge-tracker.js         # PostToolUse: trace logging + build/test detection
│   │   ├── forge-statusline.js      # Notification: IDE status display
│   │   ├── forge-tools.js           # Engine CLI: pipeline lifecycle + agent dispatch
│   │   ├── install.js               # Hook auto-installer
│   │   ├── activation/              # Skill auto-activation system
│   │   │       ├── skill-activation.js  # Prompt analysis + skill suggestion
│   │   │       ├── skill-activation-guard.js # PreToolUse: blocks tools until skill invoked
│   │   │       ├── skill-activation-stop.js  # Stop: blocks text-only until skill invoked
│   │   │       ├── rules-matcher.js     # 3-layer scoring (keywords + intent + smart)
│   │   │       ├── session-tracker.js   # Session dedup
│   │   │       └── skill-rules.json     # scored keywords + 35 intent patterns + graduated negative signals
│   │   └── shared/                   # Shared modules (v7.1)
│   │       ├── constants.js          # CODE_EXTENSIONS, SKIP_PATHS, BASH_WRITE_PATTERNS
│   │       └── pipeline.js           # findActivePipeline, hasActivePipeline
│   ├── references/         # PM execution manuals (loaded per-section)
│   │   ├── execution-flow.md        # 8-step pipeline (inc. architect_guide)
│   │   ├── architect-design.md       # Design mode process + output
│   │   ├── architect-analyze.md      # Analyze mode process + output
│   │   ├── architect-adr.md          # ADR mode process + output
│   │   ├── architect-guide.md        # Guide mode process + output
│   │   ├── project-lifecycle.md     # Project operations (init/phase/auto/milestone)
│   │   ├── context-engineering.md   # Context rot prevention rules
│   │   ├── wave-execution.md        # Parallel execution rules
│   │   ├── deviation-rules.md       # R1-R4 deviation handling
│   │   ├── backpressure.md          # Build/test enforcement
│   │   ├── model-routing.md         # Model selection per agent
│   │   ├── ralph-mode.md            # Ralph iteration mode
│   │   ├── debug-pipeline.md        # Scientific debug workflow
│   │   ├── codebase-mapping.md      # --map mode
│   │   ├── plugin-system.md         # Custom agent plugins
│   │   ├── learning-system.md       # Pattern/failure memory
│   │   └── questioning.md           # User interaction rules
│   ├── prompts/            # 16 agent role prompts (verifier.md merged into VPM)
│   │   ├── researcher.md            # Parallel codebase exploration
│   │   ├── planner.md               # must_haves + deep work task planning
│   │   ├── plan-checker.md          # 9-dimension plan verification (D1-D9)
│   │   ├── implementer.md           # Code implementation + deviation rules
│   │   ├── code-reviewer.md         # 11-perspective code review
│   │   ├── qa-inspector.md          # Build/test/anti-pattern verification
│   │   ├── verification-pm.md       # Goal-backward 3-level verification (VPM)
│   │   ├── verifier.md              # Deprecated — merged into verification-pm.md
│   │   ├── architect.md             # Architecture router (80 lines → loads mode-specific refs)
│   │   ├── doc-reviewer.md          # Documentation quality review
│   │   ├── roadmapper.md            # Project roadmap generation
│   │   ├── integration-checker.md   # Cross-phase milestone verification
│   │   ├── debugger.md              # Scientific debug agent
│   │   ├── test-auditor.md          # Test coverage audit
│   │   ├── test-strategist.md       # Test strategy design
│   │   ├── ralph-executor.md        # Ralph iteration executor
│   │   └── ui-reviewer.md           # UI/UX review for frontend files
│   ├── templates/          # Output templates + pipeline definition
│   │   ├── pipeline.json            # Pipeline definition (5 variants)
│   │   ├── architecture.md          # Architect output template
│   │   ├── plan.md                  # YAML frontmatter + XML deep work tasks
│   │   ├── research.md              # Severity-tagged findings (H/M/L)
│   │   ├── verification.md          # 3-level goal-backward results
│   │   ├── summary.md               # Per-task execution summary
│   │   ├── report.md                # Final report with traceability
│   │   └── ...                      # + 14 more templates
│   ├── checklists/         # Language-specific code review checklists (7)
│   │   ├── general.md, javascript.md, python.md, go.md
│   │   ├── java.md, rust.md, csharp-wpf.md
│   └── resources/
│       └── type-guides.md  # Per-type workflow guides (8 types)
│
├── tests/                  # 196 automated tests (unit + integration + E2E)
│   ├── unit/               # 112 unit tests
│   ├── integration/        # 59 integration tests
│   └── e2e/                # 25 end-to-end tests
│
├── .github/
│   └── workflows/          # CI: Node 18/20/22, auto on push
│
├── creatework/             # CreateWork skill — workspace bootstrapper
│   └── SKILL.md
│
└── hooks/                  # Hook auto-activation system (TypeScript source)
    ├── src/                # TypeScript source
    ├── dist/               # Compiled JS (fallback only)
    ├── tests/              # Test suite
    └── skill-rules.json    # Trigger rules (master copy)
```

## Forge v7.1 "Bastion" — Overview

Context-Engineered Autonomous Development System with engine-driven pipeline execution, architecture-guided planning, and 7-layer quality enforcement.

### What's New in v7.1

| Feature | Description |
|---|---|
| **VPM Merger** | verifier.md (413 lines) merged into verification-pm.md — self-contained final verification, saving ~7,000 tokens/session |
| **Architect Split** | architect.md split into 80-line router + 4 mode-specific reference files — saves ~3,500 tokens/invocation |
| **Orchestrator Optimization** | Engine commands injected first turn only, not every turn — saves ~6,000 tokens per 30-message session |
| **Universal Patterns** | .NET/WinForms bias removed from Self-Check and Bug Patterns — now language-neutral |
| **8-Step Pipeline** | Branch merged into Checkpoint, Cleanup into Finalize — 10→8 steps |
| **Shared Hook Modules** | `hooks/shared/constants.js` + `pipeline.js` — ~200 lines of duplication eliminated |
| **Gate Guard Security** | bash -c/heredoc/dd bypass detection, atomic audit log, unified allowlists |
| **False Positive Fix** | Score threshold, keyword pruning, word boundaries, graduated negative scoring |
| **Meta-Workflow Exclusion** | skill-creator sessions no longer trigger forge activation |
| **MCP Passthrough** | Read-only MCP tools automatically allowed when activation pending |
| **9 Gates** | Was 10 — Gate count corrected, documentation accuracy fixed |
| **Session Dedup** | skill-activation now deduplicates suggestions within a session |

### What's New in v7.0

| Feature | Description |
|---|---|
| **exit(2) Migration** | All 10 gates now use exit(2) for proper Claude Code blocking — no more silent failures |
| **196 Automated Tests** | Unit (112) + Integration (59) + E2E (25) with 100% pass rate across 20 test files |
| **GitHub Actions CI** | Node 18/20/22 matrix, auto-runs on every push |
| **Scoring Corpus** | 105 prompts validated — Precision 100%, Recall 100% |
| **24 SECRET_PATTERNS** | Was 19 — added JWT, Cloudflare, Heroku, DigitalOcean, JDBC patterns |
| **.env Protection** | .env files blocked even without an active pipeline |
| **Prototype Pollution Defense** | configSet now guards against `__proto__`, `constructor`, `prototype` keys |
| **63 CODE_EXTENSIONS** | Was 47 — added .mjs, .mts, .cjs, .cts, .astro and more |
| **17 SKIP_PATHS** | Was 10 — added dist/, build/, vendor/, __pycache__/, .next/, target/ |
| **Lock TTL** | 2-hour stale lock detection prevents stuck pipelines |
| **docs Type Routing** | `docs` type now routes to doc-reviewer agent |
| **Custom Agent Model Routing** | Profile-defined model routing for custom agents |
| **Dead Config Cleanup** | 6 unused config fields removed |
| **Quick Pipeline Fix** | entry_gate corrected from "approved" to "planned" |
| **Fail-Closed stdin Parsing** | Malformed JSON input triggers safe denial instead of silent pass |

### Two Modes

| Mode | Command | What It Does |
|---|---|---|
| **Task Mode** | `/forge "add login feature"` | Single task: research → architect guide → plan → execute → verify |
| **Project Mode** | `/forge --init` then `/forge --phase N` | Multi-phase: roadmap → architecture → phases → milestones |

### Standard Pipeline (8 Steps)

```
Step 1:   INIT             → Parse request, detect type/scale/paradigm
Step 2:   RESEARCH         → Parallel codebase exploration (haiku×N → sonnet synthesis)
Step 2.5: ARCHITECT GUIDE  → Identify architecture pattern → generate design-guide.md
Step 3:   PLAN             → must_haves + deep work tasks (reads design-guide.md)
Step 4:   PLAN-CHECK       → 9-dimension verification (D1-D9, max 3 revision loops)
Step 5:   CHECKPOINT       → User approval + git branch creation
Step 6:   EXECUTE          → Wave-based parallel implementation + review + QA + VPM
Step 7:   VERIFY           → VPM goal-backward 3-level verification
Step 8:   FINALIZE         → Report generation, PR proposal, cleanup
```

### Pipeline Variants

| Variant | Steps | Use Case |
|---|---|---|
| **standard** | All 8 steps | Feature development, refactoring, infra |
| **trivial** | init → execute → finalize (3) | Typo fix, variable rename, single import (max 3 lines) |
| **quick** | init → plan → execute → verify → finalize (5) | Single-file changes, ≤50 LOC |
| **debug** | reproduce → hypothesize → test → fix → verify (5) | Scientific bug debugging |
| **ralph** | init → iterate until tests pass | Test-driven iteration |

### Project Mode Lifecycle

```
/forge --init              Create project: define vision → generate roadmap → design architecture
        │
/forge --phase 1           Execute phase 1 through the 8-step pipeline
        │
/forge --phase 2           Execute phase 2 (depends on phase 1 completion)
        │
/forge --milestone         Verify cross-phase integration at milestone boundary
        │
/forge --autonomous        Auto-chain all remaining phases
```

### Key Innovations

| Feature | Description |
|---|---|
| **Engine-Driven** | Pipeline state in `pipeline-state.json`. Gate guard hard-blocks violations. PM follows engine instructions. |
| **Architecture-Guided** | Architect agent identifies codebase patterns (DDD, Clean, Hexagonal, etc.) and guides planner to follow them. |
| **Context Engineering** | PM uses ≤15% of context window. Agents get fresh context each. File-based communication prevents context rot. |
| **Goal-Backward Verification** | Not "did tasks complete?" but "does the codebase deliver what was promised?" 3 levels: Exists → Substantive → Wired. |
| **Deep Work Rules** | Every task MUST have `read_first`, `acceptance_criteria`, concrete `action`. No vague instructions. |
| **must_haves** | Plan frontmatter defines verifiable success: `truths` (user behaviors), `artifacts` (files + exports), `key_links` (connections). |
| **Wave-Based Execution** | Dependency-graph based parallel execution. Independent tasks run concurrently (max 3). |
| **Deviation Rules R1-R4** | Auto-fix bugs (R1), add missing features (R2), resolve blockers (R3), STOP for architecture changes (R4). |
| **9D Plan Checker** | D1-D8 (requirements, completeness, dependencies, key links, scope, verification, deep work, tests) + D9 (architecture compliance). |

### 18 Specialized Agents (+ custom)

| # | Agent | Role |
|---|---|---|
| 1 | **researcher** | Parallel codebase exploration + domain investigation |
| 2 | **planner** | must_haves + deep work task plan generation |
| 3 | **plan-checker** | 9-dimension plan quality gate |
| 4 | **implementer** | Code implementation with deviation rules + self-check |
| 5 | **code-reviewer** | 11-perspective review (bugs, security, SOLID, wiring, anti-patterns) |
| 6 | **qa-inspector** | Build/test verification + caller impact + anti-pattern scan |
| 7 | **verification-pm** | VPM: goal-backward 3-level verification (wave boundary + final) |
| 8 | **doc-reviewer** | Documentation quality review |
| 9 | **architect** | Architecture design / analyze / ADR / guide (4 modes) |
| 10 | **roadmapper** | Project roadmap generation from requirements |
| 11 | **integration-checker** | Cross-phase integration verification at milestones |
| 12 | **debugger** | Scientific debug (reproduce → hypothesize → test → fix) |
| 13 | **test-auditor** | Test coverage audit after plan-check |
| 14 | **test-strategist** | Test strategy design |
| 15 | **ralph-executor** | Ralph mode iteration executor |
| 16 | **ui-reviewer** | UI/UX review for frontend files |
| 17 | **verifier** | Legacy verifier (replaced by VPM in standard pipeline) |
| 18 | **custom:{name}** | Project-specific agents via `.forge/agents/{name}.md` |

### 8 Task Types

| Type | Flow |
|---|---|
| `code` | Full pipeline with TDD + architecture guide |
| `code-bug` | Lightweight: reproduce → diagnose → fix |
| `code-refactor` | Behavior-preserving: baseline tests → refactor → regression |
| `docs` | Research → write → doc-review (routed to doc-reviewer agent) |
| `analysis` | Research → report only (no code changes) |
| `analysis-security` | OWASP Top 10 audit with CWE IDs (opus model) |
| `infra` | Dry-run → approve → execute with rollback plan |
| `design` | Architect agent: design / analyze / ADR |

### Gate Guard (9 Gates)

| Gate | What It Blocks | How |
|---|---|---|
| **Gate 1** | plan.md Write without research.md | exit(2) hard block |
| **Gate 2** | Source code Edit/Write before execute step | exit(2) hard block |
| **Gate 2B** | Bash file-writing commands (echo/sed/cp/etc.) on code files | exit(2) hard block |
| **Gate 3** | git commit with failed build/test | exit(2) hard block |
| **Gate 7** | git push / gh pr create without VPM verification | exit(2) hard block |
| **Gate 4** | report.md Write without verification.md | exit(2) hard block |
| **Gate 5** | Large edits (>500 chars) or overwrites (>100 lines) | exit(2) hard block |
| **Gate 5T** | Trivial pipeline: >3 lines per edit | exit(2) hard block |
| **Gate 6** | Secret/credential detection (24 patterns) + .env file blocking | exit(2) hard block |

**Features:** 9 gates use exit(2) for proper Claude Code blocking. Per-gate try-catch isolation (fail-closed). 63 file type coverage. 17 skip paths. Audit log (`.forge/gate-guard-audit.jsonl`). Lock TTL (2h stale detection). Fail-closed stdin parsing. Prototype pollution defense.

### Testing

Forge v7.1 includes a comprehensive test suite with **196 automated tests** across 20 test files.

| Category | Count | Coverage |
|---|---|---|
| **Unit** | 112 | Gate logic, scoring, config, secret patterns, extensions |
| **Integration** | 59 | Gate interactions, pipeline state, orchestrator, tracker |
| **E2E** | 25 | Full pipeline flows, CI simulation, hook lifecycle |
| **Total** | **196** | **100% pass rate** |

```bash
npm test              # Run all 196 tests
```

**CI:** GitHub Actions runs automatically on every push, testing against Node.js 18, 20, and 22.

**Scoring validation:** 105-prompt corpus achieves Precision 100% and Recall 100%.

### Workspace Hooks (v7.1)

| Hook | Trigger | What It Does |
|---|---|---|
| `forge-gate-guard` | PreToolUse | 9 gates: pipeline enforcement + secret detection + audit log (all exit(2)) |
| `forge-orchestrator` | UserPromptSubmit | Injects pipeline state every turn; engine commands first turn only |
| `forge-tracker` | PostToolUse | Context pressure monitor + build/test detection + agent output validation |
| `forge-statusline` | Notification | Shows project/phase/step status in terminal |
| `skill-activation` | UserPromptSubmit | 3-layer prompt analysis (scored keywords + 35 intents + smart scoring) |
| `skill-activation-guard` | PreToolUse | Blocks non-allowed tools until Skill('forge') invoked (score ≥65) |
| `skill-activation-stop` | Stop | Blocks text-only responses until Skill('forge') invoked |

### Quality System (7-Layer Defense)

```
L1:   Deep Work (Planning)       — 9D plan checker, read_first + acceptance_criteria
L2:   Self-Check (Implementation) — 6-item checklist, stuck detection, decision lock
L3:   Peer Review (Code Review)   — 11 perspectives, language checklists
L3.5: Backpressure (Code)         — Build/test MUST pass before commit
L4:   QA Gate (Wave Boundary)     — Build, test, caller impact, anti-patterns
L4.5: VPM Cross-Check (Code)      — Independent verification at wave boundary + final
L5:   Goal-Backward (Verification) — Exists → Substantive → Wired
L6:   Auto-Ralph (Code)           — Auto-enter Ralph on verify failure
L7:   Gate Guard (Code)           — 9 gates, all exit(2), per-gate fail-closed, audit log
```

### Usage Examples

**Task mode:**
```
/forge "implement user authentication with JWT"
/forge "refactor the payment module" --scale medium
/forge "security audit on API endpoints" --type analysis-security
/forge "fix the login crash on empty password" --type code-bug
/forge --trivial "fix typo: cosnt → const in app.js"
/forge --quick "add missing null check in UserService"
```

**Project mode:**
```
/forge --init                    # Create project with roadmap + architecture
/forge --init --from prd.md     # Create from existing PRD document
/forge --status                  # Show project progress dashboard
/forge --phase 1                 # Execute phase 1
/forge --discuss 2               # Capture decisions for phase 2
/forge --phase 2                 # Execute phase 2
/forge --milestone               # Verify milestone integration
/forge --autonomous              # Auto-execute all remaining phases
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

## Hook Auto-Activation

A `UserPromptSubmit` hook that analyzes every prompt and suggests relevant skills automatically.

**Unified scoring (v1.1):**
1. **Keyword match** — scored keywords (15pt) + low-weight keywords (8pt)
2. **Intent patterns** — 35 regex patterns with distance constraints (.{0,40}) → +20 per match
3. **Smart scoring** — file extensions (+50), action verbs with word boundaries (+30), code identifiers (+20), graduated negative signals (strong -40, mild -20), threshold 40, block threshold 65

**Design principles:**
- **Zero-dependency** — only Node.js built-in APIs
- **Fail-open** — all errors exit 0 with empty stdout (never blocks Claude)
- **Fast** — pre-compiled JS, no cold start
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

Or one-liner:
```bash
curl -sL https://raw.githubusercontent.com/EcoKG/forge-skills/main/setup.sh | bash
```

The installer automatically:

1. **Checks Node.js** — detects system Node.js or nvm
2. **Installs skills** — copies `forge/` and `creatework/` to `~/.claude/skills/`
3. **Deploys hooks** — gate-guard, orchestrator, tracker, statusline, skill-activation
4. **Registers hooks** — adds all hooks to `~/.claude/settings.json`
5. **Creates state dir** — `~/.claude/hooks/state/` for session tracking

> The installer merges into your existing `settings.json` — it will not overwrite your current settings.

### Verify

```bash
echo '{"session_id":"test","prompt":"기능 구현 해줘"}' | node ~/.claude/skills/forge/hooks/activation/skill-activation.js
```

### Manual Install (Advanced)

```bash
# 1. Copy skills
cp -r forge ~/.claude/skills/forge
cp -r creatework ~/.claude/skills/creatework

# 2. Install forge workspace hooks
node ~/.claude/skills/forge/hooks/install.js

# 3. Copy skill rules
cp forge/hooks/activation/skill-rules.json ~/.claude/skills/skill-rules.json
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
| `forge/` | Forge v7.1 "Bastion" — 엔진 기반 자율 개발 시스템 |
| `tests/` | 196개 자동화 테스트 (unit 112 + integration 59 + e2e 25) |
| `.github/` | GitHub Actions CI (Node 18/20/22) |
| `creatework/` | CreateWork — 워크스페이스 생성 + VSCode 실행 |
| `hooks/` | Hook 자동 활성화 시스템 — 프롬프트 분석 후 관련 스킬 자동 제안 |

### Forge v7.1

엔진 기반 파이프라인으로 개발 전체 라이프사이클을 자율 관리하는 시스템입니다.

**v7.1 신규:** VPM 통합 (verifier.md → verification-pm.md, ~7,000 토큰 절약), Architect 분할 (80줄 라우터 + 4개 모드별 참조 파일), 오케스트레이터 최적화 (엔진 커맨드 첫 턴만 주입, ~6,000 토큰 절약), Universal Patterns (.NET/WinForms 편향 제거), 8단계 파이프라인 (Branch→Checkpoint 통합, Cleanup→Finalize 통합), 공유 훅 모듈 (constants.js + pipeline.js, ~200줄 중복 제거), Gate Guard 보안 강화 (bash -c/heredoc/dd 우회 감지), False Positive 수정 (스코어 임계값, 키워드 정리, graduated negative scoring), Meta-Workflow 제외, MCP Passthrough, 9 게이트 (10→9 수정), Session Dedup

**v7.0 신규:** exit(2) 마이그레이션 (10게이트 전체), 196개 자동화 테스트 (100% pass), GitHub Actions CI (Node 18/20/22), 스코어링 코퍼스 105개 프롬프트 (Precision/Recall 100%), 24개 SECRET_PATTERNS (+JWT/Cloudflare/Heroku/DO/JDBC), .env 보호 (파이프라인 없이도 동작), prototype pollution 방어, 63개 CODE_EXTENSIONS (+.mjs/.mts/.cjs/.cts/.astro), 17개 SKIP_PATHS (+dist/build/vendor/__pycache__/.next/target), Lock TTL (2시간 stale 감지), docs 타입 doc-reviewer 라우팅, 커스텀 에이전트 모델 라우팅, dead config 정리 (6개 필드 제거), quick 파이프라인 entry_gate 수정, fail-closed stdin 파싱

#### 두 가지 모드

| 모드 | 커맨드 | 설명 |
|---|---|---|
| **태스크 모드** | `/forge "로그인 기능 구현"` | 단일 작업: 리서치 → 설계 가이드 → 계획 → 구현 → 검증 |
| **프로젝트 모드** | `/forge --init` → `/forge --phase N` | 다단계: 로드맵 → 아키텍처 → 페이즈 → 검증 |

#### 표준 파이프라인 (8단계)

```
INIT → RESEARCH → ARCHITECT GUIDE → PLAN → PLAN-CHECK(9D) → CHECKPOINT(+Branch)
  → EXECUTE(Wave병렬+VPM) → VERIFY(VPM) → FINALIZE(+Cleanup)
```

#### 파이프라인 변형

| 변형 | 단계 | 용도 |
|---|---|---|
| **standard** | 8단계 전체 | 기능 개발, 리팩토링, 인프라 |
| **trivial** | 3단계 (init→execute→finalize) | 오타, 변수명 변경, import 1줄 (최대 3줄) |
| **quick** | 5단계 | 단일 파일, 50줄 이하 변경 |
| **debug** | 5단계 | 과학적 버그 디버깅 |
| **ralph** | 반복 | 테스트 통과할 때까지 반복 |

#### 핵심 혁신

| 기능 | 설명 |
|---|---|
| **엔진 기반** | pipeline-state.json이 상태 관리. Gate guard가 위반 차단. PM은 엔진 지시를 따름. |
| **아키텍처 가이드** | Architect 에이전트가 코드베이스 패턴 분석 (DDD, Clean Architecture 등) → 플래너가 설계를 따름 |
| **컨텍스트 엔지니어링** | PM은 컨텍스트 15% 이하. 에이전트는 매번 fresh context. 파일 기반 통신으로 context rot 방지. |
| **Goal-Backward 검증** | VPM이 "목표 달성 여부" 역추적 검증. Exists → Substantive → Wired 3단계. |
| **Deep Work** | 모든 태스크에 `read_first`, `acceptance_criteria`, 구체적 `action` 필수. |
| **9차원 Plan Checker** | D1-D8 + D9(아키텍처 적합성) — 설계 위반 플랜 차단 |
| **Wave 병렬 실행** | 의존성 그래프 기반 병렬. 독립 태스크 동시 실행 (최대 3개). |
| **Deviation Rules** | 버그 자동 수정(R1), 누락 기능 추가(R2), 차단 해결(R3), 아키텍처 변경은 중단(R4). |

#### 18개 전문 에이전트 (+ 커스텀)

| # | 에이전트 | 역할 |
|---|---|---|
| 1 | **researcher** | 코드베이스 탐색 + 도메인 조사 (병렬 haiku → sonnet 합성) |
| 2 | **planner** | must_haves + deep work 태스크 플랜 생성 |
| 3 | **plan-checker** | 9차원 플랜 품질 검증 |
| 4 | **implementer** | 코드 구현 + deviation rules + self-check |
| 5 | **code-reviewer** | 11관점 리뷰 (버그, 보안, SOLID, wiring, anti-pattern) |
| 6 | **qa-inspector** | 빌드/테스트 + caller impact + anti-pattern 스캔 |
| 7 | **verification-pm** | VPM: Goal-Backward 3단계 검증 (wave 경계 + 최종) |
| 8 | **architect** | 아키텍처 설계 / 분석 / ADR / 가이드 (4모드) |
| 9 | **doc-reviewer** | 문서 품질 리뷰 |
| 10 | **roadmapper** | 프로젝트 로드맵 생성 |
| 11 | **integration-checker** | 크로스 페이즈 통합 검증 |
| 12 | **debugger** | 과학적 디버깅 (재현 → 가설 → 테스트 → 수정) |
| 13-17 | test-auditor, test-strategist, ralph-executor, ui-reviewer, verifier | 전문 검증 에이전트 |
| 18 | **custom:{name}** | `.forge/agents/{name}.md`로 프로젝트별 커스텀 (프로필 기반 모델 라우팅 지원) |

#### Gate Guard (9 게이트)

| 게이트 | 차단 대상 | 동작 |
|---|---|---|
| Gate 1 | research.md 없이 plan.md 작성 | exit(2) 차단 |
| Gate 2 | execute 단계 전 코드 편집 | exit(2) 차단 |
| Gate 2B | Bash 파일 쓰기 명령 (echo/sed/cp 등) | exit(2) 차단 |
| Gate 3 | 빌드/테스트 실패 시 git commit | exit(2) 차단 |
| Gate 7 | VPM 검증 없이 git push / gh pr create | exit(2) 차단 |
| Gate 4 | verification.md 없이 report.md 작성 | exit(2) 차단 |
| Gate 5 | 대규모 편집 (500자+ 또는 100줄+) | exit(2) 차단 |
| Gate 5T | trivial 파이프라인에서 3줄 초과 편집 | exit(2) 차단 |
| Gate 6 | 시크릿/인증정보 감지 (24패턴) + .env 파일 차단 | exit(2) 차단 |

**9 게이트 전체 exit(2).** 63개 파일 확장자 보호. 17개 skip 경로. 게이트별 독립 fail-closed. Lock TTL (2시간). 감사 로그 (`.forge/gate-guard-audit.jsonl`). Prototype pollution 방어. Fail-closed stdin 파싱.

#### 테스트

| 카테고리 | 개수 | 범위 |
|---|---|---|
| **Unit** | 112 | 게이트 로직, 스코어링, 설정, 시크릿 패턴, 확장자 |
| **Integration** | 59 | 게이트 상호작용, 파이프라인 상태, 오케스트레이터, 트래커 |
| **E2E** | 25 | 전체 파이프라인 흐름, CI 시뮬레이션, 훅 생명주기 |
| **합계** | **196** | **100% pass rate** |

```bash
npm test              # 196개 테스트 전체 실행
```

CI가 push마다 자동 실행 (Node.js 18, 20, 22). 스코어링 코퍼스 105개 프롬프트 — Precision 100%, Recall 100%.

#### 사용 예시

```
/forge "JWT 기반 사용자 인증 구현"
/forge "결제 모듈 리팩토링" --scale medium
/forge "API 보안 감사" --type analysis-security
/forge --trivial "cosnt → const 오타 수정 in app.js"
/forge --quick "UserService null check 추가"
/forge --init                    # 프로젝트 생성 (로드맵 + 아키텍처)
/forge --phase 1                 # 1번 페이즈 실행
/forge --autonomous              # 남은 페이즈 자동 실행
```

#### 품질 시스템 (7단계 방어)

```
L1:   Deep Work (계획)        — 9차원 plan checker, read_first + acceptance_criteria
L2:   Self-Check (구현)       — 6항목 체크리스트, stuck detection, decision lock
L3:   Peer Review (리뷰)      — 11관점 리뷰, 언어별 체크리스트
L3.5: Backpressure (코드)     — 빌드/테스트 통과 필수
L4:   QA Gate (Wave 경계)     — 빌드, 테스트, caller impact, anti-pattern
L4.5: VPM Cross-Check (코드)  — Wave 경계 + 최종 독립 검증
L5:   Goal-Backward (검증)    — Exists → Substantive → Wired
L6:   Auto-Ralph (코드)       — 검증 실패 시 자동 Ralph 모드
L7:   Gate Guard (코드)       — 9 게이트, 전체 exit(2), fail-closed, 감사 로그
```

### 설치

```bash
git clone https://github.com/EcoKG/forge-skills.git
cd forge-skills
bash install.sh
```

또는 원라인:
```bash
curl -sL https://raw.githubusercontent.com/EcoKG/forge-skills/main/setup.sh | bash
```

### 삭제

```bash
node ~/.claude/skills/forge/hooks/install.js uninstall
rm -rf ~/.claude/skills/forge ~/.claude/skills/creatework
rm -rf ~/.claude/hooks/state ~/.claude/skills/skill-rules.json
```

## License

MIT
