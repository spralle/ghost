/**
 * Kuery compatibility test suite.
 * Ports all 62 tests from kuery's test suite (kuery.js: 52, skip.js: 7, compiler.js: 3).
 */
import { describe, expect, it } from "vitest";
import { compileFilter } from "../filter-compiler.js";
import { Predicate } from "../predicate.js";
import { collection, collectionWithNull, skipCollection } from "./fixtures/kuery-data.js";

describe("kuery compatibility", () => {
  it("should return 0 for empty collection", () => {
    expect(new Predicate({}).find([]).length).toBe(0);
  });

  it("should return all elements for empty query", () => {
    expect(new Predicate({}).find(collection).length).toBe(5);
  });

  it("should return correct element for property eq query", () => {
    expect(new Predicate({ id: 2 }).findOne(collection).name).toBe("Sven");
  });

  it("should return correct element for property $eq query", () => {
    expect(new Predicate({ name: { $eq: "Emil" } }).findOne(collection).name).toBe("Emil");
  });

  it("should return correct element for property not eq query", () => {
    expect(new Predicate({ id: { $ne: 2 } }).find(collection).length).toBe(4);
  });

  it("should return correct elements for property in query", () => {
    expect(new Predicate({ id: { $in: [1, 2] } }).find(collection).length).toBe(2);
  });

  it("should return correct elements for property in $nin query", () => {
    expect(new Predicate({ id: { $nin: [1, 2] } }).find(collection).length).toBe(3);
  });

  it("should return all elements for property with empty $nin query", () => {
    expect(new Predicate({ id: { $nin: [] } }).find(collection).length).toBe(5);
  });

  it("should return correct elements for property with path eq query", () => {
    expect(new Predicate({ "address.street": "Bellmansgatan" }).find(collection).length).toBe(1);
  });

  it("should return correct elements for property with path ne query", () => {
    expect(new Predicate({ "address.street": { $ne: "Bellmansgatan" } }).find(collection).length).toBe(4);
  });

  it("should return correct elements for property with path in query", () => {
    expect(new Predicate({ name: { $in: ["Andreas", "Emil"] } }).find(collection).length).toBe(2);
  });

  it("should return correct elements for property in with strings query", () => {
    expect(new Predicate({ name: { $in: ["Andreas", "Emil"] } }).find(collection).length).toBe(2);
  });

  it("should return correct elements for property $nin with strings query", () => {
    expect(new Predicate({ name: { $nin: ["Andreas", "Emil"] } }).find(collection).length).toBe(3);
  });

  it("should return correct elements for composite query (in + eq)", () => {
    expect(new Predicate({ name: { $in: ["Andreas", "Emil"] }, id: 1 }).find(collection).length).toBe(1);
  });

  it("should return correct elements for composite query (nin + eq)", () => {
    expect(new Predicate({ name: { $nin: ["Andreas", "Emil"] }, id: 2 }).find(collection).length).toBe(1);
  });

  it("should return correct elements for composite query (nin + eq, no match)", () => {
    expect(new Predicate({ name: { $nin: ["Andreas", "Emil"] }, id: 1 }).find(collection).length).toBe(0);
  });

  it("should match when object is null and nested property is checked with $nin", () => {
    expect(
      new Predicate({
        name: "KE",
        "girlfriends.wife": { $nin: ["Shin Hye-sun"] },
      }).find(collectionWithNull).length,
    ).toBe(1);
  });

  it("should match when object is null and nested property is checked with $ne", () => {
    expect(
      new Predicate({
        name: "KE",
        "girlfriends.wife": { $ne: "Shin Hye-sun" },
      }).find(collectionWithNull).length,
    ).toBe(1);
  });

  it("should not match when object is null and nested property is checked with $in", () => {
    expect(
      new Predicate({
        name: "KE",
        "girlfriends.wife": { $in: ["Shin Hye-sun"] },
      }).find(collectionWithNull).length,
    ).toBe(0);
  });

  it("should not match when object is null and nested property is checked with $eq", () => {
    expect(
      new Predicate({
        name: "KE",
        "girlfriends.wife": { $eq: "Shin Hye-sun" },
      }).find(collectionWithNull).length,
    ).toBe(0);
  });

  it("should return correct elements for regex string query", () => {
    expect(new Predicate({ name: { $regex: "Andr.*", $options: "i" } }).find(collection).length).toBe(1);
  });

  it("should return correct elements for regex native query", () => {
    expect(new Predicate({ name: { $regex: /andr.*/, $options: "i" } }).find(collection).length).toBe(1);
  });

  it("should return correct elements for inline regex query", () => {
    expect(new Predicate({ name: /andr.*/i }).find(collection).length).toBe(1);
  });

  it("should return correct elements for negating $elemMatch query", () => {
    expect(
      new Predicate({
        girlfriends: { $not: { $elemMatch: { hotness: 200 } } },
      }).find(collection).length,
    ).toBe(4);
  });

  it("should return correct elements for negating $elemMatch regex query", () => {
    expect(
      new Predicate({
        girlfriends: { $not: { $elemMatch: { name: /nny$/i } } },
      }).find(collection).length,
    ).toBe(4);
  });

  it("should return correct elements for $or query", () => {
    expect(
      new Predicate({
        $or: [{ name: /andr.*/i }, { name: /emil.*/i }],
      }).find(collection).length,
    ).toBe(2);
  });

  it("should return correct elements for $or query when both sides return same element", () => {
    expect(
      new Predicate({
        $or: [{ name: /andr.*/i }, { name: /andr.*/i }],
      }).find(collection).length,
    ).toBe(1);
  });

  it("should return correct elements for property with path eq query with arrays", () => {
    expect(new Predicate({ "girlfriends.name": "eve" }).find(collection).length).toBe(1);
  });

  it("should return correct element for property gte query", () => {
    expect(new Predicate({ id: { $gte: 2 } }).find(collection).length).toBe(4);
  });

  it("should return correct element for property lte query", () => {
    expect(new Predicate({ id: { $lte: 2 } }).find(collection).length).toBe(2);
  });

  it("should return correct element for property gt query", () => {
    expect(new Predicate({ id: { $gt: 2 } }).find(collection).length).toBe(3);
  });

  it("should return correct element for property lt query", () => {
    expect(new Predicate({ id: { $lt: 2 } }).find(collection).length).toBe(1);
  });

  it("should return correct element for property lte date query", () => {
    expect(new Predicate({ born: { $lte: new Date("1981-01-01") } }).find(collection).length).toBe(1);
  });

  it("should return correct element for property gte date query", () => {
    expect(new Predicate({ born: { $gte: new Date("1981-01-01") } }).find(collection).length).toBe(4);
  });

  it("should return correct element for property gte/lte date query", () => {
    expect(
      new Predicate({
        born: { $gte: new Date("1981-01-01"), $lte: new Date("1990-01-01") },
      }).find(collection).length,
    ).toBe(3);
  });

  it("should return no elements for single elemMatch query with no match", () => {
    expect(
      new Predicate({
        girlfriends: { $elemMatch: { hotness: 222 } },
      }).find(collection).length,
    ).toBe(0);
  });

  it("should return correct element for single elemMatch query", () => {
    expect(
      new Predicate({
        girlfriends: { $elemMatch: { hotness: 10 } },
      }).find(collection).length,
    ).toBe(1);
  });

  it("should not return element when using $elemMatch on an object property", () => {
    expect(
      new Predicate({
        "bikes.bike": { $elemMatch: { brand: "trek" } },
      }).find(collection).length,
    ).toBe(0);
  });

  it("should return correct element when using $elemMatch on a nested array property", () => {
    expect(
      new Predicate({
        "bikes.bike.wheels": { $elemMatch: { position: "front" } },
      }).find(collection).length,
    ).toBe(1);
  });

  it("should return correct element when using elemMatch on nested optional array property", () => {
    expect(
      new Predicate({
        id: 4,
        "parts.parts": { $elemMatch: { name: { $eq: "part2.sub1" } } },
      }).find(collection).length,
    ).toBe(1);
  });

  it("should return correct element when using $elemMatch on nested array with differing property types", () => {
    expect(
      new Predicate({
        id: 5,
        "parts.parts": { $elemMatch: { name: { $eq: "part2.sub1" } } },
      }).find(collection).length,
    ).toBe(1);
  });

  it("should return correct element when using $elemMatch on nested array where one type is empty string", () => {
    expect(
      new Predicate({
        id: 3,
        "parts.parts": { $elemMatch: { name: { $eq: "part2.sub1" } } },
      }).find(collection).length,
    ).toBe(1);
  });

  it("should return correct element when using $elemMatch with multiple conditions on a nested array property", () => {
    expect(
      new Predicate({
        "bikes.bike.wheels": {
          $elemMatch: { position: "front", type: "carbon" },
        },
      }).find(collection).length,
    ).toBe(1);
  });

  it("should not return any element when elemMatch does not match on the same item in the array", () => {
    expect(
      new Predicate({
        "bikes.bike.wheels": {
          $elemMatch: { position: "back", type: "carbon" },
        },
      }).find(collection).length,
    ).toBe(0);
  });

  it("should not return any element when $elemMatch is not matching on nested array property", () => {
    expect(
      new Predicate({
        "bikes.bike.wheels": { $elemMatch: { position: "middle" } },
      }).find(collection).length,
    ).toBe(0);
  });

  it("should return correct element for multipart elemMatch query", () => {
    expect(
      new Predicate({
        girlfriends: { $elemMatch: { hotness: 10, name: "fanny" } },
      }).find(collection).length,
    ).toBe(1);
  });

  it("should return correct element for multipart elemMatch query asserting with $eq and $ne", () => {
    const col = new Predicate({
      girlfriends: {
        $elemMatch: { hotness: { $eq: 10 }, name: { $ne: "eve" } },
      },
    }).find(collection);
    expect(col.length).toBe(1);
    expect(col[0]?.name).toBe("Emil");
  });

  it("should return no element for multipart elemMatch query matching different array elements", () => {
    expect(
      new Predicate({
        girlfriends: { $elemMatch: { hotness: 10, name: "eve" } },
      }).find(collection).length,
    ).toBe(0);
  });

  it("should return correct elements for double nested array elemMatch query", () => {
    expect(
      new Predicate({
        "girlfriends.boyfriends": {
          $elemMatch: { id: 2, name: "Sven" },
        },
      }).find(collection).length,
    ).toBe(1);
  });

  it("should return correct elements for triple nested array elemMatch query", () => {
    expect(
      new Predicate({
        "girlfriends.boyfriends.girlfriends": {
          $elemMatch: { hotness: 10, name: "fanny" },
        },
      }).find(collection).length,
    ).toBe(1);
  });

  it("should return correct elements for negated triple nested array elemMatch query", () => {
    expect(
      new Predicate({
        "girlfriends.boyfriends.girlfriends": {
          $not: { $elemMatch: { hotness: 10, name: "fanny" } },
        },
      }).find(collection).length,
    ).toBe(4);
  });

  it("should return correct elements for property with path $regexp with arrays", () => {
    expect(
      new Predicate({
        "girlfriends.name": { $regex: "ev.*", $options: "i" },
      }).find(collection).length,
    ).toBe(1);
  });

  it("should return elements where given element exists is true", () => {
    expect(new Predicate({ address: { $exists: true } }).find(collection).length).toBe(2);
  });

  it("should return elements where given element exists is false", () => {
    // NOTE: kuery checks truthiness (!!v), so Andreas (no girlfriends key) returns 1.
    expect(new Predicate({ girlfriends: { $exists: false } }).find(collection).length).toBe(1);
  });

  it("should return elements where given element exists deeply", () => {
    expect(new Predicate({ "girlfriends.wife": { $exists: true } }).find(collection).length).toBe(2);
  });

  it("should return elements where given element does not exists deeply", () => {
    expect(new Predicate({ "address.zipcode": { $exists: false } }).find(collection).length).toBe(5);
  });

  it("should return elements when query for boolean", () => {
    expect(new Predicate({ isActive: true }).find(collection).length).toBe(2);
  });

  it("$or should do implicit and on subqueries", () => {
    expect(
      new Predicate({
        $or: [{ "girlfriends.name": "Hanna", "girlfriends.hotness": 10 }, { "girlfriends.hotness": 1000 }],
      }).find(collection).length,
    ).toBe(1);
  });
});

