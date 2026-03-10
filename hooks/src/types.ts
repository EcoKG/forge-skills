// Hook Auto-Activation System — Type Definitions

/** Skill rule enforcement level */
export type Enforcement = 'block' | 'suggest' | 'warn';

/** Skill type */
export type SkillType = 'guardrail' | 'domain';

/** Priority level for trigger matching */
export type Priority = 'critical' | 'high' | 'medium' | 'low';

/** Prompt-based trigger configuration */
export interface PromptTriggers {
  keywords?: string[];
  intentPatterns?: string[];
}

/** File-based trigger configuration */
export interface FileTriggers {
  pathPatterns?: string[];
  pathExclusions?: string[];
  contentPatterns?: string[];
}

/** Conditions to skip skill suggestion */
export interface SkipConditions {
  sessionSkillUsed?: boolean;
  fileMarkers?: string[];
  envOverride?: string;
}

/** Single skill rule definition */
export interface SkillRule {
  type: SkillType;
  enforcement: Enforcement;
  priority: Priority;
  description?: string;
  promptTriggers?: PromptTriggers;
  fileTriggers?: FileTriggers;
  blockMessage?: string;
  skipConditions?: SkipConditions;
}

/** Root skill-rules.json schema */
export interface SkillRules {
  version: string;
  description?: string;
  skills: Record<string, SkillRule>;
}

/** Input received via stdin from Claude Code */
export interface HookInput {
  session_id: string;
  prompt?: string;
  cwd?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  hook_event_name?: string;
}

/** Result of matching a prompt against skill rules */
export interface MatchResult {
  skillName: string;
  rule: SkillRule;
  matchedKeywords: string[];
  matchedIntents: string[];
  score: number;
}

/** Priority weight for sorting */
export const PRIORITY_WEIGHTS: Record<Priority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};
