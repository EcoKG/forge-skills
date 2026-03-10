import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { parseInput, formatOutput } from '../src/skill-activation.js';
import type { MatchResult, SkillRule } from '../src/types.js';

describe('skill-activation entry point', () => {
  describe('parseInput', () => {
    it('should parse valid JSON input', () => {
      const input = '{"session_id":"abc","prompt":"use forge"}';
      const result = parseInput(input);
      assert.ok(result);
      assert.equal(result!.session_id, 'abc');
      assert.equal(result!.prompt, 'use forge');
    });

    it('should return null for invalid JSON', () => {
      const result = parseInput('not json');
      assert.equal(result, null);
    });

    it('should return null for empty input', () => {
      const result = parseInput('');
      assert.equal(result, null);
    });

    it('should handle input without prompt field', () => {
      const input = '{"session_id":"abc"}';
      const result = parseInput(input);
      assert.ok(result);
      assert.equal(result!.prompt, undefined);
    });
  });

  describe('formatOutput', () => {
    const mockRule: SkillRule = {
      type: 'domain',
      enforcement: 'suggest',
      priority: 'high',
    };

    it('should format single skill suggestion', () => {
      const matches: MatchResult[] = [
        { skillName: 'forge', rule: mockRule, matchedKeywords: ['forge'], matchedIntents: [], score: 2 },
      ];
      const output = formatOutput(matches);
      assert.ok(output.includes('forge'));
      assert.ok(output.includes('SKILL ACTIVATION'));
    });

    it('should format multiple skill suggestions', () => {
      const matches: MatchResult[] = [
        { skillName: 'forge', rule: mockRule, matchedKeywords: ['forge'], matchedIntents: [], score: 4 },
        { skillName: 'create-research', rule: { ...mockRule, priority: 'medium' }, matchedKeywords: ['research'], matchedIntents: [], score: 2 },
      ];
      const output = formatOutput(matches);
      assert.ok(output.includes('forge'));
      assert.ok(output.includes('create-research'));
    });

    it('should return empty string for no matches', () => {
      const output = formatOutput([]);
      assert.equal(output, '');
    });

    it('should limit to top 3 suggestions', () => {
      const matches: MatchResult[] = Array.from({ length: 5 }, (_, i) => ({
        skillName: `skill-${i}`,
        rule: mockRule,
        matchedKeywords: [`kw-${i}`],
        matchedIntents: [],
        score: 5 - i,
      }));
      const output = formatOutput(matches);
      assert.ok(output.includes('skill-0'));
      assert.ok(output.includes('skill-2'));
      assert.ok(!output.includes('skill-3'));
    });
  });
});
