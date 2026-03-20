/**
 * Phase 3 Integration Tests
 *
 * Tests SemanticAnalyzer, IntentClassifier, and UserProfile modules
 * as integrated into skill-activation.js. Validates:
 *   - SemanticAnalyzer pattern detection with mock turn sequences
 *   - IntentClassifier cache behavior (without actual claude -p call)
 *   - UserProfile threshold adjustment calculation
 *   - Scoring corpus compatibility with all Phase 3 changes
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

let SemanticAnalyzer;
let IntentClassifier;
let UserProfile;
let RulesMatcher;

beforeAll(async () => {
  const semMod = await import('../../forge/hooks/activation/semantic-analyzer.js');
  SemanticAnalyzer = semMod.SemanticAnalyzer;

  const intMod = await import('../../forge/hooks/activation/intent-classifier.js');
  IntentClassifier = intMod.IntentClassifier;

  const profMod = await import('../../forge/hooks/activation/user-profile.js');
  UserProfile = profMod.UserProfile;

  const rmMod = await import('../../forge/hooks/activation/rules-matcher.js');
  RulesMatcher = rmMod.RulesMatcher;
});

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase3-test-'));
  // Reset relevant feature flags
  delete process.env.SEMANTIC_ANALYZER_ENABLED;
  delete process.env.LLM_CLASSIFIER_ENABLED;
  delete process.env.USER_PROFILE_ENABLED;
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.SEMANTIC_ANALYZER_ENABLED;
  delete process.env.LLM_CLASSIFIER_ENABLED;
  delete process.env.USER_PROFILE_ENABLED;
});

// ─── SemanticAnalyzer ────────────────────────────────────────────────────

describe('SemanticAnalyzer', () => {
  it('detects description_to_action pattern (symptom → action verb)', () => {
    const analyzer = new SemanticAnalyzer();
    const turns = [
      { score: 10, matchedKeywords: [], negativeSignal: 0, prompt_prefix: 'error keeps happening on login' },
      { score: 40, matchedKeywords: ['fix'], negativeSignal: 0, prompt_prefix: 'fix the login error' },
    ];
    const result = analyzer.analyzeFlow(turns);
    expect(result.pattern).toBe('description_to_action');
    expect(result.bonus).toBe(20);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('detects question_to_complaint pattern (negative + escalation)', () => {
    const analyzer = new SemanticAnalyzer();
    const turns = [
      { score: 5, matchedKeywords: [], negativeSignal: -10, prompt_prefix: 'is this working right?' },
      { score: 35, matchedKeywords: ['fix'], negativeSignal: 0, prompt_prefix: 'fix this broken thing' },
    ];
    const result = analyzer.analyzeFlow(turns);
    expect(result.pattern).not.toBeNull();
    expect(result.bonus).toBeGreaterThan(0);
  });

  it('detects observation_to_implicit pattern (2+ symptom words, no action)', () => {
    const analyzer = new SemanticAnalyzer();
    const turns = [
      { score: 10, matchedKeywords: [], negativeSignal: 0, prompt_prefix: 'something else' },
      { score: 15, matchedKeywords: [], negativeSignal: 0, prompt_prefix: 'there is an error and a bug happening' },
    ];
    const result = analyzer.analyzeFlow(turns);
    expect(result.pattern).toBe('observation_to_implicit');
    expect(result.bonus).toBe(10);
  });

  it('detects progressive_investigation (3+ turns monotonically increasing)', () => {
    const analyzer = new SemanticAnalyzer();
    const turns = [
      { score: 5, matchedKeywords: [], negativeSignal: 0, prompt_prefix: 'first' },
      { score: 15, matchedKeywords: [], negativeSignal: 0, prompt_prefix: 'second' },
      { score: 30, matchedKeywords: ['fix'], negativeSignal: 0, prompt_prefix: 'third fix' },
    ];
    const result = analyzer.analyzeFlow(turns);
    expect(result.pattern).not.toBeNull();
    expect(result.bonus).toBeGreaterThan(0);
  });

  it('returns empty result for single turn', () => {
    const analyzer = new SemanticAnalyzer();
    const turns = [
      { score: 50, matchedKeywords: ['implement'], negativeSignal: 0, prompt_prefix: 'implement auth' },
    ];
    const result = analyzer.analyzeFlow(turns);
    expect(result.pattern).toBeNull();
    expect(result.bonus).toBe(0);
  });

  it('returns empty result when feature flag is disabled', () => {
    process.env.SEMANTIC_ANALYZER_ENABLED = 'false';
    const analyzer = new SemanticAnalyzer();
    const turns = [
      { score: 10, matchedKeywords: [], negativeSignal: 0, prompt_prefix: 'error on login' },
      { score: 40, matchedKeywords: ['fix'], negativeSignal: 0, prompt_prefix: 'fix it' },
    ];
    const result = analyzer.analyzeFlow(turns);
    expect(result.pattern).toBeNull();
    expect(result.bonus).toBe(0);
  });

  it('handles empty/invalid turns gracefully', () => {
    const analyzer = new SemanticAnalyzer();
    expect(analyzer.analyzeFlow(null).bonus).toBe(0);
    expect(analyzer.analyzeFlow([]).bonus).toBe(0);
    expect(analyzer.analyzeFlow('not-an-array').bonus).toBe(0);
  });
});

// ─── IntentClassifier ────────────────────────────────────────────────────

describe('IntentClassifier', () => {
  it('returns ambiguous when feature flag is disabled (default)', () => {
    // LLM_CLASSIFIER_ENABLED defaults to undefined (not 'true')
    const classifier = new IntentClassifier({ cacheDir: path.join(tmpDir, 'cache') });
    return classifier.classify('fix the login bug').then(result => {
      expect(result.intent).toBe('ambiguous');
      expect(result.confidence).toBe(0);
    });
  });

  it('returns ambiguous for null/empty prompt even when enabled', async () => {
    process.env.LLM_CLASSIFIER_ENABLED = 'true';
    const classifier = new IntentClassifier({ cacheDir: path.join(tmpDir, 'cache') });
    const result = await classifier.classify(null);
    expect(result.intent).toBe('ambiguous');
    expect(result.confidence).toBe(0);
  });

  it('reads from cache when cache entry exists and is fresh', async () => {
    process.env.LLM_CLASSIFIER_ENABLED = 'true';
    const cacheDir = path.join(tmpDir, 'cache');
    fs.mkdirSync(cacheDir, { recursive: true });

    const classifier = new IntentClassifier({ cacheDir });

    // Manually write a cache entry
    const crypto = require('node:crypto');
    const prompt = 'test prompt for cache';
    const hash = crypto.createHash('sha256').update(prompt).digest('hex').slice(0, 16);
    const cacheEntry = {
      intent: 'code-modify',
      confidence: 0.9,
      timestamp: Date.now(),
    };
    fs.writeFileSync(path.join(cacheDir, `${hash}.json`), JSON.stringify(cacheEntry));

    const result = await classifier.classify(prompt);
    expect(result.intent).toBe('code-modify');
    expect(result.confidence).toBe(0.9);
  });

  it('returns ambiguous for expired cache entries', async () => {
    process.env.LLM_CLASSIFIER_ENABLED = 'true';
    const cacheDir = path.join(tmpDir, 'cache');
    fs.mkdirSync(cacheDir, { recursive: true });

    const classifier = new IntentClassifier({ cacheDir });

    const crypto = require('node:crypto');
    const prompt = 'expired cache test';
    const hash = crypto.createHash('sha256').update(prompt).digest('hex').slice(0, 16);
    const cacheEntry = {
      intent: 'code-modify',
      confidence: 0.9,
      timestamp: Date.now() - (2 * 60 * 60 * 1000), // 2 hours ago (expired)
    };
    fs.writeFileSync(path.join(cacheDir, `${hash}.json`), JSON.stringify(cacheEntry));

    // Without a working claude CLI, classify will return ambiguous after cache miss
    const result = await classifier.classify(prompt);
    expect(result.intent).toBe('ambiguous');
    expect(result.confidence).toBe(0);
  });

  it('clearCache removes all .json files from cacheDir', () => {
    const cacheDir = path.join(tmpDir, 'cache');
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, 'abc123.json'), '{}');
    fs.writeFileSync(path.join(cacheDir, 'def456.json'), '{}');

    const classifier = new IntentClassifier({ cacheDir });
    classifier.clearCache();

    const remaining = fs.readdirSync(cacheDir).filter(f => f.endsWith('.json'));
    expect(remaining).toHaveLength(0);
  });
});

// ─── UserProfile ─────────────────────────────────────────────────────────

describe('UserProfile', () => {
  it('returns 0 adjustment when feature flag is disabled (default)', () => {
    // USER_PROFILE_ENABLED defaults to undefined (not 'true')
    const profile = new UserProfile(tmpDir);
    expect(profile.getThresholdAdjustment('user1')).toBe(0);
  });

  it('returns 0 adjustment for new user (no interaction history)', () => {
    process.env.USER_PROFILE_ENABLED = 'true';
    const profile = new UserProfile(tmpDir);
    expect(profile.getThresholdAdjustment('user1')).toBe(0);
  });

  it('returns positive bias (raise threshold) when FP rate is high', () => {
    process.env.USER_PROFILE_ENABLED = 'true';
    const profile = new UserProfile(tmpDir);

    // Record 10+ interactions with high FP rate
    for (let i = 0; i < 5; i++) {
      profile.recordInteraction('user1', { prompt: 'test', verdict: 'FP' });
    }
    for (let i = 0; i < 5; i++) {
      profile.recordInteraction('user1', { prompt: 'test', verdict: 'TP' });
    }
    // 5 more FP to exceed threshold
    for (let i = 0; i < 3; i++) {
      profile.recordInteraction('user1', { prompt: 'test', verdict: 'FP' });
    }

    const adjustment = profile.getThresholdAdjustment('user1');
    // High FP rate should give positive bias (raise threshold)
    expect(adjustment).toBeGreaterThan(0);
  });

  it('records interactions and persists profile to disk', () => {
    process.env.USER_PROFILE_ENABLED = 'true';
    const profile = new UserProfile(tmpDir);

    profile.recordInteraction('user1', { prompt: 'fix bug', verdict: 'TP' });
    profile.recordInteraction('user1', { prompt: 'hello', verdict: 'FP' });

    // Verify profile was persisted
    const profilePath = path.join(tmpDir, 'user-profile.json');
    expect(fs.existsSync(profilePath)).toBe(true);

    const saved = JSON.parse(fs.readFileSync(profilePath, 'utf-8'));
    expect(saved.interactions.tp).toBe(1);
    expect(saved.interactions.fp).toBe(1);
    expect(saved.interactions.total).toBe(2);
  });

  it('detects auto-negative patterns from repeated FP prompts', () => {
    process.env.USER_PROFILE_ENABLED = 'true';
    const profile = new UserProfile(tmpDir);

    // Record the same FP prompt 5 times (exceeds FP_PATTERN_THRESHOLD of 4)
    for (let i = 0; i < 5; i++) {
      profile.recordInteraction('user1', { prompt: 'show status', verdict: 'FP' });
    }

    const negatives = profile.getAutoNegatives('user1');
    expect(negatives.length).toBeGreaterThanOrEqual(1);
    expect(negatives[0]).toContain('show status');
  });
});

// ─── Scoring Corpus Compatibility ────────────────────────────────────────

describe('Scoring Corpus — Phase 3 compatibility', () => {
  let corpus;
  let matcher;

  beforeAll(() => {
    const rules = require('../../forge/hooks/activation/skill-rules.json');
    matcher = new RulesMatcher(rules);
    corpus = require('../../tests/corpus/scoring-corpus.json');
  });

  it('corpus has at least 129 entries (includes Phase 3 additions)', () => {
    expect(corpus.length).toBeGreaterThanOrEqual(129);
  });

  it('overall precision >= 75% (matching current baseline)', () => {
    const results = corpus.map(entry => {
      const matches = matcher.matchPrompt(entry.prompt);
      const triggered = matches.length > 0;
      return { ...entry, triggered };
    });

    const triggered = results.filter(r => r.triggered);
    if (triggered.length === 0) throw new Error('No prompts triggered');
    const truePositives = triggered.filter(r => r.shouldTrigger).length;
    const precision = truePositives / triggered.length;
    expect(precision).toBeGreaterThanOrEqual(0.75);
  });

  it('overall recall >= 70% (matching current baseline)', () => {
    const results = corpus.map(entry => {
      const matches = matcher.matchPrompt(entry.prompt);
      const triggered = matches.length > 0;
      return { ...entry, triggered };
    });

    const shouldTrigger = results.filter(r => r.shouldTrigger);
    const truePositives = shouldTrigger.filter(r => r.triggered).length;
    const recall = truePositives / shouldTrigger.length;
    expect(recall).toBeGreaterThanOrEqual(0.70);
  });

  it('zero false positives in chat category', () => {
    const chats = corpus.filter(
      e => e.category === 'chat' && !e.shouldTrigger
    );
    const falsePositives = chats.filter(entry => {
      const matches = matcher.matchPrompt(entry.prompt);
      return matches.length > 0;
    });
    expect(falsePositives).toHaveLength(0);
  });

  it('Phase 3 ambiguous entries do not false-trigger', () => {
    const ambiguous = corpus.filter(e => e.category === 'phase3-ambiguous');
    expect(ambiguous.length).toBeGreaterThanOrEqual(3);
    for (const entry of ambiguous) {
      const matches = matcher.matchPrompt(entry.prompt);
      const forge = matches.find(r => r.skillName === 'forge');
      expect(forge).toBeUndefined();
    }
  });
});
