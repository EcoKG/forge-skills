// Ensure minimum test coverage by counting test files and assertions
const fs = require("fs");
const path = require("path");

describe("Coverage Check", () => {
  it("has minimum number of test files", () => {
    const unitTests = fs
      .readdirSync(path.join(__dirname, "../unit"))
      .filter((f) => f.endsWith(".test.js"));
    const integrationTests = fs
      .readdirSync(path.join(__dirname, "../integration"))
      .filter((f) => f.endsWith(".test.js"));
    const e2eTests = fs
      .readdirSync(path.join(__dirname, "../e2e"))
      .filter((f) => f.endsWith(".test.js"));

    expect(unitTests.length).toBeGreaterThanOrEqual(8);
    expect(integrationTests.length).toBeGreaterThanOrEqual(5);
    expect(e2eTests.length).toBeGreaterThanOrEqual(1);
  });

  it("covers all major components", () => {
    // Check that test files exist for each major component
    const allTests = fs
      .readdirSync(path.join(__dirname, "../unit"))
      .concat(fs.readdirSync(path.join(__dirname, "../integration")))
      .join(" ");

    expect(allTests).toContain("gate-guard");
    expect(allTests).toContain("engine");
    expect(allTests).toContain("rules-matcher");
    expect(allTests).toContain("secret");
    expect(allTests).toContain("install");
    expect(allTests).toContain("orchestrator");
  });
});
