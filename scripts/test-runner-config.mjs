export const bunTestFiles = [
  "packages/sentinel-arbiter/src/__tests__/bridge.test.ts",
  "packages/sentinel-react/src/__tests__/hooks.test.tsx",
  "packages/sentinel-redemeine/tests/sentinel-plugin.test.ts",
  "packages/sentinel-roles/tests/permission-bundle.test.ts",
  "packages/sentinel-roles/tests/role-registry.test.ts",
  "packages/sentinel-roles/tests/role-resolver.test.ts",
  "packages/sentinel-store-memory/src/__tests__/memory-store.test.ts",
  "packages/sentinel-store-mongodb/tests/mongodb-store.test.ts",
  "packages/sentinel-sync/tests/batch-builder.test.ts",
  "packages/sentinel-sync/tests/invalidation.test.ts",
  "packages/sentinel-sync/tests/principal-resolver.test.ts",
  "packages/sentinel-sync/tests/query-decorator.test.ts",
  "packages/sentinel-sync/tests/redaction-middleware.test.ts",
  "packages/sentinel-sync/tests/snapshot-manager.test.ts",
  "packages/sentinel/src/__tests__/graph.test.ts",
  "packages/sentinel/src/__tests__/policy.test.ts",
  "packages/sentinel/src/__tests__/principal.test.ts",
];

export const nodeTestPatterns = ["{apps,packages,plugins,scripts}/**/*.test*.mjs"];

export const vitestTestPatterns = ["{apps,packages,plugins}/**/*.{test,spec}.{ts,tsx}"];

export const testRunnerConfig = {
  node: { patterns: nodeTestPatterns, excludedFiles: [] },
  vitest: { patterns: vitestTestPatterns, excludedFiles: bunTestFiles },
  bun: { patterns: bunTestFiles, excludedFiles: [] },
};

export const testCandidatePattern = "{apps,packages,plugins,scripts}/**/*.{test,spec,test-hooked}.{ts,tsx,mjs}";
