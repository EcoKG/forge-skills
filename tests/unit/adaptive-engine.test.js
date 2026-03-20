/**
 * Unit tests for AdaptiveEngine
 *
 * Tests verdict classification, JSONL append, adaptive weights loading,
 * feedback log rotation, convenience methods, and feature flag behavior.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

let AdaptiveEngine;

beforeAll(async () => {
  const mod = await import('../../forge/hooks/activation/adaptive-engine.js');
  AdaptiveEngine = mod.AdaptiveEngine;
});

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ae-test-'));
  // Ensure feature flag is on
  delete process.env.FEEDBACK_COLLECTION_ENABLED;
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.FEEDBACK_COLLECTION_ENABLED;
});

// ─── Verdict Classification ──────────────────────────────────────────

describe('classifyVerdict', () => {
  it('TP: triggered=true, userInvokedSkill=true', () => {
    expect(AdaptiveEngine.classifyVerdict({
      triggered: true,
      userInvokedSkill: true,
    })).toBe('TP');
  });

  it('FP: triggered=true, userInvokedSkill=false', () => {
    expect(AdaptiveEngine.classifyVerdict({
      triggered: true,
      userInvokedSkill: false,
    })).toBe('FP');
  });

  it('FN: triggered=false, userInvokedSkill=true', () => {
    expect(AdaptiveEngine.classifyVerdict({
      triggered: false,
      userInvokedSkill: true,
    })).toBe('FN');
  });

  it('TN: triggered=false, userInvokedSkill=false', () => {
    expect(AdaptiveEngine.classifyVerdict({
      triggered: false,
      userInvokedSkill: false,
    })).toBe('TN');
  });
});

// ─── recordOutcome ───────────────────────────────────────────────────

describe('recordOutcome', () => {
  it('writes a JSONL entry with correct verdict', () => {
    const engine = new AdaptiveEngine(tmpDir);
    engine.recordOutcome('session-1', {
      prompt: 'fix the bug',
      score: 75,
      triggered: true,
      userInvokedSkill: true,
      skillName: 'forge',
    });

    const logPath = path.join(tmpDir, 'feedback-log.jsonl');
    expect(fs.existsSync(logPath)).toBe(true);

    const content = fs.readFileSync(logPath, 'utf-8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(1);

    const entry = JSON.parse(lines[0]);
    expect(entry.sessionId).toBe('session-1');
    expect(entry.prompt).toBe('fix the bug');
    expect(entry.score).toBe(75);
    expect(entry.verdict).toBe('TP');
    expect(entry.triggered).toBe(true);
    expect(entry.userInvokedSkill).toBe(true);
    expect(entry.timestamp).toBeDefined();
  });

  it('truncates prompt to 200 characters', () => {
    const engine = new AdaptiveEngine(tmpDir);
    const longPrompt = 'x'.repeat(500);
    engine.recordOutcome('s1', {
      prompt: longPrompt,
      score: 50,
      triggered: true,
      userInvokedSkill: false,
    });

    const logPath = path.join(tmpDir, 'feedback-log.jsonl');
    const entry = JSON.parse(fs.readFileSync(logPath, 'utf-8').trim());
    expect(entry.prompt).toHaveLength(200);
  });

  it('does nothing when feature flag is disabled', () => {
    process.env.FEEDBACK_COLLECTION_ENABLED = 'false';
    const engine = new AdaptiveEngine(tmpDir);
    engine.recordOutcome('s1', {
      prompt: 'test',
      score: 50,
      triggered: true,
      userInvokedSkill: true,
    });

    const logPath = path.join(tmpDir, 'feedback-log.jsonl');
    expect(fs.existsSync(logPath)).toBe(false);
  });
});

// ─── getAdaptiveWeights ──────────────────────────────────────────────

describe('getAdaptiveWeights', () => {
  it('returns null when no weights file exists', () => {
    const engine = new AdaptiveEngine(tmpDir);
    expect(engine.getAdaptiveWeights()).toBeNull();
  });

  it('returns parsed weights when file exists', () => {
    const engine = new AdaptiveEngine(tmpDir);
    const weightsData = {
      version: '1.0',
      weights: { keyword: 15, intent: 20 },
      thresholds: { block: 80, ask: 50, pass: 0 },
    };
    fs.writeFileSync(
      path.join(tmpDir, 'adaptive-weights.json'),
      JSON.stringify(weightsData),
    );

    const result = engine.getAdaptiveWeights();
    expect(result).not.toBeNull();
    expect(result.version).toBe('1.0');
    expect(result.weights.keyword).toBe(15);
    expect(result.thresholds.block).toBe(80);
  });

  it('returns null on corrupted weights file', () => {
    const engine = new AdaptiveEngine(tmpDir);
    fs.writeFileSync(
      path.join(tmpDir, 'adaptive-weights.json'),
      'not valid json{{{',
    );

    expect(engine.getAdaptiveWeights()).toBeNull();
  });
});

// ─── Feedback Log Rotation ───────────────────────────────────────────

describe('Feedback log rotation', () => {
  it('rotates when exceeding 10000 lines, keeping 5000', () => {
    const engine = new AdaptiveEngine(tmpDir);
    const logPath = path.join(tmpDir, 'feedback-log.jsonl');

    // Pre-populate with 10001 lines
    const lines = [];
    for (let i = 0; i < 10001; i++) {
      lines.push(JSON.stringify({
        sessionId: `s${i}`,
        prompt: `prompt ${i}`,
        score: 50,
        triggered: true,
        userInvokedSkill: true,
        verdict: 'TP',
        timestamp: Date.now(),
      }));
    }
    fs.writeFileSync(logPath, lines.join('\n') + '\n');

    // Record one more outcome to trigger rotation check
    engine.recordOutcome('s-new', {
      prompt: 'trigger rotation',
      score: 60,
      triggered: true,
      userInvokedSkill: false,
    });

    const content = fs.readFileSync(logPath, 'utf-8');
    const resultLines = content.split('\n').filter(l => l.trim().length > 0);
    // Should have rotated to ~5000 lines (5000 kept + 1 new appended before rotation,
    // but rotation takes last 5000 of all lines)
    expect(resultLines.length).toBeLessThanOrEqual(5001);
    expect(resultLines.length).toBeGreaterThanOrEqual(4999);
  });
});

// ─── Convenience Methods ─────────────────────────────────────────────

describe('Convenience methods', () => {
  it('recordTP writes TP verdict', () => {
    const engine = new AdaptiveEngine(tmpDir);
    engine.recordTP('s1', 'implement feature', 80);

    const logPath = path.join(tmpDir, 'feedback-log.jsonl');
    const entry = JSON.parse(fs.readFileSync(logPath, 'utf-8').trim());
    expect(entry.verdict).toBe('TP');
    expect(entry.triggered).toBe(true);
    expect(entry.userInvokedSkill).toBe(true);
  });

  it('recordFP writes FP verdict', () => {
    const engine = new AdaptiveEngine(tmpDir);
    engine.recordFP('s1', 'just a question', 45);

    const logPath = path.join(tmpDir, 'feedback-log.jsonl');
    const entry = JSON.parse(fs.readFileSync(logPath, 'utf-8').trim());
    expect(entry.verdict).toBe('FP');
    expect(entry.triggered).toBe(true);
    expect(entry.userInvokedSkill).toBe(false);
  });

  it('recordFN writes FN verdict', () => {
    const engine = new AdaptiveEngine(tmpDir);
    engine.recordFN('s1', 'fix the crash', 20);

    const logPath = path.join(tmpDir, 'feedback-log.jsonl');
    const entry = JSON.parse(fs.readFileSync(logPath, 'utf-8').trim());
    expect(entry.verdict).toBe('FN');
    expect(entry.triggered).toBe(false);
    expect(entry.userInvokedSkill).toBe(true);
  });
});
