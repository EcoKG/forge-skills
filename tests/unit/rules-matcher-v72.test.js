/**
 * Rules-Matcher v7.2 Tests — Skill Name Adaptive Matching + Korean Question Endings
 *
 * Tests the v7.2 changes:
 *   - Slash command (/forge) = instant trigger (score 100)
 *   - Text mention ("forge") + no negative signal = instant trigger (score 100)
 *   - Text mention ("forge") + negative signal (question) = bonus scoring (40pts)
 *   - Korean interrogative endings (있나/없나/됐나/했나/하나/맞나/될까) as negative signals
 */

const rules = require("../../forge/hooks/activation/skill-rules.json");

let RulesMatcher;

beforeAll(async () => {
  const mod = await import("../../forge/hooks/activation/rules-matcher.js");
  RulesMatcher = mod.RulesMatcher;
});

describe("RulesMatcher v7.2 — Adaptive Skill Name Matching", () => {
  let matcher;

  beforeEach(() => {
    matcher = new RulesMatcher(rules);
  });

  // ─── Slash commands: always instant trigger ───────────────────────

  describe("Slash commands → always instant trigger (score 100)", () => {
    const slashCases = [
      "/forge implement JWT auth",
      "/forge 결제 기능 구현",
      "/forge --analyze 아키텍처 분석",
      "/forge --quick fix typo",
    ];

    for (const prompt of slashCases) {
      it(`"${prompt}" → score 100`, () => {
        const results = matcher.matchPrompt(prompt);
        const forge = results.find(r => r.skillName === "forge");
        expect(forge).toBeDefined();
        expect(forge.score).toBe(100);
        expect(forge.smartScore.skillNameMatch).toBe(true);
      });
    }
  });

  // ─── Text mention + no question → instant trigger ─────────────────

  describe("Text mention + no question context → instant trigger (score 100)", () => {
    const directCases = [
      "forge",
      "포지",
      "forge로 구현해줘",
      "forge 스킬 리팩토링해줘",
      "포지로 버그 수정",
    ];

    for (const prompt of directCases) {
      it(`"${prompt}" → score 100`, () => {
        const results = matcher.matchPrompt(prompt);
        const forge = results.find(r => r.skillName === "forge");
        expect(forge).toBeDefined();
        expect(forge.score).toBe(100);
      });
    }
  });

  // ─── Text mention + question → NO instant trigger ─────────────────

  describe("Text mention + question context → NOT instant trigger", () => {
    const questionCases = [
      { prompt: "지금 내 forge 스킬에 TDD 명시되어있나?", desc: "exists question with 있나" },
      { prompt: "forge 스킬에 TDD 있나?", desc: "short exists question" },
      { prompt: "forge에서 analyze 파이프라인이 작동하나?", desc: "작동하나 ending" },
      { prompt: "forge가 이 프로젝트에서 필요한가?", desc: "meta question about forge" },
      { prompt: "포지 스킬에 뭐가 있는지 알려줘", desc: "있는지 ending" },
      { prompt: "forge hook이 왜 발동됐나?", desc: "됐나 ending" },
    ];

    for (const { prompt, desc } of questionCases) {
      it(`"${prompt}" (${desc}) → score < 50 (no block)`, () => {
        const results = matcher.matchPrompt(prompt);
        const forge = results.find(r => r.skillName === "forge");
        // Either not matched or score below block threshold
        const score = forge ? forge.score : 0;
        expect(score).toBeLessThan(50);
      });
    }
  });

  // ─── Korean interrogative endings as negative signals ─────────────

  describe("Korean interrogative endings → negative signal (-40)", () => {
    const endings = [
      { prompt: "이 코드에 버그 있나?", ending: "있나" },
      { prompt: "테스트가 없나?", ending: "없나" },
      { prompt: "배포 됐나?", ending: "됐나" },
      { prompt: "PR 머지 했나?", ending: "했나" },
      { prompt: "이 접근법이 맞나?", ending: "맞나" },
      { prompt: "이렇게 하면 되나?", ending: "되나" },
      { prompt: "이 함수가 작동하나?", ending: "하나" },
      { prompt: "성능 개선이 될까?", ending: "될까" },
    ];

    for (const { prompt, ending } of endings) {
      it(`"${prompt}" — ending "${ending}" triggers negative signal`, () => {
        const score = matcher.scoreNegativeSignals(prompt);
        expect(score).toBeLessThan(0);
      });
    }
  });

  // ─── skillNameBonus in smartScore ─────────────────────────────────

  describe("skillNameBonus appears in smartScore when applicable", () => {
    it("question about forge → smartScore.skillNameBonus = 40", () => {
      const results = matcher.matchPrompt("forge 스킬에 TDD 있나?");
      const forge = results.find(r => r.skillName === "forge");
      // May or may not match depending on total score, but if it does, check bonus
      if (forge) {
        expect(forge.smartScore.skillNameBonus).toBe(40);
      }
    });

    it("slash command → no skillNameBonus (uses instant trigger path)", () => {
      const results = matcher.matchPrompt("/forge implement JWT");
      const forge = results.find(r => r.skillName === "forge");
      expect(forge).toBeDefined();
      expect(forge.smartScore.skillNameMatch).toBe(true);
      // Instant trigger path doesn't set skillNameBonus
      expect(forge.smartScore.skillNameBonus).toBeUndefined();
    });
  });
});
