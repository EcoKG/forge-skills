# NLP 기반 인텐트 감지 시스템 리서치
## CLI/개발자 도구 스킬 활성화를 위한 최신 동향과 베스트 프랙티스

작성일: 2026-03-21
목적: hook 기반 스킬 활성화 시스템의 장기 아키텍처 설계를 위한 리서치

---

## 1. LLM 기반 인텐트 분류 — 개발자 도구 적용 동향 (2025-2026)

### 핵심 발견

- **패러다임 전환**: 2025-2026년 기준 인텐트 분류의 주류는 rule-based → ML/Transformer → LLM 기반으로 완전히 이동했다. LLM은 zero-shot으로 작동하지만 운영 비용이 높고, Transformer 계열은 labeled data가 필요하지만 정확도가 높다.

- **Adaptive In-Context Learning (ICL) + Chain-of-Thought (CoT)**: 최신 연구는 생성형 LLM을 ICL과 CoT 프롬프팅으로 활용하는 인텐트 감지가 성능 우위를 보임을 확인했다. Claude, Mistral 계열 7개 SOTA LLM을 실세계 데이터셋에서 평가한 연구가 이를 지지한다.

- **코드 변경 인텐트 분류 (LLMCC)**: LLM이 코드 변경의 의도를 분류하는 데 효과적임이 입증되었다. 코드의 맥락을 이해하여 변경 인텐트를 정확히 분류한다 — 개발자 도구 활성화에 직접 적용 가능한 사례.

- **라우팅 기반 아키텍처**: LangGraph 같은 그래프 기반 아키텍처가 병렬 처리, 상태 보존 워크플로우, 고급 에러 처리를 통해 인텐트 분류와 도구 활성화를 통합하는 프레임워크로 부상했다.

- **경량 훈련 불필요 방법론**: 모델 내부 표현의 통계 분석 기반 경량 훈련-프리 방법이 LLM 라우팅 속도 향상을 위해 연구되고 있다 (OpenReview, 2025).

