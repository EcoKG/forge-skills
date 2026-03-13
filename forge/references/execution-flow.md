# Forge 실행 플로우 상세

> 이 파일은 각 Step 진입 시 해당 섹션만 읽는다. 전체를 한 번에 읽지 않는다.
> 컨텍스트 절약을 위해 현재 Step 섹션만 참조하라.

---

## Step 1: 파싱 + 감지 + 초기화

**완료 시**: meta.json에 `"step": "init_done"` 기록

1. 사용자 입력에서 요청 추출 (불명확하면 질문)
2. 언어, 요청 유형, 규모 감지
3. 실행 전략 추천 → `--exec` 미설정 시 사용자에게 질문 (subagent vs team, 간단한 설명 포함)
4. **병렬 읽기** (하나의 메시지에서 모든 Read 호출):
   - `templates/output.md` — 진행 출력 형식
   - `.claude/forge-rules.md` — 프로젝트 규칙 (있으면)
   - `.claude/settings.local.json` — 권한 확인. 자동 수정하지 않는다.
5. 프로젝트 언어/프레임워크 + 패러다임 감지 → `.claude/project-profile.json`에 캐시
6. slug + 타임스탬프 생성 → `.claude/artifacts/{date}/{slug}-{HHMM}/` 생성 → meta.json 초기화 + index.json 업데이트

산출물 디렉토리는 리서치 전에 반드시 존재해야 한다.

---

## Step 2: 리서치

**생략 조건**: `--direct` / `--no-research` / `--from`
**진입 조건**: meta.json `"init_done"` 확인
**완료 시**: meta.json `"step": "research_done"`

1. `templates/research.md` 읽어 출력 구조 확인
2. 같은 모듈 기존 산출물 확인 (index.json) → 최근(<30일)이면 기준선 재사용
3. Explore 에이전트(haiku) 생성 — 최소 1개, 규모 테이블 최대치까지
4. research.md 합성 (sonnet), 발견 ID: H1, H2, M1, M2, L1…
5. 검증: Glob/Grep으로 참조 파일 존재 확인 → 오래된 참조 수정
6. 산출물 디렉토리에 저장 → 프로젝트 루트에 복사
7. meta.json 체크포인트 업데이트

---

## Step 3: 계획

**생략 조건**: `--direct` / `--from plan.md`
**진입 조건**: meta.json `"research_done"` 확인
**완료 시**: meta.json `"step": "plan_done"`

1. `templates/plan.md` 읽어 출력 구조 확인
2. 계획 작성 (sonnet): [N-M] 작업 ID + [REF:Hx,Mx] 추적성 태그
3. 산출물 디렉토리에 저장 → 프로젝트 루트에 복사
4. 추적성 검증: 모든 HIGH 참조 포함? 유령 참조 없음?
5. 리뷰 (haiku × `--review`): 기본 `--review 1`은 R5 사용.
   - R1: 완전성 — HIGH 발견 반영?
   - R2: 실현 가능성 — 기술적 달성 가능?
   - R3: 위험 — 엣지 케이스?
   - R4: TDD/SOLID — 테스트→구현 순서?
   - R5: 목표 정렬 (기본) — 요청과 일치? 파일 존재?
   점수: PASS(≥7) / NEEDS_REVISION(5–6) / FAIL(≤4)
6. 수정 필요 시 자동 수정 → 재저장
7. 체크포인트 업데이트

---

## Step 4: 체크포인트

**생략 조건**: `--direct`
**진입 조건**: meta.json `"plan_done"` 확인

실행 전 규모 요약 표시:
- 총 페이즈/작업 수, 예상 모델 배분, 실행 전략, 적용 패러다임

**small**: 요약 후 자동 진행.
**medium/large**: 사용자 선택 — "실행" / "수정 후 실행" / "취소"
취소 → meta.json "cancelled". 수정 → 피드백 → 계획 수정 → 재체크포인트.

---

## Step 5: Git 브랜치

**진입 조건**: Step 4 완료

`feature/{slug}` 제안. 이미 feature 브랜치이거나 거부 시 생략.

---

## Step 6: 작업 목록

**진입 조건**: Step 5 완료/생략

- `- [ ]` 파싱 → `[N-M]` ID로 TaskCreate
- `--direct`: PM이 요청 분석 후 최소 plan.md 작성하고 작업 설계
- 페이즈 의존성: 페이즈 N 첫 작업은 페이즈 N-1 마지막 작업에 의존

---

## Step 7: 에이전트 설정

**진입 조건**: Step 6 완료/생략

모드와 관계없이 항상 실행. 프롬프트에 에이전트 품질 향상용 도메인 지식 포함.

1. **프롬프트 병렬 읽기** (하나의 메시지, 여러 Read):
   - **code**: `prompts/implementer.md` + `prompts/code-reviewer.md` + `prompts/qa-inspector.md` + `checklists/general.md` + `checklists/{lang}.md`
   - **docs**: `prompts/implementer.md` + `prompts/doc-reviewer.md`
   - **analysis**: `prompts/analyst.md`만
   - 체크리스트 대체: `checklists/{lang}.md` 없으면 `checklists/general.md`만. meta.json에 기록.

