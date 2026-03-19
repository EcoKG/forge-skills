const corpus = require("../corpus/scoring-corpus.json");

let RulesMatcher;
let rules;

beforeAll(async () => {
  const mod = await import("../../forge/hooks/activation/rules-matcher.js");
  RulesMatcher = mod.RulesMatcher;
  rules = require("../../forge/hooks/activation/skill-rules.json");
});

/**
 * Helper: run RulesMatcher on every corpus entry, return classified results.
 */
function evaluateCorpus() {
  const matcher = new RulesMatcher(rules);
  const results = [];

  for (const entry of corpus) {
    const matches = matcher.matchPrompt(entry.prompt);
    const triggered = matches.length > 0;
    const score = triggered ? matches[0].score : 0;
    const correct = triggered === entry.shouldTrigger;

    results.push({
      ...entry,
      triggered,
      score,
      correct,
    });
  }

  return results;
}

/**
 * Helper: log mismatches for debugging.
 */
function logMismatches(results) {
  const mismatches = results.filter((r) => !r.correct);
  if (mismatches.length === 0) return;

  console.log(`\n--- ${mismatches.length} MISMATCH(ES) ---`);
  for (const m of mismatches) {
    const direction = m.triggered ? "FALSE POSITIVE" : "FALSE NEGATIVE";
    console.log(
      `  [${direction}] category=${m.category} lang=${m.lang} score=${m.score} prompt="${m.prompt}"`
    );
  }
  console.log("--- END MISMATCHES ---\n");
}

describe("Scoring Calibration (corpus-based)", () => {
  let results;

  beforeAll(() => {
    results = evaluateCorpus();
    logMismatches(results);
  });

  test("corpus has at least 100 entries", () => {
    expect(corpus.length).toBeGreaterThanOrEqual(100);
  });

  test("overall precision >= 85%", () => {
    const triggered = results.filter((r) => r.triggered);
    if (triggered.length === 0) {
      throw new Error("No prompts triggered at all — something is wrong");
    }
    const truePositives = triggered.filter((r) => r.shouldTrigger).length;
    const precision = truePositives / triggered.length;

    console.log(
      `Precision: ${(precision * 100).toFixed(1)}% (${truePositives}/${triggered.length})`
    );
    expect(precision).toBeGreaterThanOrEqual(0.85);
  });

  test("overall recall >= 85%", () => {
    const shouldTrigger = results.filter((r) => r.shouldTrigger);
    const truePositives = shouldTrigger.filter((r) => r.triggered).length;
    const recall = truePositives / shouldTrigger.length;

    console.log(
      `Recall: ${(recall * 100).toFixed(1)}% (${truePositives}/${shouldTrigger.length})`
    );
    expect(recall).toBeGreaterThanOrEqual(0.85);
  });

  test("zero false positives in 'question' category", () => {
    const questions = results.filter((r) => r.category === "question");
    const falsePositives = questions.filter(
      (r) => r.triggered && !r.shouldTrigger
    );

    if (falsePositives.length > 0) {
      console.log("Question false positives:");
      for (const fp of falsePositives) {
        console.log(`  score=${fp.score} prompt="${fp.prompt}"`);
      }
    }

    expect(falsePositives).toHaveLength(0);
  });

  test("zero false positives in 'chat' category", () => {
    const chats = results.filter((r) => r.category === "chat");
    const falsePositives = chats.filter(
      (r) => r.triggered && !r.shouldTrigger
    );

    if (falsePositives.length > 0) {
      console.log("Chat false positives:");
      for (const fp of falsePositives) {
        console.log(`  score=${fp.score} prompt="${fp.prompt}"`);
      }
    }

    expect(falsePositives).toHaveLength(0);
  });

  test("code-request recall >= 90%", () => {
    const codeRequests = results.filter((r) => r.category === "code-request");
    const triggered = codeRequests.filter((r) => r.triggered).length;
    const recall = triggered / codeRequests.length;

    console.log(
      `Code-request recall: ${(recall * 100).toFixed(1)}% (${triggered}/${codeRequests.length})`
    );

    if (recall < 0.9) {
      const missed = codeRequests.filter((r) => !r.triggered);
      console.log("Missed code-requests:");
      for (const m of missed) {
        console.log(`  prompt="${m.prompt}"`);
      }
    }

    expect(recall).toBeGreaterThanOrEqual(0.9);
  });

  test("log all mismatches for debugging", () => {
    const mismatches = results.filter((r) => !r.correct);
    // This test always passes — it's purely for diagnostic output
    if (mismatches.length > 0) {
      console.log(`\nTotal mismatches: ${mismatches.length}/${results.length}`);
      for (const m of mismatches) {
        const direction = m.triggered ? "FP" : "FN";
        console.log(
          `  [${direction}] cat=${m.category} lang=${m.lang} score=${m.score} "${m.prompt}"`
        );
      }
    } else {
      console.log("All corpus entries matched expected outcomes.");
    }
    // Always pass — this is informational
    expect(true).toBe(true);
  });
});
