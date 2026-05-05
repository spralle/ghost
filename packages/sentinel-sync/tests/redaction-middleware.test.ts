import { describe, it, expect } from "bun:test";
import { createRedactionHook } from "../src/redaction-middleware.js";
import type { ResourceSchema } from "@sentinel-guard/core";

function createSchema(): ResourceSchema<unknown, string> {
  return {
    name: "document",
    relations: {},
    actions: ["read"],
    dataBlocks: {
      public: { fields: ["title", "status"], sensitivity: "low" },
      private: { fields: ["content", "notes"], sensitivity: "high" },
    },
  } as unknown as ResourceSchema<unknown, string>;
}

describe("createRedactionHook", () => {
  it("redacts documents based on granted blocks", () => {
    const hook = createRedactionHook();
    const schema = createSchema();
    const docs = [
      { title: "Doc 1", status: "active", content: "secret", notes: "internal" },
    ];

    const result = hook(docs, schema, { grantedBlocks: ["public"] });

    expect(result[0]).toHaveProperty("title", "Doc 1");
    expect(result[0]).toHaveProperty("status", "active");
    expect(result[0]).not.toHaveProperty("content");
    expect(result[0]).not.toHaveProperty("notes");
  });

  it("returns empty objects when no blocks granted", () => {
    const hook = createRedactionHook();
    const schema = createSchema();
    const docs = [{ title: "Doc 1", content: "secret" }];

    const result = hook(docs, schema, { grantedBlocks: [] });

    expect(result[0]).toEqual({});
  });

  it("returns full documents when all blocks granted", () => {
    const hook = createRedactionHook();
    const schema = createSchema();
    const docs = [{ title: "Doc 1", status: "active", content: "body", notes: "n" }];

    const result = hook(docs, schema, { grantedBlocks: ["public", "private"] });

    expect(result[0]).toHaveProperty("title", "Doc 1");
    expect(result[0]).toHaveProperty("content", "body");
  });
});
