import * as fs from 'node:fs';
import * as path from 'node:path';

interface SessionState {
  skills: string[];
  timestamp: number;
}

export class SessionTracker {
  private stateDir: string;

  constructor(stateDir: string) {
    this.stateDir = stateDir;
  }

  wasSuggested(sessionId: string, skillName: string): boolean {
    const state = this.readState(sessionId);
    return state?.skills.includes(skillName) ?? false;
  }

  markSuggested(sessionId: string, skillName: string): void {
    this.ensureDir();
    const state = this.readState(sessionId) ?? { skills: [], timestamp: Date.now() };
    if (!state.skills.includes(skillName)) {
      state.skills.push(skillName);
    }
    state.timestamp = Date.now();
    this.writeState(sessionId, state);
  }

  cleanupOldSessions(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
    if (!fs.existsSync(this.stateDir)) return;

    const now = Date.now();
    const files = fs.readdirSync(this.stateDir);

    for (const file of files) {
      if (!file.startsWith('skills-used-') || !file.endsWith('.json')) continue;
      const filePath = path.join(this.stateDir, file);
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const state: SessionState = JSON.parse(raw);
        if (now - state.timestamp > maxAgeMs) {
          fs.unlinkSync(filePath);
        }
      } catch {
        // Corrupted file — remove it
        try { fs.unlinkSync(filePath); } catch { /* ignore */ }
      }
    }
  }

  private stateFilePath(sessionId: string): string {
    const safeId = sessionId.replace(/[^a-zA-Z0-9-_]/g, '_');
    return path.join(this.stateDir, `skills-used-${safeId}.json`);
  }

  private readState(sessionId: string): SessionState | null {
    const filePath = this.stateFilePath(sessionId);
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw) as SessionState;
    } catch {
      return null;
    }
  }

  private writeState(sessionId: string, state: SessionState): void {
    const filePath = this.stateFilePath(sessionId);
    fs.writeFileSync(filePath, JSON.stringify(state));
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.stateDir)) {
      fs.mkdirSync(this.stateDir, { recursive: true });
    }
  }
}
