# Forge Skills

[English](#forge-framework-v80-nova) | [한국어](#한국어-가이드)

Autonomous development framework for Claude Code.

---

## Forge Framework v8.0 "Nova"

**Forge v8.0 "Nova"** transforms forge from a single skill into a **skill execution framework** — a platform where skills run on top of shared infrastructure.

```
┌─────────────────────────────────────────────────┐
│                Claude Code                       │
│                                                 │
│  ┌─────────────────────────────────────────────┐ │
│  │          Forge Framework v8.0 "Nova"         │ │
│  │                                             │ │
│  │  Core Services:                             │ │
│  │  ① Gatekeeper — intent classification       │ │
│  │  ② Workspace Context — file scoping         │ │
│  │  ③ Gate Guard — code modification control   │ │
│  │  ④ Pipeline Engine — step management        │ │
│  │  ⑤ Agent Orchestration — model routing      │ │
│  │  ⑥ Quality System — 7-layer verification    │ │
│  │                                             │ │
│  │  Skills:                                    │ │
│  │  ├── forge-dev (development pipeline)       │ │
│  │  ├── deploy (deployment automation)         │ │
│  │  ├── review (code review)                   │ │
│  │  └── your-skill (custom)                    │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### Key Features

| Feature | Description |
|---|---|
| **Gatekeeper** | Haiku-based intent classifier. Routes prompts to the right skill automatically. |
| **Workspace Context** | Docker-like file scoping. Declare which files your skill can read/write. |
| **Gate Guard** | 9 gates enforce pipeline discipline. Code edits blocked without active pipeline. |
| **Pipeline Engine** | Generic pipeline runner. Skills declare steps; engine manages execution. |
| **2-Layer Defense** | L1 Gatekeeper (soft, fail-open) + L2 Gate Guard (hard, exit(2)) |

### Quick Start

```bash
# 1. Clone
git clone https://github.com/EcoKG/forge-skills.git ~/.claude/skills/forge-skills

# 2. Install hooks
node ~/.claude/skills/forge-skills/forge-framework/core/install.js

# 3. Restart Claude Code — done!
```

### Create Your First Skill

```yaml
# ~/.claude/skills/my-skill/SKILL.md
---
name: my-skill
description: "What this skill does"
routing:
  triggers: ["keyword1", "keyword2"]
---
Your skill instructions here...
```

See the full [Skill Developer Guide](forge-framework/docs/skill-developer-guide.md) for Level 0-4 tutorials.

---

## Project Structure

```
forge-skills/
├── forge-framework/          # v8.0 "Nova" — Skill Execution Framework
│   ├── SKILL.md              # Framework entry point
│   ├── README.md             # Framework documentation
│   ├── core/                 # Hook scripts (9 JS files)
│   │   ├── gatekeeper-init.js
│   │   ├── gatekeeper-router.js
│   │   ├── gate-guard.js
│   │   ├── workspace-context.js
│   │   ├── pipeline-engine.js
│   │   ├── orchestrator.js
│   │   ├── tracker.js
│   │   ├── statusline.js
│   │   └── install.js
│   ├── shared/               # Shared utilities
│   ├── prompts/              # Framework-level prompts (Gatekeeper)
│   ├── skills/forge-dev/     # Development pipeline skill
│   │   ├── prompts/          # 18 agent prompts
│   │   ├── templates/        # Pipeline definitions + artifact templates
│   │   ├── checklists/       # 7 language-specific checklists
│   │   └── references/       # 17 reference documents
│   ├── docs/                 # Developer documentation
│   ├── examples/             # Example skills (deploy, review, release)
│   └── templates/            # Skill scaffold template
│
├── forge/                    # v7.0 "Bastion" (legacy, retained for compatibility)
│   ├── SKILL.md
│   └── hooks/
│
├── setup.sh                  # One-line setup
└── install.sh                # Full installer
```

## Version History

| Version | Codename | Description |
|---|---|---|
| **v8.0** | **Nova** | Skill execution framework. Gatekeeper, Workspace Context, Pipeline Engine generalization. |
| v7.0 | Bastion | Engine-driven pipeline. 9 gates, 17 agents, code-enforced quality. |

See [forge-framework/CHANGELOG.md](forge-framework/CHANGELOG.md) for detailed release notes.

## Example Skills

| Skill | Description |
|---|---|
| [deploy-skill](forge-framework/examples/deploy-skill/) | Deployment automation (staging/production/rollback) |
| [review-skill](forge-framework/examples/review-skill/) | Code review with checklist-based assessment |
| [release-skill](forge-framework/examples/release-skill/) | Release management (version bump, changelog, tagging) |

## Documentation

- [Framework README](forge-framework/README.md) — Architecture, installation, core modules
- [Skill Developer Guide](forge-framework/docs/skill-developer-guide.md) — Level 0-4 tutorial
- [CHANGELOG](forge-framework/CHANGELOG.md) — Version history
- [Skill Template](forge-framework/templates/skill-template/) — Copy-paste scaffold

## License

MIT — see [forge-framework/LICENSE](forge-framework/LICENSE) for details.

---

## 한국어 가이드

Forge Skills는 Claude Code를 위한 자율 개발 프레임워크입니다. Gatekeeper가 사용자 의도를 자동으로 분류하여 적합한 스킬로 라우팅하고, Gate Guard가 파이프라인 외부의 코드 수정을 원천 차단합니다. v8.0 "Nova"부터는 단일 스킬이 아닌 스킬 실행 플랫폼으로 진화하여, 누구나 커스텀 스킬을 추가할 수 있습니다.

### 설치 방법

```bash
# 1. 저장소 클론
git clone https://github.com/EcoKG/forge-skills.git ~/.claude/skills/forge-skills

# 2. 훅 설치
node ~/.claude/skills/forge-skills/forge-framework/core/install.js

# 3. Claude Code 재시작 — 완료!
```

### 주요 기능

| 모듈 | 설명 |
|---|---|
| **Gatekeeper** | Haiku 기반 의도 분류기. 프롬프트를 분석해 적절한 스킬로 자동 라우팅. |
| **Workspace Context** | Docker 마운트 방식의 파일 스코프. 스킬별 읽기/쓰기 범위를 선언적으로 제어. |
| **Gate Guard** | 9개 게이트로 파이프라인 규율 강제. 활성 파이프라인 없이는 코드 수정 차단. |
| **Pipeline Engine** | 범용 파이프라인 실행기. 스킬이 단계를 선언하면 엔진이 실행을 관리. |
| **Agent Orchestration** | 역할별 모델 라우팅. 비용과 능력에 따라 Haiku/Sonnet/Opus를 자동 배정. |
| **Quality System** | 프레임워크 제공 7계층 품질 스택 (딥워크, 셀프체크, 피어리뷰, QA 게이트, VPM). |

### 문서 링크

- [시작하기](docs/getting-started-ko.md) — 설치부터 첫 스킬 실행까지
- [사용 시나리오](docs/usage-scenarios-ko.md) — 실전 사용 예시
- [스킬 개발 가이드](docs/skill-developer-guide-ko.md) — Level 0~4 튜토리얼
