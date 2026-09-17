import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { bootstrapBackendConfig, logConfigBootstrapSummary } from "../src/config-bootstrap.js";

/** Create a temporary config directory with seed data for testing. */
async function createTestConfigDir() {
  const dir = await mkdtemp(join(tmpdir(), "config-bootstrap-test-"));
  await writeFile(
    join(dir, "core.json"),
    JSON.stringify({
      "ghost.shell.display.dateFormat": "YYYY-MM-DD",
      "ghost.backend.port": 8787,
    }),
  );
  await writeFile(
    join(dir, "app.json"),
    JSON.stringify({
      "ghost.backend.corsOrigin": "http://localhost:5173",
    }),
  );
  await mkdir(join(dir, "tenants", "demo"), { recursive: true });
  await writeFile(
    join(dir, "tenants", "demo", "tenant.json"),
    JSON.stringify({
      "ghost.shell.display.dateFormat": "DD/MM/YYYY",
    }),
  );
  return dir;
}

// --- bootstrapBackendConfig tests ---

test("bootstrap with valid config directory returns configService and serviceConfig", async () => {
  const dir = await createTestConfigDir();
  try {
    const result = await bootstrapBackendConfig({ configDir: dir });

    assert.ok(result.configService, "Should return configService");
    assert.ok(result.serviceConfig, "Should return serviceConfig");

    // Verify config was loaded: tenant override wins over core
    const dateFormat = result.configService.get("ghost.shell.display.dateFormat");
    assert.equal(dateFormat, "DD/MM/YYYY");

    // Verify service config namespace resolution
    const port = result.serviceConfig.get("port");
    assert.equal(port, 8787);

    const corsOrigin = result.serviceConfig.get("corsOrigin");
    assert.equal(corsOrigin, "http://localhost:5173");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("bootstrap with missing config directory does not throw", async () => {
  const dir = join(tmpdir(), `config-bootstrap-nonexistent-${Date.now()}`);
  // dir does not exist — FileSystemStorageProvider handles missing files gracefully
  const result = await bootstrapBackendConfig({ configDir: dir });

  assert.ok(result.configService, "Should return configService even with missing dir");
  assert.ok(result.serviceConfig, "Should return serviceConfig even with missing dir");

  // All values should be undefined since no files exist
  const port = result.serviceConfig.get("port");
  assert.equal(port, undefined);
});

test("bootstrap with environment overlay merges environment-specific config", async () => {
  const dir = await createTestConfigDir();
  try {
    // Create an environment overlay file
    await writeFile(
      join(dir, "app.staging.json"),
      JSON.stringify({
        "ghost.backend.corsOrigin": "https://staging.example.com",
        "ghost.backend.logLevel": "debug",
      }),
    );

    const result = await bootstrapBackendConfig({
      configDir: dir,
      environment: "staging",
    });

    // Environment overlay should override base app config
    const corsOrigin = result.serviceConfig.get("corsOrigin");
    assert.equal(corsOrigin, "https://staging.example.com");

    // Environment-only key should be present
    const logLevel = result.configService.get("ghost.backend.logLevel");
    assert.equal(logLevel, "debug");

    // Core values should still be present
    const port = result.serviceConfig.get("port");
    assert.equal(port, 8787);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("logConfigBootstrapSummary does not throw", () => {
  // Capture console.log — just verify it doesn't throw
  assert.doesNotThrow(() => {
    logConfigBootstrapSummary("/some/dir", undefined, "demo");
  });
  assert.doesNotThrow(() => {
    logConfigBootstrapSummary("/some/dir", "staging", "acme");
  });
});
