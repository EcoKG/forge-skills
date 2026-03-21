# Forge Skills

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