2. **프로젝트 규칙**: `.claude/forge-rules.md`는 Step 1에서 로드됨 — 캐시 사용.

3. **플레이스홀더 치환** (에이전트 생성 시):
   - `{PROJECT_RULES}` → forge-rules.md
   - `{LANG_CHECKLIST}` → checklists/{lang}.md
   - `{GENERAL_CHECKLIST}` → checklists/general.md

4. **team 모드** (medium/large 권장):
   - TeamCreate (slug 팀명)
   - Agent로 implementer + code-reviewer 병렬 생성 (team_name 사용)
   - qa-inspector: 페이즈 경계에서만 생성 → QA 후 종료
   - PM ↔ 에이전트: SendMessage

5. **subagent 모드** (small):
   - TeamCreate 없음, 작업별 Agent 생성 (team_name 없음)
   - 프롬프트 + 치환 플레이스홀더를 Agent 호출에 전달
   - 결과 반환 후 소멸

---

## Step 8: PM 실행 루프

**진입 조건**: Step 7 완료

**TDD**: `script` 외, `--skip-tests` 아닐 때 → 테스트를 구현보다 먼저 실행.

```
FOR EACH task (차단 해제됨, ID 오름차순):
  1. Implementer에 작업 할당
  2. GATE (6항목 — 전부 OK/N/A여야 통과):
     a. 순환/자기 참조 없는가?
     b. 초기화 순서 안전한가?
     c. Null/빈값 안전성 확보?
     d. 저장→로드 왕복 일치?
     e. 이벤트 타이밍 안전?
     f. 빌드+테스트 통과?
  3. PM 구조 점검: 계획 반영, 파일 완전성, TDD/SOLID 준수
  4. Reviewer: code-reviewer / doc-reviewer / 생략(analysis)
  5. 판정: PASS→완료 | NEEDS_REVISION→반복 | REJECT→사용자 선택
  6. 페이즈 종료 → QA → git commit "feat({slug}): complete phase {N}"
  7. 페이즈 경계 보고 (사용자: 계속/수정/중단):
     - 변경 파일 목록 + 줄 수 변화량
     - 리뷰 결과 요약 (PASS/NEEDS_REVISION/REJECT 횟수)
     - 누적 진행률
  8. meta.json 실시간 업데이트
```

**컨텍스트 효율성**: diff + 주변 컨텍스트만 전달 (전체 파일 아님), 현재 페이즈만 (전체 계획 아님), 결과 요약만 (전체 출력 아님).

**한도**: 사소한 수정 ≤5회, 주요 수정 ≤3회, 거부 ≤2회, QA 재시도 ≤2회 → 에스컬레이션.
**타임아웃 (team)**: 구현 10분, 리뷰 5분, QA 5분 → 1회 재생성 → 에스컬레이션.
**안전**: DB/설정/보안/API/의존성 변경 → 사용자 확인 필수.
**병렬**: 같은 페이즈 독립 작업 동시 실행. 같은 파일 수정 시 순차.
**적응형**: 수정 3회+ → 모델 업그레이드 제안. subagent 수정 빈발 → team 전환 제안.

---

## 에러 복구

| 실패 유형 | 1차 | 2차 | 에스컬레이션 |
|---|---|---|---|
| 타임아웃 | 동일 모델 재생성 | 하위 모델로 분할 | 사용자: 건너뛰기/수동/중단 |
| 빌드 실패 | 에러 분석→자동 수정 | 파일 재탐색→재시도 | 사용자: 에러 로그+방향 선택 |
| 테스트 실패 | 실패 분석→구현 수정 | 테스트 범위 축소 | 사용자: 수정/생략/중단 |
| 리뷰 REJECT | 피드백→재구현 | 모델 업그레이드 | 사용자: 요구사항 재확인 |
| 연속 3회 동일 | 5 Whys 분석 | 접근 전환 제안 | 상세 보고+대안 |

핵심: 같은 실패를 같은 방법으로 반복하지 않는다.

---

## Step 9: 마무리

**진입 조건**: Step 8 완료

1. **검증**: meta.json `steps_completed` 확인. 필수 단계 누락 → 사용자 보고.
2. 에이전트 종료 (team: 종료 → 30초 → TeamDelete)
3. plan.md: `- [ ]` → `- [x]` → 루트 재복사
4. meta.json: "completed", 최종 통계
5. `templates/report.md` 읽기 → 보고서 생성 → 산출물 + 루트 저장
6. PR 생성 제안 (code/infra만)
7. 선택적 피드백 수집
8. 학습: 새 패턴 발견 시 `.claude/forge-rules.md`에 즉시 기록

**steps_completed 형식**: `["init", "research", "plan", "checkpoint", "git_branch", "tasks", "agent_setup", "execute", "finalize"]`

**모든 forge 실행은 최소 산출물**: meta.json + research.md + report.md