### 관련 링크
- [Intent Detection in the Age of LLMs (arXiv:2410.01627)](https://arxiv.org/html/2410.01627v1)
- [Intent Classification: 2026 Techniques (Label Your Data)](https://labelyourdata.com/articles/machine-learning/intent-classification)
- [Fast Intent Classification via Statistical Analysis of Representations (OpenReview)](https://openreview.net/forum?id=UMuVvvIEvA)
- [LLM for Code Change Intent Classification (ÉTS Montréal)](https://www.etsmtl.ca/en/news/grands-modeles-langage-classification-intentions-changement-code)
- [Enhancing Intent Classification in Agentic LLM Applications (Medium)](https://medium.com/@mr.murga/enhancing-intent-classification-and-error-handling-in-agentic-llm-applications-df2917d0a3cc)

### hook 기반 스킬 활성화에의 적용
현재 시스템은 Claude의 LLM 추론 자체에 인텐트 감지를 위임하는 구조다 (CLAUDE.md의 체크리스트 = system prompt 내 규칙). 이는 "LLM forward pass 안에서 결정" 패턴과 일치한다. 개선 방향으로는 PreToolUse hook에서 경량 통계 기반 분류기를 1차 필터로 두고, 모호한 경우에만 LLM 판단으로 fallback하는 2단계 구조가 검토 가능하다.

---

## 2. Claude Code Hooks 시스템 아키텍처

### 핵심 발견

- **3계층 Hook 구조**: Hook Event (생명주기 지점) → Matcher Group (regex 필터) → Hook Handler (shell command/HTTP endpoint/prompt/agent)의 3계층으로 설계되어 있다. 2026년 초 출시.

- **PreToolUse만 차단 가능**: PreToolUse hook만 `exit 2`로 도구 실행을 차단할 수 있다. PostToolUse는 도구 실행 후 처리만 가능. 이는 스킬 활성화 강제 시스템의 핵심 메커니즘.

- **Exit Code 시맨틱스**: `exit 0` = 성공/진행, `exit 2` = 차단, `exit 1` = 비차단 에러(액션은 진행됨). 현재 forge-skills의 3중 방어 시스템(skill-activation-guard.js의 exit 2)이 이 규약을 정확히 따르고 있다.

- **Handler 타입**: Command hook (shell), Prompt hook (Claude 모델 단일 평가), Agent hook (멀티스텝 실행) 3종류. 인텐트 감지에는 Prompt hook이 가장 적합.

- **스킬 vs 슬래시 커맨드 통합**: 2026년 기준 slash commands와 skills가 통합 시스템으로 합쳐졌다. human-invoked = slash command, agent-invoked = skill로 구분.

### 관련 링크
- [Hooks Reference — Claude Code 공식 문서](https://code.claude.com/docs/en/hooks)
- [Claude Code Hooks: PreToolUse, PostToolUse & All 12 Events (Pixelmojo)](https://www.pixelmojo.io/blogs/claude-code-hooks-production-quality-ci-cd-patterns)
- [Skill Activation Hook — Claude Code (claudefa.st)](https://claudefa.st/blog/tools/hooks/skill-activation-hook)
- [Claude Code Setup: 32 Skills, 17 Hooks (AI Advances)](https://ai.gopubby.com/claude-code-setup-skills-hooks-agents-mcp-blueprint-80bdef0c62f6)
- [Extend Claude with Skills — 공식 문서](https://code.claude.com/docs/en/skills)

### hook 기반 스킬 활성화에의 적용
현재 forge-skills의 3중 방어 시스템 (skill-activation.js + skill-activation-guard.js + skill-activation-stop.js)은 공식 Claude Code hooks 아키텍처의 최적 활용 패턴을 따르고 있다. Layer 1(state file 작성)은 PostToolUse 패턴, Layer 2(exit 2 차단)는 PreToolUse 패턴의 정석이다. 추가 개선점: Prompt hook 타입을 활용하면 shell script 대신 Claude 모델이 직접 인텐트를 평가하는 더 유연한 방어 레이어 구현이 가능하다.

---

## 3. 멀티턴 인텐트 감지 — 대화 컨텍스트 누적 기법

### 핵심 발견

- **컨텍스트 드리프트 문제**: 최신 연구(arXiv:2602.07338)에 따르면 LLM은 멀티턴 대화에서 인텐트 불일치(intent mismatch)로 인해 "길을 잃는" 현상이 발생한다. 단일 메시지가 아닌 누적된 대화 맥락을 정확히 추적해야 한다.

- **LDRA 파이프라인**: Labeling with Diversity and Relevance Augmentation — 멀티턴 인텐트 분류를 위한 RAG 기반 파이프라인. 이전 대화 내용에서 다양성과 관련성을 동시에 고려한 예시를 검색해 인텐트를 분류한다.

- **암묵적 인텐트 추출**: NLU 모듈 출력을 대화 이력에 통합하여 사용자의 암묵적 인텐트를 더 잘 추출하는 방법이 연구되고 있다. 사용자가 직접 "forge 써줘"라고 말하지 않아도 이전 맥락에서 forge가 필요한 작업임을 추론 가능.

- **모호성 처리의 취약점**: LLM 기반 에이전트는 모호성에 직면했을 때 명확한 질문을 하기보다 과잉 헤징(overhedging)하거나 암묵적으로 추측하는 경향이 있다. 명시적 clarification 요청 메커니즘이 필요하다.

- **Action-Based Contrastive Self-Training (ACT)**: Google Research가 제안한 멀티턴 대화 정책 학습 기법. 행동 기반 대조 학습으로 데이터 효율적인 대화 정책을 학습한다.

### 관련 링크
- [Beyond More Context: Retrieval Diversity Boosts Multi-Turn Intent Understanding (arXiv:2510.17940)](https://arxiv.org/html/2510.17940)
- [Intent Mismatch Causes LLMs to Get Lost in Multi-Turn Conversation (arXiv:2602.07338)](https://arxiv.org/html/2602.07338v1)
- [A Survey on LLM-Based Multi-Turn Dialogue Systems (ACM)](https://dl.acm.org/doi/full/10.1145/3771090)
- [Learning to Clarify: Action-Based Contrastive Self-Training (Google Research)](https://research.google/blog/learning-to-clarify-multi-turn-conversations-with-action-based-contrastive-self-training/)
- [NeurIPS 2025 Workshop on Multi-Turn Interactions in LLMs](https://workshop-multi-turn-interaction.github.io/)

### hook 기반 스킬 활성화에의 적용
현재 forge 체크리스트는 단일 메시지 기반으로 작동한다. 멀티턴 연구 결과를 적용하면: (1) 이전 대화에서 "이 코드 문제 있어?"가 있었다면 후속 "고쳐줘"는 context 없이도 forge 필요로 판단 가능, (2) 모호한 요청("이거 좀 봐줘")에 대한 명시적 clarification 요청 로직을 hook에 통합할 수 있다. 대화 세션 내 인텐트 누적 상태를 state file에 저장하는 방식이 실용적 구현 경로다.

---

## 4. Regex vs ML 인텐트 분류 — 개발자 도구에서의 트레이드오프

### 핵심 발견

- **Regex의 한계**: Regex/keyword 기반 시스템은 프로토타입이나 좁은 도메인에서는 유용하지만 근본적으로 brittle하다. 사소한 표현 변화만으로도 분류 실패가 발생하며, 언어적 변이와 동의어 처리에 취약하다. 복잡한 애플리케이션에서는 확장 불가능하다.

- **ML/Transformer의 비용**: Transformer 계열은 정확도가 높지만 labeled training data와 GPU 자원이 필요하다. 반면 LLM은 zero-shot이지만 실행 비용이 높고 제어가 어렵다.

- **2025년 베스트 프랙티스 — 하이브리드 아키텍처**: 빠른 임베딩 매칭을 1차 시도하고 신뢰도가 임계값(보통 0.85) 이하일 때만 LLM으로 fallback. 고신뢰도 인텐트에는 규칙 기반, 넓은 커버리지에는 ML을 결합한다.

- **라우팅 결정 로깅**: 프로덕션 시스템에서 모든 라우팅 결정을 로깅하는 것이 필수 관행이다. 에이전트 실패 빈도가 높으면 더 엄격한 라우터와 fallback 전략을 도입한다.

- **타임아웃 강제**: LLM 호출에는 30-60초 타임아웃을 설정하고, 응답 없을 시 fallback 전략을 즉시 실행한다.

### 관련 링크
- [Hybrid LLM + Intent Classification Approach (Medium/Data Science Collective)](https://medium.com/data-science-collective/intent-driven-natural-language-interface-a-hybrid-llm-intent-classification-approach-e1d96ad6f35d)
- [Intent Recognition and Auto-Routing in Multi-Agent Systems (GitHub Gist)](https://gist.github.com/mkbctrl/a35764e99fe0c8e8c00b2358f55cd7fa)
- [Regex vs AI-based Detection (Nightfall AI)](https://www.nightfall.ai/blog/regex-vs-ai-based-detection)
- [AI Agent Routing Best Practices (Patronus AI)](https://www.patronus.ai/ai-agent-development/ai-agent-routing)
- [LLM Intent Classification (Voiceflow Docs)](https://docs.voiceflow.com/docs/llm-intent-classification-method)

### hook 기반 스킬 활성화에의 적용
현재 CLAUDE.md의 체크리스트는 사실상 "고정밀 regex 규칙 레이어"다 (키워드 매칭: 구현, 만들어줘, fix, 버그 등). 이것은 **의도된 설계**이며 올바른 선택이다 — 스킬 활성화는 false negative(forge가 필요한데 안 씀)의 비용이 false positive(forge가 불필요한데 씀)보다 훨씬 크기 때문. 개선 방향: 현재의 엄격한 키워드 규칙을 유지하되, "판단 애매" 케이스의 로그를 수집하여 점진적으로 규칙을 정교화하는 피드백 루프를 추가.

---

## 5. 한국어 NLP 인텐트 감지 — 구어/비격식체의 도전

### 핵심 발견

- **교착어(Agglutinative) 형태론**: 한국어는 교착어로 여러 형태소가 결합하여 단어를 형성한다. "만들어줘", "만들어 줘", "만들어줄래", "만들어 줄 수 있어?" 등이 동일한 인텐트를 표현하지만 토크나이저에게는 완전히 다른 시퀀스다.

- **토크나이저 불일치**: 표준 BPE(Byte Pair Encoding) 토크나이저는 한국어 형태소 경계를 제대로 처리하지 못한다. MorphPiece처럼 형태소 세그멘테이션 기반의 언어학적 토크나이저가 NLP 성능을 크게 향상시킨다.

- **비격식 구어체의 특수성**: 한국어는 구어체 표현이 매우 다양하다. "고쳐줘" / "고쳐봐" / "고쳐" / "수정해" / "손봐줘" / "다시 짜줘" 가 모두 'fix' 인텐트다. 구어 표현 인식을 위한 AI 기술 개선이 필요하다고 BU Hariri Institute가 강조.

- **맥락 의존성**: 구어체 단어의 의미는 문장 내 맥락에 따라 달라진다. "봐줘"는 "검토해줘"(review intent)일 수도 있고 "고쳐줘"(fix intent)일 수도 있다. 모델이 단어 수준이 아닌 문장 맥락 전체를 이해해야 한다.

- **의료/도메인 특화 데이터셋 부족**: 한국어 의도 감지 및 NER을 위한 고품질 공개 데이터셋이 여전히 부족하다. 특히 개발자 도구 도메인의 한국어 인텐트 데이터셋은 사실상 존재하지 않는다.

### 관련 링크
- [Improving Korean NLP Tasks with Linguistically Informed Subword Tokenization (arXiv:2311.03928)](https://arxiv.org/pdf/2311.03928)
- [An Empirical Study of Tokenization Strategies for Korean NLP Tasks (ACL Anthology)](https://aclanthology.org/2020.aacl-main.17/)
- [Korean Healthcare Intent Detection Dataset (Springer Nature)](https://link.springer.com/article/10.1007/s10489-022-03400-y)
- [Improving AI to Understand Colloquialisms (BU Hariri Institute)](https://www.bu.edu/hic/2021/09/14/improving-ai-technology-to-understand-colloquialisms/)
- [Awesome Korean NLP (GitHub)](https://github.com/datanada/Awesome-Korean-NLP)

### hook 기반 스킬 활성화에의 적용
이것이 현재 시스템의 가장 취약한 지점이다. CLAUDE.md의 체크리스트 키워드("구현", "만들어줘", "수정", "버그")는 격식체 표현 위주다. 실제 사용 패턴:

| 실제 발화 | 체크리스트 커버 여부 |
|----------|-------------------|
| "이거 고쳐" | 아마도 미스 (키워드 "수정"/"fix" 아님) |
| "좀 봐줘" | 미스 (review? fix? 모호) |
| "이 부분 손봐줘" | 미스 |
| "다시 짜" | 미스 |
| "버근데" (오타) | 미스 |

**권장 조치**: scoring corpus에 한국어 구어체 표현을 체계적으로 추가하고, 형태소 분석 없이도 LLM이 맥락으로 판단할 수 있도록 "판단 애매 케이스"를 명시적 예시로 CLAUDE.md에 보강.

---

## 6. 자가 개선 인텐트 분류기 — 피드백 루프 아키텍처

### 핵심 발견

- **RLHF가 기업 표준으로 정착**: 2025년 기준 70%의 기업이 RLHF 또는 DPO(Direct Preference Optimization)를 AI 출력 정렬에 채택했다 (2023년 25%에서 급증). 인텐트 분류기도 이 패러다임으로 수렴 중.

- **Targeted Human Feedback (RLTHF)**: 2025년 발표된 기법. LLM 기반 초기 정렬 후 보상 모델의 보상 분포를 활용하여 어려운 샘플을 식별, 최소한의 인간 교정으로 정렬을 반복 개선한다. 핵심: 모든 샘플을 다시 레이블링하지 않고 불확실한 케이스에만 집중.

- **Active Reward Modeling**: 새로운 모델 동작 탐색과 경계 케이스 정제를 균형 있게 처리하는 비교 쿼리를 선택하는 방식. 인텐트 분류기의 경계 케이스(예: "이거 개선할 수 있을까?" — review인가 forge인가)에 직접 적용 가능.

- **드리프트 방지 안전장치 필수**: 연속 학습은 소수 사용자 입력에 의해 모델이 원치 않는 방향으로 drift할 위험이 있다. 안전장치 없는 피드백 루프는 오히려 위험하다.

- **CRAAC (Consistency Regularised Active Learning with Automatic Corrections)**: WACV 2025 발표. 자동 교정과 일관성 정규화를 결합한 능동 학습 프레임워크. 레이블 비용을 최소화하면서 분류 정확도를 높인다.

### 관련 링크
- [CRAAC: Consistency Regularised Active Learning with Automatic Corrections (WACV 2025)](https://openaccess.thecvf.com/content/WACV2025/papers/Lam_CRAAC_Consistency_Regularised_Active_Learning_with_Automatic_Corrections_for_Real-Life_WACV_2025_paper.pdf)
- [Active Learning and Human Feedback for LLMs (IntuitionLabs)](https://intuitionlabs.ai/articles/active-learning-hitl-llms)
- [Training Language Models to Self-Correct via RL (arXiv:2409.12917)](https://arxiv.org/pdf/2409.12917)
- [RLHF Top Tools 2025 (Labellerr)](https://www.labellerr.com/blog/top-tools-for-rlhf/)
- [Active Learning Guide 2025 (Encord)](https://encord.com/blog/active-learning-machine-learning-guide/)

### hook 기반 스킬 활성화에의 적용
현재 시스템에는 피드백 루프가 없다. 실용적인 자가 개선 파이프라인 제안:

```
[사용자 요청]
  → PreToolUse hook 판단
  → forge 활성화 여부 결정
  → (사용자가 바이패스하거나 forge를 재호출하면) → 불일치 케이스로 로깅
  → scoring-corpus.json에 새 케이스 자동 추가 (draft)
  → 주기적 리뷰 후 corpus 확정
  → 다음 hook 버전에 반영
```

핵심은 모든 판단 결과를 로깅하고, 특히 사용자가 hook 결정에 반발하는 케이스(= 분류 오류 신호)를 자동 포착하는 메커니즘이다. 이것이 `tests/corpus/scoring-corpus.json`의 자연스러운 진화 방향.

---

## 종합 아키텍처 권고

### 현재 시스템 강점
1. Claude의 LLM 추론을 직접 활용하는 설계 — zero-shot, 한국어 지원 내장
2. PreToolUse exit 2 기반의 강제 차단 — 공식 아키텍처의 정석 활용
3. 3중 방어로 단일 실패 지점 제거

### 개선 로드맵 (우선순위 순)

**단기 (즉시 적용 가능)**
- 한국어 구어체 표현을 scoring-corpus.json에 체계적으로 추가
- "판단 애매 케이스" 예시를 CLAUDE.md에 더 많이 추가 (few-shot 효과)
- 모든 hook 판단 결과를 로그 파일에 기록 시작

**중기 (1-2개월)**
- 멀티턴 컨텍스트 누적: state file에 직전 N개 발화의 인텐트 신호 저장
- 판단 오류 케이스 자동 포착: 사용자가 hook 결정에 반발 시 scoring-corpus draft 자동 생성

**장기 (3-6개월)**
- 경량 임베딩 기반 1차 분류 + LLM fallback의 하이브리드 아키텍처
- Prompt hook 타입으로 전환: shell script 대신 Claude 모델이 직접 인텐트 평가
- scoring-corpus 기반 자동화된 regression test 파이프라인

### 핵심 인사이트
> 현재 시스템의 설계 방향 ("판단이 애매하면 forge 우선")은 연구 결과와 일치한다.
> False negative(필요한 forge를 건너뜀)의 비용 > False positive(불필요한 forge 호출)의 비용.
> 이 비대칭 비용 구조가 엄격한 키워드 체크리스트를 정당화한다.
> 단, 한국어 구어체 커버리지 확장은 즉각 필요하다.
