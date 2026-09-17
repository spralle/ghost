import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const repoRoot = resolve(import.meta.dirname, "../..");

async function readJson(relativePath) {
  return JSON.parse(await readFile(resolve(repoRoot, relativePath), "utf8"));
}

describe("TypeScript build reference graph", () => {
  it("orders config runtime between contracts and consumers without a reverse Ghost dependency", async () => {
    const rootConfig = await readJson("tsconfig.json");
    const contractsPackage = await readJson("packages/plugin-contracts/package.json");
    const runtimeConfig = await readJson("packages/config-plugin-runtime/tsconfig.json");
    const shellConfig = await readJson("packages/shell/tsconfig.json");
    const backendConfig = await readJson("apps/backend/tsconfig.json");

    assert(rootConfig.references.some((reference) => reference.path === "./packages/config-plugin-runtime"));
    assert(runtimeConfig.references.some((reference) => reference.path === "../plugin-contracts"));
    assert(shellConfig.references.some((reference) => reference.path === "../config-plugin-runtime"));
    assert(backendConfig.references.some((reference) => reference.path === "../../packages/config-plugin-runtime"));
    assert.equal(contractsPackage.dependencies["@ghost-shell/config-plugin-runtime"], undefined);
  });

  it("owns the public catalog entry type at the Weaver engine boundary", async () => {
    const source = await readFile(
      resolve(repoRoot, "packages/plugin-contracts/src/plugin-config-catalog-service.ts"),
      "utf8",
    );

    assert.match(source, /from "@weaver\/config-engine"/);
    assert.doesNotMatch(source, /from "@ghost-shell\/config-plugin-runtime"/);
  });
});
