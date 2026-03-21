---
name: deploy
description: |
  Deployment automation skill for staging, production, and rollback operations.
  Validates environment, builds artifacts, deploys to target, and verifies service health.
  Part of the Forge Framework v8.0 ecosystem.
routing:
  triggers:
    - deploy, 배포
    - release to staging, release to production
    - rollback, 롤백
    - push to staging, push to prod
    - 스테이징 배포, 프로덕션 배포
    - deploy this, ship it
  anti-triggers:
    - explain deployment, explain how deployment works
    - what is CI/CD, what is a pipeline
    - how does Docker work, 배포란 무엇
    - describe the release process
  modes:
    staging: "Deploy to staging environment with smoke tests"
    production: "Full production deployment with approval gate and health verification"
    rollback: "Revert to the previous stable release"
  priority: high
  categories:
    - command
    - code-modify
framework:
  pipeline: deploy-pipeline
  gates:
    - validate-pass
    - build-pass
    - health-pass
  workspace:
    scope:
      - infra/**
      - k8s/**
      - Dockerfile
      - docker-compose*
      - .github/workflows/**
    readonly:
      - src/**
    ignore:
      - node_modules/
      - .git/
      - dist/
      - build/
  quality:
    inherit: true
    add_layers:
      - { name: "security-scan", after: "build" }
      - { name: "config-drift-check", after: "validate" }
---

# deploy — Deployment Automation Skill

> Part of the Forge Framework v8.0 "Nova".
> Pipeline: validate → build → deploy → verify-health.
> **Read-only access to src/**. All changes are scoped to infra/**, k8s/**, and CI config files.

---

## 1. Pipeline Overview

```
validate       — Check environment, credentials, and config drift
build          — Build and tag the Docker image (or artifact)
deploy         — Apply manifests / trigger the deployment
verify-health  — Confirm service health before marking success
```

On failure at any step: stop, report root cause, and do NOT proceed to the next step.

---

## 2. Mode Behavior

### staging
- Target: staging namespace / staging environment URL
- Approval gate: NOT required
- Health check: HTTP 200 on `/health` or `/ping` within 60s
- Rollback on failure: automatic

### production
- Target: production namespace / production URL
- Approval gate: REQUIRED — ask user to confirm before `deploy` step
- Health check: HTTP 200 within 90s + error rate < 1% for 2 minutes
- Rollback on failure: prompt user before auto-rollback (destructive)

### rollback
- Identify the current deployed version and the previous stable tag
- Show the diff (what will change) before proceeding
- Require explicit user confirmation: "Rolling back from vX to vY — proceed?"
- After rollback: run the same health check as the target environment

---

## 3. Step Instructions

### validate
1. Confirm the target environment (staging / production) from context or ask.
2. Check required env vars / secrets are present (do NOT print secret values).
3. Read the current deployment manifest and compare against the last known-good state.
4. If config drift is detected, list the diffs and ask whether to proceed.
5. Verify the Docker daemon / cluster connection is reachable.
6. Produce: `validate-report.md` — list of checks with PASS / FAIL / WARN.

### build
1. Read `Dockerfile` (or the relevant compose service) — do NOT modify it.
2. Determine the image tag: `<service>:<git-sha>` (short SHA preferred).
3. Run the build command and capture output.
4. Run a basic security scan (image layer audit, no known critical CVEs).
5. On build failure: show the last 30 lines of build output and stop.
6. Produce: `build-report.md` — image tag, size, scan result summary.

### deploy
- **staging**: apply manifests or run `docker compose up -d`; record the deployed tag.
- **production**: pause, show the deployment plan, wait for user confirmation, then apply.
- **rollback**: show the target tag, wait for confirmation, then apply the previous manifest.
- Record the deployment in `.forge/<date>/<task-id>/deploy-log.md`.

### verify-health
1. Poll the health endpoint at 5-second intervals (max attempts per mode above).
2. Check application logs for ERROR-level entries in the first 30 seconds.
3. If health check passes: report success with response time and deployed tag.
4. If health check fails: do NOT auto-rollback in production — report failure and ask.
5. Produce: `health-report.md` — endpoint, status, latency, log sample.

---

## 4. Workspace Rules

- **NEVER modify** anything under `src/**` — it is readonly.
- Config changes are limited to `infra/**`, `k8s/**`, `Dockerfile`, `docker-compose*`, `.github/workflows/**`.
- Secrets and credentials must NEVER appear in any artifact or log file.
- `.forge/` is the only write target outside of the declared scope (for artifacts).

---

## 5. Error Handling

| Situation | Action |
|---|---|
| Missing credentials | Stop at validate. List missing vars (names only, no values). |
| Build failure | Stop at build. Show truncated output. Suggest fix. |
| Timeout during health check | Report last known status. Ask user to inspect logs. |
| Production rollback needed | NEVER auto-rollback. Show options and wait for confirmation. |
| Config drift detected | Warn, show diff, ask to proceed or abort. |

---

## 6. Artifacts

All artifacts go to `.forge/<date>/<task-id>/`:

| File | Produced by |
|---|---|
| `validate-report.md` | validate step |
| `build-report.md` | build step |
| `deploy-log.md` | deploy step |
| `health-report.md` | verify-health step |
