/**
 * Semantic Analyzer — Conversation flow pattern detection for activation scoring.
 *
 * Analyzes multi-turn conversation history to detect escalation patterns
 * that indicate implicit code modification intent. Works without LLM calls
 * by analyzing existing per-turn scoring metadata (score, negativeSignal, keywords).
 *
 * Detected patterns:
 *   - question_to_complaint: question turn followed by negative observation → implicit bug report
 *   - description_to_action: symptom description followed by action verb → escalation
 *   - observation_to_implicit: observation with symptom cluster but no action verb
 *   - progressive_investigation: 3+ turns with monotonically increasing scores
 *
 * Feature flag: SEMANTIC_ANALYZER_ENABLED (default: enabled, set 'false' to disable)
 * Fail-open: any error returns { pattern: null, confidence: 0, bonus: 0 }.
 */

import * as crypto from 'node:crypto';

const FEATURE_FLAG = 'SEMANTIC_ANALYZER_ENABLED';

const SYMPTOM_WORDS = [
  'error', 'bug', 'crash', 'broken', 'fail', 'wrong', 'issue', 'problem',
  '에러', '오류', '버그', '안 됨', '안됨', '문제', '이상', '장애', '먹통',
  '느림', '안보임', '깨짐', '중복', '반복', '현상', '증상',
];

const ACTION_VERBS = [
  'fix', 'change', 'update', 'modify', 'refactor', 'implement', 'create',
  'add', 'remove', 'delete', 'replace', 'move', 'rename', 'deploy',
  '수정', '고쳐', '바꿔', '변경', '추가', '삭제', '구현', '만들',
  '작성', '제거', '분리', '통합', '배포',
];

/**
 * Check if text contains any words from a word list.
 * @param {string} text
 * @param {string[]} wordList
 * @returns {boolean}
 */
function containsAny(text, wordList) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return wordList.some(w => lower.includes(w.toLowerCase()));
}

/**
 * Count how many words from a word list appear in text.
 * @param {string} text
 * @param {string[]} wordList
 * @returns {number}
 */
function countMatches(text, wordList) {
  if (!text) return 0;
  const lower = text.toLowerCase();
  return wordList.filter(w => lower.includes(w.toLowerCase())).length;
}

export class SemanticAnalyzer {
  /**
   * Whether the analyzer is enabled via feature flag.
   */
  get enabled() {
    return process.env[FEATURE_FLAG] !== 'false';
  }

  /**
   * Analyze conversation flow patterns from turn history.
   *
   * @param {Array<{score: number, matchedKeywords: string[], negativeSignal: number, prompt_prefix: string}>} turns
   * @returns {{ pattern: string|null, confidence: number, bonus: number }}
   */
  analyzeFlow(turns) {
    const EMPTY = { pattern: null, confidence: 0, bonus: 0 };

    try {
      if (!this.enabled) return EMPTY;
      if (!Array.isArray(turns) || turns.length < 2) return EMPTY;

      // Analyze last 5 turns only
      const recent = turns.slice(-5);
      const candidates = [];

      // Pattern 1: question_to_complaint
      // Turn N has negative signal + low score, turn N+1 has higher score with action
      candidates.push(this.#detectQuestionToComplaint(recent));

      // Pattern 2: description_to_action
      // Turn N has symptom words, turn N+1 has action verbs
      candidates.push(this.#detectDescriptionToAction(recent));

      // Pattern 3: observation_to_implicit
      // Turn with symptom cluster but no action verb
      candidates.push(this.#detectObservationToImplicit(recent));

      // Pattern 4: progressive_investigation
      // 3+ turns with monotonically increasing scores
      candidates.push(this.#detectProgressiveInvestigation(recent));

      // Return the highest-bonus candidate
      const best = candidates
        .filter(c => c.pattern !== null)
        .sort((a, b) => b.bonus - a.bonus)[0];

      return best || EMPTY;
    } catch {
      return EMPTY;
    }
  }

  // ─── Private Pattern Detectors ──────────────────────────────────────

  /**
   * question_to_complaint: Turn N has negative signal + low score,
   * turn N+1 has higher score with action keywords.
   * Bonus: +15
   */
  #detectQuestionToComplaint(turns) {
    for (let i = 0; i < turns.length - 1; i++) {
      const curr = turns[i];
      const next = turns[i + 1];

      const hasNegative = (curr.negativeSignal || 0) < 0 || curr.score < 20;
      const nextHasAction = next.score > curr.score &&
        (next.matchedKeywords?.length > 0 ||
         containsAny(next.prompt_prefix, ACTION_VERBS));

      if (hasNegative && nextHasAction) {
        return { pattern: 'question_to_complaint', confidence: 0.7, bonus: 15 };
      }
    }
    return { pattern: null, confidence: 0, bonus: 0 };
  }

  /**
   * description_to_action: Turn N has symptom words,
   * turn N+1 has action verbs.
   * Bonus: +20
   */
  #detectDescriptionToAction(turns) {
    for (let i = 0; i < turns.length - 1; i++) {
      const curr = turns[i];
      const next = turns[i + 1];

      const hasSymptom = containsAny(curr.prompt_prefix, SYMPTOM_WORDS);
      const hasAction = containsAny(next.prompt_prefix, ACTION_VERBS);

      if (hasSymptom && hasAction) {
        return { pattern: 'description_to_action', confidence: 0.8, bonus: 20 };
      }
    }
    return { pattern: null, confidence: 0, bonus: 0 };
  }

  /**
   * observation_to_implicit: Turn with symptom cluster (2+ symptom words)
   * but no action verb. Implies implicit request.
   * Bonus: +10
   */
  #detectObservationToImplicit(turns) {
    // Check the most recent turn
    const last = turns[turns.length - 1];
    const symptomCount = countMatches(last.prompt_prefix, SYMPTOM_WORDS);
    const hasAction = containsAny(last.prompt_prefix, ACTION_VERBS);

    if (symptomCount >= 2 && !hasAction) {
      return { pattern: 'observation_to_implicit', confidence: 0.6, bonus: 10 };
    }
    return { pattern: null, confidence: 0, bonus: 0 };
  }

  /**
   * progressive_investigation: 3+ turns with monotonically increasing scores.
   * Indicates building context toward a modification request.
   * Bonus: +10
   */
  #detectProgressiveInvestigation(turns) {
    if (turns.length < 3) return { pattern: null, confidence: 0, bonus: 0 };

    // Check if scores are monotonically increasing across 3+ consecutive turns
    let longestRun = 1;
    let currentRun = 1;

    for (let i = 1; i < turns.length; i++) {
      if (turns[i].score > turns[i - 1].score) {
        currentRun++;
        if (currentRun > longestRun) longestRun = currentRun;
      } else {
        currentRun = 1;
      }
    }

    if (longestRun >= 3) {
      return { pattern: 'progressive_investigation', confidence: 0.65, bonus: 10 };
    }
    return { pattern: null, confidence: 0, bonus: 0 };
  }
}
