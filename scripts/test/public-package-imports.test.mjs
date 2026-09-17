import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const affectedRoots = ["@ghost-shell/contracts", "@ghost-shell/config-plugin-runtime", "@ghost-shell/shell"];

for (const packageRoot of affectedRoots) {
  test(`${packageRoot} public declaration entry resolves`, async () => {
    const moduleUrl = import.meta.resolve(packageRoot);
    const declarationUrl = moduleUrl.replace(/\.js$/, ".d.ts");

    assert.equal(moduleUrl.includes("/src/"), false);
    await access(fileURLToPath(declarationUrl));
  });
}

for (const packageRoot of affectedRoots.slice(0, 2)) {
  test(`${packageRoot} public ESM entry imports`, async () => {
    assert.ok(await import(packageRoot));
  });
}