describe("kuery compatibility — skip/limit/sort", () => {
  it("should skip 2 documents", () => {
    const r = new Predicate({}).skip(2).find(skipCollection);
    expect(r.length).toBe(2);
    expect(r[0]?.id).toBe(3);
  });

  it("should skip 2 documents with query", () => {
    const r = new Predicate({ id: { $gt: 1 } }).skip(2).find(skipCollection);
    expect(r.length).toBe(1);
    expect(r[0]?.id).toBe(4);
  });

  it("should limit 2 documents", () => {
    const r = new Predicate({}).limit(2).find(skipCollection);
    expect(r.length).toBe(2);
    expect(r[0]?.id).toBe(1);
  });

  it("should limit 2 documents with query", () => {
    const r = new Predicate({ id: { $gt: 1 } }).limit(2).find(skipCollection);
    expect(r.length).toBe(2);
    expect(r[0]?.id).toBe(2);
  });

  it("should limit 2, skip 1 documents with query", () => {
    const r = new Predicate({ id: { $gt: 1 } }).limit(2).skip(1).find(skipCollection);
    expect(r.length).toBe(2);
    expect(r[0]?.id).toBe(3);
  });

  it("should sort on one property", () => {
    const r = new Predicate({}).sort({ born: 1 }).find(skipCollection);
    expect(r.length).toBe(skipCollection.length);
    expect(r[0]?.born).toBe(skipCollection[0]?.born);
    expect(r[1]?.born).toBe(skipCollection[3]?.born);
  });

  it("should sort and skip", () => {
    const r = new Predicate({}).sort({ born: -1 }).skip(1).find(skipCollection);
    expect(r[0]?.name).toBe("Sven");
  });
});

describe("kuery compatibility — compiler", () => {
  it("compile ne null query", () => {
    expect(() => compileFilter({ attachmentId: { $ne: null } })).not.toThrow();
  });

  it("compile eq query via compileFilter", () => {
    const fn = compileFilter({ age: 10 });
    expect(fn({ age: 10 })).toBe(true);
  });

  it("compile $or sub-query", () => {
    const fn = compileFilter({ $or: [{ age: 10 }] });
    expect(fn({ age: 10 })).toBe(true);
  });
});
