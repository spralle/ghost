import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { buildConfigSchemas } from "../build-config-schemas.mjs";
import { collectConfigurationDeclarations } from "../config-declarations.mjs";

async function createRepository(packageJson) {
  const root = await mkdtemp(join(tmpdir(), "ghost-config-schema-"));
  const packageDirectory = join(root, "plugins", "fixture");
  await mkdir(packageDirectory, { recursive: true });
  await writeFile(join(packageDirectory, "package.json"), JSON.stringify(packageJson));
  return root;
}

function configuration(properties) {
  return { type: "object", properties };
}

describe("configuration declaration collection", () => {
  it("discovers current ghost.contributes.configuration metadata", async () => {
    const root = await createRepository({
      name: "ghost.fixture",
      ghost: { contributes: { configuration: configuration({ enabled: { type: "boolean" } }) } },
    });

    const declarations = await collectConfigurationDeclarations(root);

    assert.equal(declarations.length, 1);
    assert.equal(declarations[0].properties.enabled.type, "boolean");
  });

  it("supports legacy declaration locations and direct property maps", async () => {
    const root = await createRepository({
      name: "ghost.fixture",
      contributes: { configuration: { enabled: { type: "boolean" } } },
    });

    const declarations = await collectConfigurationDeclarations(root);

    assert.equal(declarations.length, 1);
    assert.equal(declarations[0].properties.enabled.type, "boolean");
  });

  it("rejects invalid public property schemas", async () => {
    const root = await createRepository({
      name: "ghost.fixture",
      ghost: { configuration: { enabled: { type: "unsupported" } } },
    });

    await assert.rejects(collectConfigurationDeclarations(root), /Invalid configuration schema/);
  });
});

describe("buildConfigSchemas", () => {
  it("generates JSON and Zod outputs while preserving x-weaver metadata", async () => {
    const root = await createRepository({
      name: "ghost.fixture",
      ghost: {
        contributes: {
          configuration: configuration({
            port: {
              type: "number",
              minimum: 1,
              maximum: 65535,
              "x-weaver": { changePolicy: "direct-allowed", reloadBehavior: "restart-required" },
            },
          }),
        },
      },
    });
    const outputDir = join(root, "generated");

    const result = await buildConfigSchemas({ repoRoot: root, outputDir });
    const json = JSON.parse(await readFile(join(outputDir, "config-schema.json"), "utf8"));
    const zod = await readFile(join(outputDir, "config-schemas.generated.ts"), "utf8");

    assert.equal(result.schemaCount, 1);
    assert.equal(json.properties["ghost.fixture.port"].minimum, 1);
    assert.equal(json.properties["ghost.fixture.port"]["x-weaver"].reloadBehavior, "restart-required");
    assert.match(zod, /ghost_fixture_port/);
  });

  it("reports duplicate composition errors", async () => {
    const root = await createRepository({
      name: "ghost.fixture",
      ghost: { configuration: configuration({ enabled: { type: "boolean" } }) },
    });
    const duplicateDirectory = join(root, "apps", "fixture");
    await mkdir(duplicateDirectory, { recursive: true });
    await writeFile(
      join(duplicateDirectory, "package.json"),
      JSON.stringify({
        name: "ghost.fixture",
        ghost: { configuration: configuration({ enabled: { type: "boolean" } }) },
      }),
    );

    const result = await buildConfigSchemas({ repoRoot: root, outputDir: join(root, "generated") });

    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0].type, "duplicate-key");
  });

  it("handles repositories without declaration directories", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghost-config-empty-"));

    const result = await buildConfigSchemas({ repoRoot: root, outputDir: join(root, "generated") });

    assert.deepEqual(result, { schemaCount: 0, viewConfigCount: 0, errors: [] });
  });
});
