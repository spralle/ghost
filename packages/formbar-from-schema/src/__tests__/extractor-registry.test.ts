import { beforeEach, describe, expect, test } from "vitest";
import {
  clearExtractorRegistry,
  createValidationOnlyResult,
  findExtractor,
  ingestSchema,
  registerExtractor,
  type SchemaExtractor,
  type SchemaFieldInfo,
  type StandardSchemaV1,
} from "@ghost-shell/schema-core";

function makeStandardSchema(vendor: string): StandardSchemaV1 {
  return {
    "~standard": {
      version: 1,
      vendor,
      validate: (value: unknown) => ({ value: value as never }),
    },
  };
}

describe("extractor-registry", () => {
  beforeEach(() => {
    clearExtractorRegistry();
  });

  test("findExtractor returns undefined when registry is empty", () => {
    expect(findExtractor({})).toBeUndefined();
  });

  test("registerExtractor adds and findExtractor locates it", () => {
    const extractor: SchemaExtractor = {
      vendor: "valibot",
      canExtract: (s) => typeof s === "object" && s !== null && "~standard" in s,
      extract: () => [{ path: "name", type: "string", required: true }],
    };
    registerExtractor(extractor);
    expect(findExtractor(makeStandardSchema("valibot"))).toBe(extractor);
  });

  test("findExtractor returns first matching extractor", () => {
    const first: SchemaExtractor = {
      vendor: "a",
      canExtract: () => true,
      extract: () => [],
    };
    const second: SchemaExtractor = {
      vendor: "b",
      canExtract: () => true,
      extract: () => [],
    };
    registerExtractor(first);
    registerExtractor(second);
    expect(findExtractor({})).toBe(first);
  });

  test("clearExtractorRegistry removes all extractors", () => {
    registerExtractor({ vendor: "x", canExtract: () => true, extract: () => [] });
    clearExtractorRegistry();
    expect(findExtractor({})).toBeUndefined();
  });

  test("createValidationOnlyResult returns empty fields with metadata", () => {
    const schema = makeStandardSchema("arktype");
    const result = createValidationOnlyResult(schema);
    expect(result.fields).toEqual([]);
    expect(result.metadata).toEqual({ vendor: "arktype", validationOnly: true });
  });
});

describe("ingestSchema with extractor registry", () => {
  beforeEach(() => {
    clearExtractorRegistry();
  });

  test("uses registered extractor for non-Zod Standard Schema", () => {
    const fields: readonly SchemaFieldInfo[] = [{ path: "email", type: "string", required: true }];
    registerExtractor({
      vendor: "valibot",
      canExtract: (s) =>
        typeof s === "object" &&
        s !== null &&
        "~standard" in s &&
        (s as StandardSchemaV1)["~standard"].vendor === "valibot",
      extract: () => fields,
    });

    const schema = makeStandardSchema("valibot");
    const result = ingestSchema(schema);
    expect(result.fields).toEqual(fields);
    expect(result.metadata).toEqual({ vendor: "valibot" });
  });

  test("falls back to validation-only mode when no extractor matches", () => {
    const schema = makeStandardSchema("arktype");
    const result = ingestSchema(schema);
    expect(result.fields).toEqual([]);
    expect(result.metadata).toEqual({ vendor: "arktype", validationOnly: true });
  });
});
