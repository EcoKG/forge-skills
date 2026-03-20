/**
 * Unit tests for ContextAccumulator
 *
 * Tests multi-turn score accumulation, decay, tool pattern detection,
 * skill suggestion dedup, flush, cleanup, legacy migration, and feature flag.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

let ContextAccumulator;

beforeAll(async () => {
  const mod = await import('../../forge/hooks/activation/context-accumulator.js');
  ContextAccumulator = mod.ContextAccumulator;
});

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ca-test-'));
  // Ensure feature flag is on
  delete process.env.CONTEXT_ACCUMULATOR_ENABLED;
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.CONTEXT_ACCUMULATOR_ENABLED;
});

// ─── Score Accumulation ──────────────────────────────────────────────

describe('Score Accumulation', () => {
  it('single turn: score=45 → cumulative=45', () => {
    const acc = new ContextAccumulator(tmpDir);
    const ctx = acc.accumulateScore('s1', { score: 45 });
    expect(ctx).not.toBeNull();
    expect(ctx.cumulativeScore).toBe(45);
    expect(ctx.turns).toHaveLength(1);
  });

  it('2-turn decay: 20 + 45 → 45 + 20*0.7 = 59', () => {
    const acc = new ContextAccumulator(tmpDir);
    acc.accumulateScore('s1', { score: 20 });
    acc.flush();

    const ctx = acc.accumulateScore('s1', { score: 45 });
    // turns: [20, 45]
    // cumulative: 20 * 0.7^1 + 45 * 0.7^0 = 14 + 45 = 59
    expect(ctx.cumulativeScore).toBe(59);
    expect(ctx.turns).toHaveLength(2);
  });

  it('3-turn decay: 20 + 30 + 45 → 45 + 30*0.7 + 20*0.49 = 75.8', () => {
    const acc = new ContextAccumulator(tmpDir);
    acc.accumulateScore('s1', { score: 20 });
    acc.flush();
    acc.accumulateScore('s1', { score: 30 });
    acc.flush();

    const ctx = acc.accumulateScore('s1', { score: 45 });
    // turns: [20, 30, 45]
    // cumulative: 20 * 0.7^2 + 30 * 0.7^1 + 45 * 0.7^0
    //           = 20 * 0.49 + 30 * 0.7 + 45
    //           = 9.8 + 21 + 45 = 75.8
    expect(ctx.cumulativeScore).toBeCloseTo(75.8, 1);
    expect(ctx.turns).toHaveLength(3);
  });

  it('FIFO: 21 turns → only 20 kept', () => {
    const acc = new ContextAccumulator(tmpDir);
    for (let i = 0; i < 21; i++) {
      acc.accumulateScore('s1', { score: 10 });
    }
    // 21 pushed, FIFO keeps 20
    acc.flush();
    const ctx = acc.getContext('s1');
    expect(ctx.turns).toHaveLength(20);
  });
});

// ─── Tool Pattern Detection ──────────────────────────────────────────

describe('Tool Pattern Detection', () => {
  it('Read >= 8 → investigation pattern (+25)', () => {
    const acc = new ContextAccumulator(tmpDir);
    acc.accumulateScore('s1', { score: 10 });
    for (let i = 0; i < 8; i++) {
      acc.recordToolUse('s1', 'Read', { file_path: `/file${i}.js` });
    }
    const pattern = acc.detectToolPattern('s1');
    expect(pattern).toBe('investigation');

    // Verify bonus is applied — accumulate another turn to check
    const ctx = acc.accumulateScore('s1', { score: 0 });
    // turns: [10, 0], bonus: 25
    // decayed: 10 * 0.7 + 0 + 25 = 32
    expect(ctx.toolPatternBonus).toBe(25);
    expect(ctx.cumulativeScore).toBeCloseTo(32, 1);
  });

  it('Grep 3 + Glob 2 → search-heavy pattern (+20)', () => {
    const acc = new ContextAccumulator(tmpDir);
    acc.accumulateScore('s1', { score: 10 });
    for (let i = 0; i < 3; i++) {
      acc.recordToolUse('s1', 'Grep');
    }
    for (let i = 0; i < 2; i++) {
      acc.recordToolUse('s1', 'Glob');
    }
    const pattern = acc.detectToolPattern('s1');
    expect(pattern).toBe('search-heavy');
  });

  it('Read 3 + Edit 1 → edit-attempt pattern (+35)', () => {
    const acc = new ContextAccumulator(tmpDir);
    acc.accumulateScore('s1', { score: 10 });
    for (let i = 0; i < 3; i++) {
      acc.recordToolUse('s1', 'Read', { file_path: `/file${i}.js` });
    }
    acc.recordToolUse('s1', 'Edit');
    const pattern = acc.detectToolPattern('s1');
    expect(pattern).toBe('edit-attempt');
  });

  it('Read 3 distinct files → multi-file-read pattern (+15)', () => {
    const acc = new ContextAccumulator(tmpDir);
    acc.accumulateScore('s1', { score: 10 });
    acc.recordToolUse('s1', 'Read', { file_path: '/a.js' });
    acc.recordToolUse('s1', 'Read', { file_path: '/b.js' });
    acc.recordToolUse('s1', 'Read', { file_path: '/c.js' });
    const pattern = acc.detectToolPattern('s1');
    // multi-file-read has lower bonus than edit-attempt or investigation
    // but Read count < 8 so investigation doesn't trigger; no Edit so edit-attempt doesn't trigger
    expect(pattern).toBe('multi-file-read');
  });

  it('edit-attempt wins over multi-file-read when both match', () => {
    const acc = new ContextAccumulator(tmpDir);
    acc.accumulateScore('s1', { score: 10 });
    // 3 distinct reads + 1 edit → both multi-file-read and edit-attempt
    acc.recordToolUse('s1', 'Read', { file_path: '/a.js' });
    acc.recordToolUse('s1', 'Read', { file_path: '/b.js' });
    acc.recordToolUse('s1', 'Read', { file_path: '/c.js' });
    acc.recordToolUse('s1', 'Write');
    const pattern = acc.detectToolPattern('s1');
    // edit-attempt has bonus 35 > multi-file-read 15
    expect(pattern).toBe('edit-attempt');
  });
});

// ─── Context Lifecycle ───────────────────────────────────────────────

describe('Context Lifecycle', () => {
  it('getContext returns null for unknown session', () => {
    const acc = new ContextAccumulator(tmpDir);
    const ctx = acc.getContext('nonexistent');
    expect(ctx).toBeNull();
  });

  it('flush writes to disk and is readable', () => {
    const acc = new ContextAccumulator(tmpDir);
    acc.accumulateScore('s1', { score: 50 });
    acc.flush();

    const filePath = acc.getContextFilePath('s1');
    expect(fs.existsSync(filePath)).toBe(true);

    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(raw.cumulativeScore).toBe(50);
    expect(raw.turns).toHaveLength(1);
    expect(raw.version).toBe(1);
  });

  it('cleanup removes old files', () => {
    const acc = new ContextAccumulator(tmpDir);
    // Create a context file with old timestamp
    const filePath = acc.getContextFilePath('old-session');
    fs.mkdirSync(tmpDir, { recursive: true });
    const oldCtx = {
      version: 1,
      sessionId: 'old-session',
      updatedAt: Date.now() - 2 * 86400000, // 2 days ago
      turns: [],
    };
    fs.writeFileSync(filePath, JSON.stringify(oldCtx));
    expect(fs.existsSync(filePath)).toBe(true);

    acc.cleanup(86400000); // 24h max age
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it('cleanup does not remove recent files', () => {
    const acc = new ContextAccumulator(tmpDir);
    acc.accumulateScore('recent', { score: 30 });
    acc.flush();

    const filePath = acc.getContextFilePath('recent');
    expect(fs.existsSync(filePath)).toBe(true);

    acc.cleanup(86400000);
    expect(fs.existsSync(filePath)).toBe(true);
  });
});

// ─── Skill Suggestions ──────────────────────────────────────────────

describe('Skill Suggestions', () => {
  it('updateSkillState stores data', () => {
    const acc = new ContextAccumulator(tmpDir);
    acc.updateSkillState('s1', { skill: 'forge', score: 80 });
    acc.flush();

    const ctx = acc.getContext('s1');
    expect(ctx.skillState.skill).toBe('forge');
    expect(ctx.skillState.score).toBe(80);
    expect(ctx.skillState.timestamp).toBeDefined();
  });

  it('markSkillSuggested + wasSkillSuggested dedup', () => {
    const acc = new ContextAccumulator(tmpDir);
    expect(acc.wasSkillSuggested('s1', 'forge')).toBe(false);

    acc.markSkillSuggested('s1', 'forge');
    expect(acc.wasSkillSuggested('s1', 'forge')).toBe(true);

    // Duplicate mark should not add twice
    acc.markSkillSuggested('s1', 'forge');
    acc.flush();

    const ctx = acc.getContext('s1');
    expect(ctx.suggestedSkills).toEqual(['forge']);
  });

  it('wasSkillSuggested returns false for unknown skill', () => {
    const acc = new ContextAccumulator(tmpDir);
    acc.markSkillSuggested('s1', 'forge');
    expect(acc.wasSkillSuggested('s1', 'release')).toBe(false);
  });
});

// ─── Feature Flag ────────────────────────────────────────────────────

describe('Feature Flag', () => {
  it('CONTEXT_ACCUMULATOR_ENABLED=false disables accumulation', () => {
    process.env.CONTEXT_ACCUMULATOR_ENABLED = 'false';
    const acc = new ContextAccumulator(tmpDir);

    const ctx1 = acc.accumulateScore('s1', { score: 20 });
    acc.flush();
    const ctx2 = acc.accumulateScore('s1', { score: 45 });

    // Should not accumulate — returns single-turn score only
    expect(ctx2.cumulativeScore).toBe(45);
    // Turns should not grow (no accumulation when disabled)
  });

  it('enabled property reflects flag state', () => {
    const acc = new ContextAccumulator(tmpDir);
    expect(acc.enabled).toBe(true);

    process.env.CONTEXT_ACCUMULATOR_ENABLED = 'false';
    expect(acc.enabled).toBe(false);

    process.env.CONTEXT_ACCUMULATOR_ENABLED = 'true';
    expect(acc.enabled).toBe(true);
  });
});

// ─── Legacy Migration ────────────────────────────────────────────────

describe('Legacy Migration', () => {
  it('migrates from 3 legacy files into unified context', () => {
    fs.mkdirSync(tmpDir, { recursive: true });
    const safeId = 'legacy-session';

    // Create legacy skill-required file
    fs.writeFileSync(
      path.join(tmpDir, `skill-required-${safeId}.json`),
      JSON.stringify({ skill: 'forge', score: 65, timestamp: Date.now() - 10000 })
    );
    // Create legacy skills-used file
    fs.writeFileSync(
      path.join(tmpDir, `skills-used-${safeId}.json`),
      JSON.stringify({ skills: ['forge'], timestamp: Date.now() - 10000 })
    );
    // Create legacy forge-tracker file
    fs.writeFileSync(
      path.join(tmpDir, `forge-tracker-${safeId}.json`),
      JSON.stringify({ toolUseCount: 42, lastWarnAt: 0 })
    );

    const acc = new ContextAccumulator(tmpDir);
    const ctx = acc.getContext(safeId);

    expect(ctx).not.toBeNull();
    expect(ctx.skillState.skill).toBe('forge');
    expect(ctx.suggestedSkills).toEqual(['forge']);
    expect(ctx.toolUsage._legacy.count).toBe(42);
    expect(ctx.turns).toHaveLength(1);
    expect(ctx.turns[0].score).toBe(65);
  });

  it('returns null when no legacy files exist', () => {
    const acc = new ContextAccumulator(tmpDir);
    const ctx = acc.getContext('no-legacy');
    expect(ctx).toBeNull();
  });
});

// ─── Edge Cases ──────────────────────────────────────────────────────

describe('Edge Cases', () => {
  it('accumulateScore with null session returns null', () => {
    const acc = new ContextAccumulator(tmpDir);
    expect(acc.accumulateScore(null, { score: 10 })).toBeNull();
  });

  it('accumulateScore with null turnScore returns null', () => {
    const acc = new ContextAccumulator(tmpDir);
    expect(acc.accumulateScore('s1', null)).toBeNull();
  });

  it('recordToolUse with no session returns null', () => {
    const acc = new ContextAccumulator(tmpDir);
    expect(acc.recordToolUse(null, 'Read')).toBeNull();
  });

  it('getContextFilePath sanitizes special characters', () => {
    const acc = new ContextAccumulator(tmpDir);
    const fp = acc.getContextFilePath('ses/sion:id');
    const filename = path.basename(fp);
    expect(filename).toBe('context-ses_sion_id.json');
    // Filename should not contain raw special chars from sessionId
    expect(filename).not.toMatch(/[/:]/);
  });

  it('flush with no pending writes does not throw', () => {
    const acc = new ContextAccumulator(tmpDir);
    expect(() => acc.flush()).not.toThrow();
  });

  it('tool pattern detection with tool bonus recalculates cumulative', () => {
    const acc = new ContextAccumulator(tmpDir);
    acc.accumulateScore('s1', { score: 20 });
    // 8 reads for investigation pattern
    for (let i = 0; i < 8; i++) {
      acc.recordToolUse('s1', 'Read', { file_path: `/file${i}.js` });
    }
    acc.detectToolPattern('s1');
    // Now accumulate again — bonus should be included
    const ctx = acc.accumulateScore('s1', { score: 30 });
    // turns: [20, 30], bonus: 25
    // decayed: 20 * 0.7 + 30 + 25 = 14 + 30 + 25 = 69
    expect(ctx.cumulativeScore).toBeCloseTo(69, 1);
  });
});
