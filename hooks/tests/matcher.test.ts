import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { RulesMatcher } from '../src/rules-matcher.js';
import type { SkillRules } from '../src/types.js';

const TEST_RULES: SkillRules = {
  version: '1.0',
  skills: {
    'forge': {
      type: 'domain',
      enforcement: 'suggest',
      priority: 'high',
      promptTriggers: {
        keywords: ['forge', '기능 구현', 'feature implementation', '버그 수정'],
        intentPatterns: [
          '(create|add|implement|build|만들|구현).*?(feature|기능|module|모듈)',
          '(fix|수정|고치).*?(bug|버그|error|에러)',
        ],
      },
    },
    'create-research': {
      type: 'domain',
      enforcement: 'suggest',
      priority: 'medium',
      promptTriggers: {
        keywords: ['research', '리서치', 'codebase analysis'],
        intentPatterns: [
          '(analyze|분석|조사).*?(codebase|코드베이스|code|코드)',
          '(codebase|코드베이스|code|코드).*?(analyze|분석|조사)',
        ],
      },
    },
    'brand-guidelines': {
      type: 'guardrail',
      enforcement: 'block',
      priority: 'critical',
      promptTriggers: {
        keywords: ['brand', '브랜드', 'logo', '로고'],
        intentPatterns: [],
      },
    },
  },
};

describe('RulesMatcher', () => {
  const matcher = new RulesMatcher(TEST_RULES);

  describe('keyword matching', () => {
    it('should match exact keyword (case-insensitive)', () => {
      const results = matcher.matchPrompt('I want to use forge for this');
      assert.ok(results.length > 0);
      assert.equal(results[0].skillName, 'forge');
      assert.ok(results[0].matchedKeywords.includes('forge'));
    });

    it('should match Korean keywords', () => {
      const results = matcher.matchPrompt('이 모듈의 버그 수정 해줘');
      assert.ok(results.some(r => r.skillName === 'forge'));
    });

    it('should match multiple skills', () => {
      const results = matcher.matchPrompt('forge로 코드베이스 리서치 해줘');
      assert.ok(results.length >= 2);
      const names = results.map(r => r.skillName);
      assert.ok(names.includes('forge'));
      assert.ok(names.includes('create-research'));
    });

    it('should be case-insensitive', () => {
      const results = matcher.matchPrompt('FORGE 써줘');
      assert.ok(results.some(r => r.skillName === 'forge'));
    });
  });

  describe('intent pattern matching', () => {
    it('should match intent pattern (English)', () => {
      const results = matcher.matchPrompt('create a new authentication feature');
      assert.ok(results.some(r => r.skillName === 'forge'));
      assert.ok(results[0].matchedIntents.length > 0);
    });

    it('should match intent pattern (Korean)', () => {
      const results = matcher.matchPrompt('로그인 기능 구현해줘');
      assert.ok(results.some(r => r.skillName === 'forge'));
    });

    it('should match analysis intent', () => {
      const results = matcher.matchPrompt('이 코드베이스를 분석해줘');
      assert.ok(results.some(r => r.skillName === 'create-research'));
    });
  });

  describe('priority sorting', () => {
    it('should sort by priority (critical > high > medium)', () => {
      const results = matcher.matchPrompt('forge로 브랜드 리서치 해줘');
      // brand-guidelines is critical, forge is high, create-research is medium
      assert.ok(results.length >= 2);
      const priorities = results.map(r => r.rule.priority);
      const weights = { critical: 4, high: 3, medium: 2, low: 1 };
      for (let i = 1; i < priorities.length; i++) {
        assert.ok(weights[priorities[i]] <= weights[priorities[i - 1]],
          `Expected ${priorities[i-1]} >= ${priorities[i]}`);
      }
    });

    it('should rank by score within same priority', () => {
      const results = matcher.matchPrompt('forge로 기능 구현 해줘');
      // forge should have higher score (keyword + intent match)
      if (results.length >= 2) {
        assert.ok(results[0].score >= results[1].score);
      }
    });
  });

  describe('no match', () => {
    it('should return empty array for unrelated prompt', () => {
      const results = matcher.matchPrompt('what is the weather today?');
      assert.equal(results.length, 0);
    });

    it('should return empty for empty prompt', () => {
      const results = matcher.matchPrompt('');
      assert.equal(results.length, 0);
    });
  });

  describe('edge cases', () => {
    it('should handle rules with no promptTriggers', () => {
      const rules: SkillRules = {
        version: '1.0',
        skills: {
          'no-triggers': {
            type: 'domain',
            enforcement: 'suggest',
            priority: 'low',
          },
        },
      };
      const m = new RulesMatcher(rules);
      const results = m.matchPrompt('anything');
      assert.equal(results.length, 0);
    });

    it('should handle invalid regex in intentPatterns gracefully', () => {
      const rules: SkillRules = {
        version: '1.0',
        skills: {
          'bad-regex': {
            type: 'domain',
            enforcement: 'suggest',
            priority: 'low',
            promptTriggers: {
              intentPatterns: ['(unclosed group'],
            },
          },
        },
      };
      const m = new RulesMatcher(rules);
      // Should not throw
      const results = m.matchPrompt('test');
      assert.equal(results.length, 0);
    });
  });
});
