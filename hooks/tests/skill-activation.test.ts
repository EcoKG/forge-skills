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

    // Task [1-1]: block enforcement output
    it('should output BLOCKED message for block enforcement', () => {
      const blockRule: SkillRule = {
        type: 'domain',
        enforcement: 'block',
        priority: 'high',
      };
      const matches: MatchResult[] = [
        { skillName: 'forge', rule: blockRule, matchedKeywords: ['forge'], matchedIntents: [], score: 3 },
      ];
      const output = formatOutput(matches);
      assert.ok(output.includes('BLOCKED'), 'Output should contain "BLOCKED"');
      assert.ok(output.includes('Do not proceed'), 'Output should contain "Do not proceed"');
      assert.ok(output.includes('Skill tool'), 'Output should contain Skill tool invocation instruction');
    });

    // Task [1-1]: block enforcement with custom blockMessage
    it('should include custom blockMessage in block enforcement output', () => {
      const blockRule: SkillRule = {
        type: 'domain',
        enforcement: 'block',
        priority: 'high',
        blockMessage: 'Custom block reason',
      };
      const matches: MatchResult[] = [
        { skillName: 'forge', rule: blockRule, matchedKeywords: ['forge'], matchedIntents: [], score: 3 },
      ];
      const output = formatOutput(matches);
      assert.ok(output.includes('Custom block reason'), 'Output should contain the custom block message');
    });

    // Task [1-2]: suggest + high priority output
    it('should output IMPORTANT message for suggest enforcement with high priority', () => {
      const highRule: SkillRule = {
        type: 'domain',
        enforcement: 'suggest',
        priority: 'high',
      };
      const matches: MatchResult[] = [
        { skillName: 'forge', rule: highRule, matchedKeywords: ['forge'], matchedIntents: [], score: 3 },
      ];
      const output = formatOutput(matches);
      assert.ok(output.includes('IMPORTANT'), 'Output should contain "IMPORTANT"');
      assert.ok(output.includes('MUST'), 'Output should contain "MUST"');
      assert.ok(output.includes('Do not analyze'), 'Output should contain "Do not analyze"');
    });

    // Task [1-2]: suggest + critical priority output
    it('should output IMPORTANT message for suggest enforcement with critical priority', () => {
      const criticalRule: SkillRule = {
        type: 'domain',
        enforcement: 'suggest',
        priority: 'critical',
      };
      const matches: MatchResult[] = [
        { skillName: 'forge', rule: criticalRule, matchedKeywords: ['forge'], matchedIntents: [], score: 4 },
      ];
      const output = formatOutput(matches);
      assert.ok(output.includes('IMPORTANT'), 'Output should contain "IMPORTANT"');
      assert.ok(output.includes('MUST'), 'Output should contain "MUST"');
      assert.ok(output.includes('Do not analyze'), 'Output should contain "Do not analyze"');
    });

    // Task [1-3]: suggest + medium priority output
    it('should output SUGGESTED message for suggest enforcement with medium priority', () => {
      const mediumRule: SkillRule = {
        type: 'domain',
        enforcement: 'suggest',
        priority: 'medium',
      };
      const matches: MatchResult[] = [
        { skillName: 'forge', rule: mediumRule, matchedKeywords: ['forge'], matchedIntents: [], score: 2 },
      ];
      const output = formatOutput(matches);
      assert.ok(output.includes('SUGGESTED'), 'Output should contain "SUGGESTED"');
      assert.ok(!output.includes('MUST'), 'Output should NOT contain "MUST"');
      assert.ok(!output.includes('BLOCKED'), 'Output should NOT contain "BLOCKED"');
    });
  });
});
