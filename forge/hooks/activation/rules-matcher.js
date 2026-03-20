import { PRIORITY_WEIGHTS } from './types.js';
import { createRequire } from 'module';

// Import CODE_EXTENSIONS from shared CJS module (hooks/ is "type": "commonjs")
const require = createRequire(import.meta.url);
const { CODE_EXTENSIONS } = require('../shared/constants.js');

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
  // Search/view requests — "찾아봐", "확인해봐", "봐봐", "열어봐"
  /^.{0,30}(찾아봐|찾아보라고|확인해봐|확인해보라고|열어봐|봐봐|살펴봐|검색해봐|찾아줘|찾아보자|체크해봐|들여다봐)\s*$/,
  // Korean ending-form questions — "~함?", "~했음?", "~됨?"
  // Lookbehind excludes intent declarations: "~할려고함", "~하겠음"
  /^.{0,40}(?<!려고|하겠|할게|할거)(?:함|했음|됨|인듯|한건가|된건가|했잖아|됐잖아|인가요|한가요|된가요)\s*[\?\？]?\s*$/,
  // Korean interrogative endings with 나/나요 — "있나?", "됐나?", "했나?", "작동하나?"
  // Catches "명시되어있나?", "TDD 있나?", "포함됐나?", "작동하나?" style questions
  /(있나|없나|됐나|했나|맞나|되나|하나|한가|될까|아냐|아닌가|볼까)\s*[\?\？]?\s*$/,
  // Korean question endings — "~했는지", "~하는지", "~되는지", etc.
  // End-anchored to avoid catching subordinate clauses ("안한건지 분석하고...")
  /(했는지|하는지|되는지|있는지|인지|건지|은지|는건가|뭐야|뭔가)\s*[\?\？]?\s*$/,
  // "어떻게 되" (status question: how is it going)
  /어떻게\s*되/,
  // "완료했는지/완료했나" (was it completed?)
  /완료했.{0,3}(는지|나)/,
  // Observation/hedging — "근데 이상한데", "어? 뭐지?"
  /^(근데|그런데|어[\?\？\s\.]|음|잠깐|잠깐만|아 그런데|헉).{0,30}(이상|뭔가|뭐야|뭔지|구나|있는데|있네|그렇구나|신기하네)\s*$/,
  // Simple checking/viewing — "내용 확인", "파일 봐", "상태 확인해줘"
  /^.{0,15}(파일|내용|상태|로그|결과|목록|리스트|코드|함수).{0,10}(확인|봐|보기|보자|검토|다시)\s*$/,
  // Meta-discussion about forge/hooks — "왜 forge 안 썼어?", "포지 필요한가?"
  /^.{0,20}(forge|포지|hook|훅|스킬|skill|가드|guard).{0,30}(필요|왜|써야|안 썼|상태|확인|설정|안 함|동작|작동|발동)\s*[\?\？]?\s*$/,
  // Questions about prior work — "그거 뭐 했어?", "왜 이렇게 했어?"
  /^.{0,20}(이거|그거|이걸|저걸|이것|그것|여기|거기).{0,20}(했어|했나|가져온|만든|쓴|왜|뭘|뭐|어디서).{0,10}[\?\？]\s*$/,
  // Conversational connectors — "응 맞아", "근데 말이야"
  /^(응|근데|그런데|그래서|음|헉|잠깐만|아 그리고|하지만|그 다음|그리고|참고로|그나저나|아참).{0,20}$/,
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
  // Observation/feedback — "But that seems odd", "Wait, why?", "Something's off"
  /^(but\s+that|wait|huh|hmm|something('?s)?|that('?s)?\s+(weird|odd|off|interesting|strange)|this seems|looks like).{0,30}[\?\.]?\s*$/i,
  // Meta-system discussion — "Why didn't you use forge?", "Is forge needed?"
  /^.{0,20}(forge|skill|hook|activation|trigger|guard).{0,30}(needed|why|should|use|status|check|required|set|fail|work|activate|fire)/i,
  // Simple viewing/checking — "Let me check", "Show me the status"
  /^(let me|let('?s)?|just|only)\s+(check|view|look|review|read|see|examine|inspect).{0,20}[\?\.]?\s*$/i,
  // Questions about prior work — "Why did you add this?"
  /^(why|what|where|how)\s+(did you|did we|have you|have we)\s/i,
  // Conversational filler — "Okay so...", "But anyway...", "Right and..."
  /^(okay|alright|right|so|but|anyway|and|uh|um|hmm|err|well)\s*(,|\.\.\.)\s*/i,
  // Understanding confirmation — "I see", "Got it", "Understood"
  /^(i see|i understand|i get it|copy that|roger|acknowledged|noted|fair enough).{0,10}$/i,
  // What does this do? — "What does this do?", "What's this for?"
  /^what (does|is|should|can) (this|that|it)\s/i,
  // Status/completion questions
  /does this work/i,
  /what does .* mean/i,
  /how is .* going/i,
  /is .* done/i,
  /was .* completed/i,
];

// Mild negative patterns — status checks, continuations (score: -20, can be overridden by positive signals)
const MILD_NEGATIVE_PATTERNS = [
  // Status checks
  /^(how (did|does|is)|what('?s)?|is (it|that|this)).{0,30}(done|progress|status|yet|far|happen|go|complete|working|work out)/i,
  /^.{0,30}(어떻게|어디까지|완료|됐|했어|했나|됐어|됐나|했는지|진행한거지|한거지|한거야).{0,20}[\?\？]?\s*$/,
  // Continuation/procedural
  /^(what('?s)?\s+(next|now)|shall we|let('?s)?\s+(proceed|move|continue|go)|continue|next\s+(step|one)|move\s+on|go\s+(ahead|forward)|proceed).{0,20}[\?\.]?\s*$/i,
  /^(다음|계속|진행해|진행하자|진행할게|그럼 진행|이제 진행|그러면 계속|다음으로|다음은|계속해|계속하자|이어서).{0,15}[\?\？]?\s*$/,
  // Verification/double-check
  /^.{0,20}(맞나|맞아|맞지|맞는거야|제대로|확실|됐나|한 거야|한거야|거지|거야)\s*[\?\？]?\s*$/,
  /^(makes sense|fair point|i agree|sounds right|that('?s)?\s+(correct|right|true)|exactly|precisely|looks good|seems good).{0,15}$/i,
];

// Conversational Korean endings indicating experiential symptom reporting
const SYMPTOM_REPORT_ENDINGS = [
  /되던대/, /되던데/, /하던대/, /하던데/,
  /안\s?되더라/, /되더라고/, /하더라고/,
  /거든요?\s*$/, /더라구요?\s*$/, /더라고요?\s*$/,
  /씩\s*(되|나|생기|반복)/,
  /나더라/, /생기더라/, /뜨더라/,
  /[가-힣]더라\s*$/,  // general experiential ending "~더라" at end of sentence
];

// Words that cluster in bug/symptom reports — 2+ together = strong signal
const SYMPTOM_CLUSTER_WORDS = [
  '장애', '발생', '갑자기', '두번', '중복', '반복',
  '오작동', '이상', '문제', '현상', '증상', '재현',
  '먹통', '멈춤', '프리징', '안 되', '안되', '꺼짐', '끊김',
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

        // Direct skill name invocation
        // Slash command (/forge) = always instant trigger
        // Text mention ("forge") + no negative signal = instant trigger (user wants to use skill)
        // Text mention ("forge") + negative signal = bonus (40pts), normal scoring
        // This prevents "forge 스킬에 TDD 있나?" from instant-triggering
        const skillNamePatterns = triggers.skillNamePatterns || [skillName.toLowerCase()];
        let skillNameBonus = 0;
        for (const snp of skillNamePatterns) {
            if (promptLower.startsWith("/" + snp)) {
                // Slash command — always direct invocation
                const matchedKw = this.matchKeywordsDeduped(triggers.keywords, promptLower);
                const matchedInt = this.matchIntentPatterns(triggers.intentPatterns, prompt);
                return {
                    skillName, rule, matchedKeywords: matchedKw, matchedIntents: matchedInt,
                    smartScore: { skillNameMatch: true, total: 100, threshold: 0 },
                    score: 100,
                };
            }
            if (promptLower.includes(snp)) {
                // Check if negative signals indicate a question about the skill
                const negCheck = this.scoreNegativeSignals(prompt);
                if (negCheck < 0) {
                    // Negative signal — treat as bonus, not instant trigger
                    skillNameBonus = 40;
                } else {
                    // No negative signal — direct invocation
                    const matchedKw = this.matchKeywordsDeduped(triggers.keywords, promptLower);
                    const matchedInt = this.matchIntentPatterns(triggers.intentPatterns, prompt);
                    return {
                        skillName, rule, matchedKeywords: matchedKw, matchedIntents: matchedInt,
                        smartScore: { skillNameMatch: true, total: 100, threshold: 0 },
                        score: 100,
                    };
                }
            }
        }

        // === Reverse Matching (v3.0) ===
        // Instead of detecting what NEEDS forge (infinite keywords),
        // detect what DOESN'T need forge (finite exclusions).
        // Graduated negatives: strong (-40) blocks outright, mild (-20) can be overridden.

        const negativeScore = this.scoreNegativeSignals(prompt); // 0, -20, or -40
        const promptTrimmed = prompt.trim();

        // Too short to be a real request (< 2 chars)
        if (promptTrimmed.length < 2) return null;

        // Compute positive scores (before negative check — offset model)
        const matchedKeywords = this.matchKeywordsDeduped(triggers.keywords, promptLower);
        const matchedLowKeywords = this.matchKeywordsDeduped(triggers.lowWeightKeywords, promptLower);
        const matchedIntents = this.matchIntentPatterns(triggers.intentPatterns, prompt);
        const extScore = this.scoreFileExtensions(promptLower);
        const verbScore = this.scoreActionVerbs(promptLower);
        const idScore = this.scoreCodeIdentifiers(prompt);
        const bugNarrativeScore = this.scoreBugNarrative(prompt);

        const positiveScore = matchedKeywords.length * 15 + matchedLowKeywords.length * 8
            + matchedIntents.length * 20
            + (extScore > 0 ? 50 : 0) + (verbScore > 0 ? 30 : 0) + (idScore > 0 ? 20 : 0)
            + bugNarrativeScore;

        // Offset model: negative reduces score but doesn't hard-block when positive signals exist
        // Only hard-exit when there are zero positive signals AND strong negative
        if (positiveScore === 0 && negativeScore <= -40) return null;

        const totalScore = positiveScore + negativeScore + skillNameBonus;

        // Threshold check: if score below threshold AND no keywords/intents matched → no match
        const threshold = rule.unifiedScoring?.threshold || 0;
        const hasPositiveSignal = matchedKeywords.length > 0 || matchedLowKeywords.length > 0 || matchedIntents.length > 0;
        if (totalScore < threshold && !hasPositiveSignal) {
            return null;
        }

        return {
            skillName,
            rule,
            matchedKeywords: [...matchedKeywords, ...matchedLowKeywords],
            matchedIntents,
            smartScore: {
                mode: 'reverse',
                keyword: matchedKeywords.length * 15,
                lowWeightKeyword: matchedLowKeywords.length * 8,
                intent: matchedIntents.length * 20,
                fileExtension: extScore > 0 ? 50 : 0,
                actionVerb: verbScore > 0 ? 30 : 0,
                codeIdentifier: idScore > 0 ? 20 : 0,
                bugNarrative: bugNarrativeScore,
                negativeSignal: negativeScore,
                skillNameBonus,
                total: totalScore,
                threshold
            },
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
            // Use word boundary pattern to avoid .c matching .css, .cs, etc.
            const pattern = new RegExp('\\w+\\' + ext + '(?:\\s|$|[,;)])', 'i');
            if (pattern.test(promptLower)) count++;
        }
        return count;
    }

    scoreActionVerbs(promptLower) {
        let count = 0;
        // Korean verbs: use includes() (Korean has no word boundaries)
        for (const verb of ACTION_VERBS_KO) {
            if (promptLower.includes(verb)) count++;
        }
        // English verbs: use word boundary to avoid "add" matching "address", etc.
        for (const verb of ACTION_VERBS_EN) {
            if (new RegExp('\\b' + verb + '\\b').test(promptLower)) count++;
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

    scoreBugNarrative(prompt) {
        let score = 0;
        // Symptom report endings (+25)
        for (const pattern of SYMPTOM_REPORT_ENDINGS) {
            if (pattern.test(prompt)) { score += 25; break; }
        }
        // Symptom cluster bonus (+20 for 2+, +30 for 3+)
        let clusterCount = 0;
        for (const word of SYMPTOM_CLUSTER_WORDS) {
            if (prompt.includes(word)) clusterCount++;
        }
        if (clusterCount >= 3) score += 30;
        else if (clusterCount >= 2) score += 20;
        return score;
    }

    scoreNegativeSignals(prompt) {
        let score = 0;
        // Strong negatives: greetings, pure questions, acknowledgments = -40
        for (const pattern of NEGATIVE_PATTERNS_KO) {
            if (pattern.test(prompt)) { score = Math.min(score, -40); break; }
        }
        for (const pattern of NEGATIVE_PATTERNS_EN) {
            if (pattern.test(prompt)) { score = Math.min(score, -40); break; }
        }
        // Mild negatives: status checks, continuations = -20
        // (only if no strong negative already found)
        if (score === 0) {
            for (const pattern of MILD_NEGATIVE_PATTERNS) {
                if (pattern.test(prompt)) { score = -20; break; }
            }
        }
        return score;
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
