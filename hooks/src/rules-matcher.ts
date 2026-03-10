import type { SkillRules, SkillRule, MatchResult } from './types.js';
import { PRIORITY_WEIGHTS } from './types.js';

export class RulesMatcher {
  private rules: SkillRules;

  constructor(rules: SkillRules) {
    this.rules = rules;
  }

  matchPrompt(prompt: string): MatchResult[] {
    if (!prompt || prompt.trim().length === 0) {
      return [];
    }

    const promptLower = prompt.toLowerCase();
    const results: MatchResult[] = [];

    for (const [skillName, rule] of Object.entries(this.rules.skills)) {
      const result = this.matchSingleSkill(skillName, rule, prompt, promptLower);
      if (result) {
        results.push(result);
      }
    }

    return results.sort((a, b) => {
      const priorityDiff = PRIORITY_WEIGHTS[b.rule.priority] - PRIORITY_WEIGHTS[a.rule.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.score - a.score;
    });
  }

  private matchSingleSkill(
    skillName: string,
    rule: SkillRule,
    prompt: string,
    promptLower: string,
  ): MatchResult | null {
    const triggers = rule.promptTriggers;
    if (!triggers) return null;

    const matchedKeywords = this.matchKeywords(triggers.keywords, promptLower);
    const matchedIntents = this.matchIntentPatterns(triggers.intentPatterns, prompt);

    if (matchedKeywords.length === 0 && matchedIntents.length === 0) {
      return null;
    }

    const score = matchedKeywords.length * 2 + matchedIntents.length * 3;

    return {
      skillName,
      rule,
      matchedKeywords,
      matchedIntents,
      score,
    };
  }

  private matchKeywords(keywords: string[] | undefined, promptLower: string): string[] {
    if (!keywords || keywords.length === 0) return [];

    return keywords.filter(kw => promptLower.includes(kw.toLowerCase()));
  }

  private matchIntentPatterns(patterns: string[] | undefined, prompt: string): string[] {
    if (!patterns || patterns.length === 0) return [];

    const matched: string[] = [];

    for (const pattern of patterns) {
      try {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(prompt)) {
          matched.push(pattern);
        }
      } catch {
        // Invalid regex — skip silently (fail-open)
      }
    }

    return matched;
  }
}
