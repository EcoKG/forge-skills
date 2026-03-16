import { PRIORITY_WEIGHTS } from './types.js';
export class RulesMatcher {
    rules;
    constructor(rules) {
        this.rules = rules;
    }
    matchPrompt(prompt) {
        if (!prompt || prompt.trim().length === 0) {
            return [];
        }
        const promptLower = prompt.toLowerCase();
        const results = [];
        for (const [skillName, rule] of Object.entries(this.rules.skills)) {
            const result = this.matchSingleSkill(skillName, rule, prompt, promptLower);
            if (result) {
                results.push(result);
            }
        }
        return results.sort((a, b) => {
            const priorityDiff = PRIORITY_WEIGHTS[b.rule.priority] - PRIORITY_WEIGHTS[a.rule.priority];
            if (priorityDiff !== 0)
                return priorityDiff;
            return b.score - a.score;
        });
    }
    matchSingleSkill(skillName, rule, prompt, promptLower) {
        const triggers = rule.promptTriggers;
        if (!triggers)
            return null;
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
    matchKeywords(keywords, promptLower) {
        if (!keywords || keywords.length === 0)
            return [];
        return keywords.filter(kw => promptLower.includes(kw.toLowerCase()));
    }
    matchIntentPatterns(patterns, prompt) {
        if (!patterns || patterns.length === 0)
            return [];
        const matched = [];
        for (const pattern of patterns) {
            try {
                const regex = new RegExp(pattern, 'i');
                if (regex.test(prompt)) {
                    matched.push(pattern);
                }
            }
            catch {
                // Invalid regex — skip silently (fail-open)
            }
        }
        return matched;
    }
}
