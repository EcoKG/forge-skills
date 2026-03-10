import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { SessionTracker } from '../src/session-tracker.js';

const TEST_STATE_DIR = '/tmp/hook-test-state';

describe('SessionTracker', () => {
  let tracker: SessionTracker;

  beforeEach(() => {
    if (fs.existsSync(TEST_STATE_DIR)) {
      fs.rmSync(TEST_STATE_DIR, { recursive: true });
    }
    tracker = new SessionTracker(TEST_STATE_DIR);
  });

  afterEach(() => {
    if (fs.existsSync(TEST_STATE_DIR)) {
      fs.rmSync(TEST_STATE_DIR, { recursive: true });
    }
  });

  describe('tracking suggestions', () => {
    it('should record a skill suggestion', () => {
      tracker.markSuggested('session-1', 'forge');
      assert.ok(tracker.wasSuggested('session-1', 'forge'));
    });

    it('should not report unseen skills', () => {
      assert.ok(!tracker.wasSuggested('session-1', 'forge'));
    });

    it('should track multiple skills per session', () => {
      tracker.markSuggested('session-1', 'forge');
      tracker.markSuggested('session-1', 'create-research');
      assert.ok(tracker.wasSuggested('session-1', 'forge'));
      assert.ok(tracker.wasSuggested('session-1', 'create-research'));
      assert.ok(!tracker.wasSuggested('session-1', 'other-skill'));
    });
  });

  describe('session isolation', () => {
    it('should isolate state between sessions', () => {
      tracker.markSuggested('session-1', 'forge');
      assert.ok(tracker.wasSuggested('session-1', 'forge'));
      assert.ok(!tracker.wasSuggested('session-2', 'forge'));
    });
  });

  describe('persistence', () => {
    it('should create state directory if not exists', () => {
      tracker.markSuggested('session-1', 'forge');
      assert.ok(fs.existsSync(TEST_STATE_DIR));
    });

    it('should persist state to disk', () => {
      tracker.markSuggested('session-1', 'forge');
      // Create new tracker instance (simulates new process)
      const tracker2 = new SessionTracker(TEST_STATE_DIR);
      assert.ok(tracker2.wasSuggested('session-1', 'forge'));
    });
  });

  describe('cleanup', () => {
    it('should clean up old state files', () => {
      // Create a fake old state file
      fs.mkdirSync(TEST_STATE_DIR, { recursive: true });
      const oldFile = path.join(TEST_STATE_DIR, 'skills-used-old-session.json');
      fs.writeFileSync(oldFile, '{"skills":["forge"],"timestamp":0}');

      tracker.cleanupOldSessions(0); // maxAge = 0ms → everything is old
      assert.ok(!fs.existsSync(oldFile));
    });
  });
});
