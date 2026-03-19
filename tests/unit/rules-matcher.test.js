/**
 * Task 7.7 — RulesMatcher Scoring Tests
 *
 * Tests the unified scoring system in RulesMatcher:
 *   - Skill name match → instant trigger (score 100)
 *   - Keyword / actionVerb / fileExtension / codeIdentifier → additive
 *   - Negative signals → suppress score
 *   - Keyword deduplication (substring removal)
 *   - Threshold gate (score >= 30 triggers, < 30 does not)
 */

const rules = require("../../forge/hooks/activation/skill-rules.json");

let RulesMatcher;

beforeAll(async () => {
  const mod = await import("../../forge/hooks/activation/rules-matcher.js");
  RulesMatcher = mod.RulesMatcher;
});

describe("RulesMatcher — Unified Scoring", () => {
  let matcher;

  beforeEach(() => {
    matcher = new RulesMatcher(rules);
  });

  // ─── Should trigger (score >= 30) ──────────────────────────────────

  describe("Should trigger (score >= 30)", () => {
    it('"/forge 결제 기능 구현" → instant trigger (score 100, skillName match)', () => {
      const results = matcher.matchPrompt("/forge 결제 기능 구현");
      expect(results.length).toBeGreaterThanOrEqual(1);

      const forge = results.find((r) => r.skillName === "forge");
      expect(forge).toBeDefined();
      expect(forge.score).toBe(100);
      expect(forge.smartScore.skillNameMatch).toBe(true);
    });

    it('"로그인 버튼 오류 수정" → high score via keywords', () => {
      const results = matcher.matchPrompt("로그인 버튼 오류 수정");
      const forge = results.find((r) => r.skillName === "forge");

      expect(forge).toBeDefined();
      expect(forge.score).toBeGreaterThanOrEqual(30);
      // Should match multiple keywords: 로그인, 버튼, 오류, 수정
      expect(forge.matchedKeywords.length).toBeGreaterThanOrEqual(3);
    });

    it('"implement JWT auth" → keyword + actionVerb + codeIdentifier', () => {
      const results = matcher.matchPrompt("implement JWT auth");
      const forge = results.find((r) => r.skillName === "forge");

      expect(forge).toBeDefined();
      expect(forge.score).toBeGreaterThanOrEqual(30);
      // "implement" is both a keyword and an action verb
      expect(forge.smartScore.keyword).toBeGreaterThan(0);
      expect(forge.smartScore.actionVerb).toBeGreaterThan(0);
    });

    it('"app.js 리팩토링" → fileExtension(.js) + keyword(리팩토링)', () => {
      const results = matcher.matchPrompt("app.js 리팩토링");
      const forge = results.find((r) => r.skillName === "forge");

      expect(forge).toBeDefined();
      expect(forge.score).toBeGreaterThanOrEqual(30);
      expect(forge.smartScore.fileExtension).toBeGreaterThan(0);
      expect(forge.smartScore.keyword).toBeGreaterThan(0);
    });
  });

  // ─── Should NOT trigger (score < 30 or negative) ──────────────────

  describe("Should NOT trigger (score < 30 or negative)", () => {
    it('"이 코드 설명해줘" → negative signal suppresses', () => {
      const results = matcher.matchPrompt("이 코드 설명해줘");
      const forge = results.find((r) => r.skillName === "forge");

      // Either not matched at all, or score < threshold
      if (forge) {
        expect(forge.score).toBeLessThan(30);
      } else {
        expect(forge).toBeUndefined();
      }
    });

    it('"what is this function?" → negative signal (English)', () => {
      const results = matcher.matchPrompt("what is this function?");
      const forge = results.find((r) => r.skillName === "forge");

      if (forge) {
        expect(forge.score).toBeLessThan(30);
      } else {
        expect(forge).toBeUndefined();
      }
    });

    it('"git log" → no keywords, no action verbs', () => {
      const results = matcher.matchPrompt("git log");
      const forge = results.find((r) => r.skillName === "forge");

      expect(forge).toBeUndefined();
    });

    it('"안녕하세요" → no signals at all', () => {
      const results = matcher.matchPrompt("안녕하세요");
      const forge = results.find((r) => r.skillName === "forge");

      expect(forge).toBeUndefined();
    });
  });

  // ─── Edge cases ────────────────────────────────────────────────────

  describe("Edge cases", () => {
    it('"변경" alone → keyword(15) + actionVerb(30) = 45 → triggers', () => {
      const results = matcher.matchPrompt("변경");
      const forge = results.find((r) => r.skillName === "forge");

      expect(forge).toBeDefined();
      expect(forge.score).toBeGreaterThanOrEqual(30);
      // "변경" is both a keyword (15) and an action verb (30)
      expect(forge.smartScore.keyword).toBe(15);
      expect(forge.smartScore.actionVerb).toBeGreaterThan(0);
    });

    it('"기능 구현" → keyword deduplication (should not double-count "구현")', () => {
      const results = matcher.matchPrompt("기능 구현");
      const forge = results.find((r) => r.skillName === "forge");

      expect(forge).toBeDefined();
      // "기능 구현" contains both "구현" and "기능 구현" as keywords.
      // Deduplication should remove "구현" because it's a substring of "기능 구현".
      const hasShort = forge.matchedKeywords.includes("구현");
      const hasLong = forge.matchedKeywords.includes("기능 구현");
      // The longer keyword should be kept, the shorter removed
      expect(hasLong).toBe(true);
      expect(hasShort).toBe(false);
    });

    it("empty prompt → returns empty array", () => {
      expect(matcher.matchPrompt("")).toEqual([]);
      expect(matcher.matchPrompt("   ")).toEqual([]);
      expect(matcher.matchPrompt(null)).toEqual([]);
    });

    it('"forge" alone → instant trigger via skillNamePatterns', () => {
      const results = matcher.matchPrompt("forge");
      const forge = results.find((r) => r.skillName === "forge");

      expect(forge).toBeDefined();
      expect(forge.score).toBe(100);
      expect(forge.smartScore.skillNameMatch).toBe(true);
    });

    it('"포지" (Korean alias) → instant trigger via skillNamePatterns', () => {
      const results = matcher.matchPrompt("포지");
      const forge = results.find((r) => r.skillName === "forge");

      expect(forge).toBeDefined();
      expect(forge.score).toBe(100);
      expect(forge.smartScore.skillNameMatch).toBe(true);
    });
  });
});
