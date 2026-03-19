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
  // Pure questions
  /^.{0,5}(뭐야|뭔가요|뭐지|뭘까)\s*[\?\？]?\s*$/,
  /^.{0,10}(설명|알려|말해|가르쳐).*?(줘|주세요|달라)\s*$/,
  /^(이게|이거|이건)\s+(뭐|무엇|무슨|어떤)/,
  /^.{0,5}(왜|어떻게|어디서|언제)\s+.{0,20}[\?\？]\s*$/,
  // Explanation requests (no action)
  /^.{0,20}(설명|의미|뜻|차이|개념).*?(해줘|해주세요|알려|줘)\s*$/,
  /^.{0,20}(어떤|무슨)\s+(의미|뜻|차이)/,
  // Short questions ending with 야?/거야?/까?/나?
  /^.{0,30}(뭐야|거야|인가|일까|는지|건지|나요|습니까|인지)[\?\？]?\s*$/,
  // "이거 X야?" pattern
  /^(이거|이게|이건|이것|저거|저건|그거|그건)\s+.{0,15}(야|인가|일까)[\?\？]?\s*$/,
  // "X 보여줘/보여주세요" (show me, not modify)
  /^.{0,20}(보여|보여줘|보여주세요|보여주|알려줘|알려주세요)\s*$/,
  // "코드 설명" (too short, no action verb)
  /^.{0,10}(코드|함수|클래스|모듈)\s+(설명|리뷰)\s*$/,
  // "로그 보여줘" (show logs)
  /^.{0,10}(로그|상태|결과|목록|리스트)\s+(보여|보여줘|봐|봐줘|줘)\s*$/,
  // Simple greetings / chat / acknowledgments
  /^(안녕|하이|hello|hi|hey|감사|고마워|고맙|thanks|thank|ok|okay|ㅇㅇ|ㅋ+|ㅎ+|네|예|응|아니|좋아|알겠|알았|잘했|다음에|나중에|수고|좋겠).{0,10}$/i,
  // CLI commands (user asking to run, not implement)
  /^(git\s+(log|status|diff|branch|stash|show|remote|fetch|pull)|npm\s+(install|test|start|run|ci)|yarn|pnpm|ls|cd|pwd|cat|head|tail|echo|which|env|node\s+--version|claude\s+--version|docker\s+(compose|build|run|ps|logs|pull)|kubectl\s+(get|describe|apply|logs)|terraform\s+(plan|apply|init|destroy)|cargo\s+(test|build|run|check)|make\b|cmake\b)\b/i,
  // Slash commands
  /^\//,
];

const NEGATIVE_PATTERNS_EN = [
  // Pure questions
  /^what (is|are|does|do)\s/i,
  /^(explain|describe|tell me about|show me)\s/i,
  /^how does\s/i,
  /^(can you|could you)\s+(explain|describe|tell)/i,
  /^why (is|are|does|do)\s/i,
  /^where (is|are|do|does|can)\s/i,
  /^when (did|does|will|should)\s/i,
  // "how do I" questions (not action requests)
  /^how (do|can|should) (I|we)\s/i,
  // "is this a X?" questions
  /^is (this|that|it)\s/i,
  // "run the X" / "start the X" (CLI-like)
  /^(run|start|stop|restart|execute)\s+(the|my|a)\s/i,
  // Simple acknowledgments
  /^(ok|okay|thanks|thank you|got it|understood|sure|yes|no|yep|nope|sounds good|great|nice|cool|awesome|perfect|alright|right|agreed)\s*[!.]?\s*$/i,
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
        // Exception: skill name itself (e.g., "forge", "/forge") is an instant trigger.

        // Direct skill name invocation — always trigger
        const skillNamePatterns = triggers.skillNamePatterns || [skillName.toLowerCase()];
        for (const snp of skillNamePatterns) {
            if (promptLower.includes(snp) || promptLower.startsWith("/" + snp)) {
                const matchedKw = this.matchKeywordsDeduped(triggers.keywords, promptLower);
                const matchedInt = this.matchIntentPatterns(triggers.intentPatterns, prompt);
                return {
                    skillName, rule, matchedKeywords: matchedKw, matchedIntents: matchedInt,
                    smartScore: { skillNameMatch: true, total: 100, threshold: 0 },
                    score: 100,
                };
            }
        }

        // === Reverse Matching (v3.0) ===
        // Instead of detecting what NEEDS forge (infinite keywords),
        // detect what DOESN'T need forge (finite exclusions).
        // If not excluded → trigger forge.

        const isNegative = this.scoreNegativeSignals(prompt) > 0;
        const promptTrimmed = prompt.trim();

        // Too short to be a real request (< 2 chars)
        if (promptTrimmed.length < 2) return null;

        // Negative signal detected → don't trigger
        if (isNegative) return null;

        // Passed all exclusions → trigger forge
        // Still compute positive scores for diagnostics/logging
        const matchedKeywords = this.matchKeywordsDeduped(triggers.keywords, promptLower);
        const matchedIntents = this.matchIntentPatterns(triggers.intentPatterns, prompt);
        const extScore = this.scoreFileExtensions(promptLower);
        const verbScore = this.scoreActionVerbs(promptLower);
        const idScore = this.scoreCodeIdentifiers(prompt);

        const totalScore = matchedKeywords.length * 15 + matchedIntents.length * 20
            + (extScore > 0 ? 50 : 0) + (verbScore > 0 ? 30 : 0) + (idScore > 0 ? 20 : 0);

        return {
            skillName,
            rule,
            matchedKeywords,
            matchedIntents,
            smartScore: {
                mode: 'reverse',
                keyword: matchedKeywords.length * 15,
                intent: matchedIntents.length * 20,
                fileExtension: extScore > 0 ? 50 : 0,
                actionVerb: verbScore > 0 ? 30 : 0,
                codeIdentifier: idScore > 0 ? 20 : 0,
                negativeSignal: 0,
                total: Math.max(totalScore, 30),
                threshold: 0
            },
            score: Math.max(totalScore, 30),
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
