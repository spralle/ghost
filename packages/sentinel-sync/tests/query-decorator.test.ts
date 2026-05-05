import { describe, it, expect } from "bun:test";
import { createQueryDecoratorFactory } from "../src/query-decorator.js";
import type { ResourceSchema } from "@sentinel-guard/core";

function createSchema(name: string): ResourceSchema<unknown, string> {
  return {
    name,
    relations: {
      viewer: { from: "members", $match: {}, $project: "party" },
    },
    actions: ["read", "write"],
    dataBlocks: {},
  } as unknown as ResourceSchema<unknown, string>;
}

describe("createQueryDecoratorFactory", () => {
  it("passes through unmapped collections", () => {
    const factory = createQueryDecoratorFactory({
      collectionSchemaMap: {},
    });
    const decorator = factory(["party-1"]);

    let result: object | undefined;
    decorator("unknown_collection", { foo: 1 }, (q) => { result = q; });

    expect(result).toEqual({ foo: 1 });
  });

  it("merges permission filter for mapped collections", () => {
    const schema = createSchema("documents");
    const factory = createQueryDecoratorFactory({
      collectionSchemaMap: { documents: schema },
    });
    const decorator = factory(["party-1", "party-2"]);

    let result: object | undefined;
    decorator("documents", { status: "active" }, (q) => { result = q; });

    expect(result).toHaveProperty("$and");
    const andArray = (result as { $and: object[] }).$and;
    expect(andArray[0]).toEqual({ status: "active" });
    // Second element is the permission filter from filterQuery
    expect(andArray[1]).toBeDefined();
  });

  it("uses relation overrides when specified", () => {
    const schema = {
      name: "tasks",
      relations: {
        assignee: "assignedTo",
      },
      actions: ["read"],
      dataBlocks: {},
    } as unknown as ResourceSchema<unknown, string>;

    const factory = createQueryDecoratorFactory({
      collectionSchemaMap: { tasks: schema },
      relationOverrides: { tasks: "assignee" },
    });
    const decorator = factory(["party-1"]);

    let result: object | undefined;
    decorator("tasks", {}, (q) => { result = q; });

    expect(result).toHaveProperty("$and");
  });
});
