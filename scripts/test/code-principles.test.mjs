import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  countPhysicalLines,
  getOversizedFileViolation,
  isProductionTsFile,
  MAX_FILE_LINES,
} from "../check-code-principles.mjs";

function sourceWithPhysicalLines(lineCount) {
  return Array.from({ length: lineCount }, (_, index) => `// physical line ${index + 1}`).join("\n");
}

describe("code-principles physical line limit", () => {
  it("accepts 400 physical lines and rejects 401", () => {
    const atLimit = sourceWithPhysicalLines(MAX_FILE_LINES);
    const overLimit = sourceWithPhysicalLines(MAX_FILE_LINES + 1);

    assert.equal(countPhysicalLines(atLimit), 400);
    assert.equal(getOversizedFileViolation("packages/example/src/component.ts", atLimit), null);
    assert.deepEqual(getOversizedFileViolation("packages/example/src/component.ts", overLimit), {
      file: "packages/example/src/component.ts",
      lineCount: 401,
    });
  });

  it("counts a terminal newline without inventing an extra physical line", () => {
    assert.equal(countPhysicalLines(`${sourceWithPhysicalLines(400)}\n`), 400);
    assert.equal(countPhysicalLines(`${sourceWithPhysicalLines(401)}\r\n`), 401);
  });
});

describe("code-principles test suffix classification", () => {
  it("excludes spec and test suffix variants", () => {
    for (const file of [
      "component.spec.ts",
      "component.test.tsx",
      "component.spec-composition-parity.ts",
      "component.test.integration.tsx",
    ]) {
      assert.equal(isProductionTsFile(`packages/example/src/${file}`), false, file);
    }
  });

  it("keeps similar production names in scope", () => {
    assert.equal(isProductionTsFile("packages/example/src/contest.ts"), true);
    assert.equal(isProductionTsFile("packages/example/src/specification.tsx"), true);
  });
});
