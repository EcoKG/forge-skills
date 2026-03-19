import { PRIORITY_WEIGHTS } from './types.js';

// File extensions that indicate code-related work
const CODE_EXTENSIONS = [
  '.java', '.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.cs', '.cpp', '.c', '.h',
  '.vue', '.svelte', '.html', '.css', '.scss', '.less', '.sass',
  '.properties', '.yml', '.yaml', '.json', '.xml', '.toml', '.ini', '.env', '.conf',
  '.sql', '.graphql', '.proto', '.sh', '.bash', '.ps1', '.bat',
  '.kt', '.swift', '.rb', '.php', '.lua', '.ex', '.exs', '.clj', '.scala',
  '.md', '.mdx', '.dockerfile', '.tf', '.hcl'
];

// Action verbs that signal code modification intent (Korean + English)
const ACTION_VERBS_KO = [
  '변경', '수정', '바꿔', '고쳐', '추가', '삭제', '제거', '구현', '만들',
  '작성', '처리', '분리', '통합', '연동', '적용', '설정', '배포', '마이그레이션',
  '리팩토링', '최적화', '개선', '해결', '수정해', '고쳐줘', '바꿔줘', '만들어',
  '추가해', '삭제해', '제거해', '처리해', '구현해', '작성해', '분리해',
  '넣어', '빼', '옮겨', '교체', '전환', '업그레이드', '업데이트',
  '하게', '되게', '시켜', '해줘',
  '손봐', '정리해', '잡아', '고장', '안돼', '안됨', '안 됨', '이상해', '죽어',
  '느려', '깨져', '에러', '컴파일', '빌드'
];

const ACTION_VERBS_EN = [
  'implement', 'add', 'create', 'build', 'fix', 'change', 'modify', 'update',
  'remove', 'delete', 'refactor', 'migrate', 'deploy', 'configure', 'setup',
  'optimize', 'improve', 'integrate', 'connect', 'replace', 'convert', 'move',
  'extract', 'split', 'merge', 'upgrade', 'install', 'write', 'rewrite'
];

// Negative signals — question-only or explanation-only patterns
const NEGATIVE_PATTERNS_KO = [
  /^.{0,5}(뭐야|뭔가요|뭐지|뭘까)\s*[\?\？]?\s*$/,
  /^.{0,10}(설명|알려|말해|가르쳐).*?(줘|주세요|달라)\s*$/,
  /^(이게|이거|이건)\s+(뭐|무엇|무슨|어떤)/,
  /^.{0,5}(왜|어떻게|어디서|언제)\s+.{0,20}[\?\？]\s*$/
];

const NEGATIVE_PATTERNS_EN = [
  /^what (is|are|does|do)\s/i,
  /^(explain|describe|tell me about|show me)\s/i,
  /^how does\s/i,
  /^(can you|could you)\s+(explain|describe|tell)/i,
  /^why (is|are|does|do)\s/i
];

// Code identifier patterns
const CODE_IDENTIFIER_PATTERNS = [
  /[a-z][a-zA-Z]+\.[a-z][a-zA-Z]+/,        // dot.notation (e.g., TBL.server)
  /[A-Z][a-z]+[A-Z][a-z]+/,                  // CamelCase (e.g., UserService)
  /[a-z]+_[a-z]+/,                            // snake_case (e.g., user_service)
  /[a-z]+\.(java|ts|tsx|js|py|go|rs|vue|properties|yml|yaml|json|xml|sql|css|html|md)/i, // filename.ext
  /[A-Z]{2,}[a-z]/,                           // ACRONYMCase (e.g., HTTPClient, TBLServer)
  /\/[a-z][\w-]*\/[a-z][\w-]*/,              // path/segments (e.g., /src/auth)
  /\w+\(\)/,                                   // function() call pattern
  /\w+\.\w+\(\)/,                              // object.method() pattern
];

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

        // === Unified Scoring (v2.0) ===
        // All signals are weighted inputs to a single score. No instant triggers.
        // Negative signals always apply and can suppress keyword matches.

        const matchedKeywords = this.matchKeywordsDeduped(triggers.keywords, promptLower);
        const matchedIntents = this.matchIntentPatterns(triggers.intentPatterns, prompt);

        const scoring = rule.smartScoring || rule.unifiedScoring || this.rules.smartScoring || {};
        const weights = scoring?.weights || {
            keyword: 15, intent: 20,
            fileExtension: 50, actionVerb: 30, codeIdentifier: 20, negativeSignal: -40
        };
        const threshold = scoring?.threshold || 40;

        // Component scores
        const keywordScore = matchedKeywords.length * (weights.keyword || 15);
        const intentScore = matchedIntents.length * (weights.intent || 20);
        const extScore = this.scoreFileExtensions(promptLower) > 0 ? (weights.fileExtension || 50) : 0;
        const verbScore = this.scoreActionVerbs(promptLower) > 0 ? (weights.actionVerb || 30) : 0;
        const idScore = this.scoreCodeIdentifiers(prompt) > 0 ? (weights.codeIdentifier || 20) : 0;
        const negScore = this.scoreNegativeSignals(prompt) > 0 ? (weights.negativeSignal || -40) : 0;

        const totalScore = keywordScore + intentScore + extScore + verbScore + idScore + negScore;

        const smartDetails = {
            keyword: keywordScore,
            intent: intentScore,
            fileExtension: extScore,
            actionVerb: verbScore,
            codeIdentifier: idScore,
            negativeSignal: negScore,
            total: totalScore,
            threshold
        };

        if (totalScore < threshold) {
            return null;
        }

        return {
            skillName,
            rule,
            matchedKeywords,
            matchedIntents,
            smartScore: smartDetails,
            score: totalScore,
        };
    }

    // Deduplicated keyword matching — avoids double-counting "구현" and "기능 구현"
    matchKeywordsDeduped(keywords, promptLower) {
        if (!keywords || keywords.length === 0) return [];
        const matched = keywords.filter(kw => promptLower.includes(kw.toLowerCase()));
        // Remove shorter keywords that are substrings of longer matched keywords
        return matched.filter(kw => {
            const kwLower = kw.toLowerCase();
            return !matched.some(other => {
                const otherLower = other.toLowerCase();
                return otherLower !== kwLower && otherLower.includes(kwLower) && otherLower.length > kwLower.length;
            });
        });
    }

    // --- Smart Scoring Methods ---

    scoreFileExtensions(promptLower) {
        let count = 0;
        for (const ext of CODE_EXTENSIONS) {
            if (promptLower.includes(ext)) count++;
        }
        return count;
    }

    scoreActionVerbs(promptLower) {
        let count = 0;
        for (const verb of ACTION_VERBS_KO) {
            if (promptLower.includes(verb)) count++;
        }
        for (const verb of ACTION_VERBS_EN) {
            if (promptLower.includes(verb)) count++;
        }
        return count;
    }

    scoreCodeIdentifiers(prompt) {
        let count = 0;
        for (const pattern of CODE_IDENTIFIER_PATTERNS) {
            if (pattern.test(prompt)) count++;
        }
        return count;
    }

    scoreNegativeSignals(prompt) {
        for (const pattern of NEGATIVE_PATTERNS_KO) {
            if (pattern.test(prompt)) return 1; // flag as negative
        }
        for (const pattern of NEGATIVE_PATTERNS_EN) {
            if (pattern.test(prompt)) return 1;
        }
        return 0;
    }

    // --- Legacy Methods (unchanged) ---

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
