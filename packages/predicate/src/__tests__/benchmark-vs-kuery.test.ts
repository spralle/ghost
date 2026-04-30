import { describe, expect, test } from "vitest";
// @ts-expect-error — kuery is CJS with no type declarations
import Kuery from "kuery";
import type { ExprNode } from "../ast.js";
import { find } from "../collection/find.js";
import { compile } from "../compile.js";
import { compileFilter } from "../filter-compiler.js";

// ---------------------------------------------------------------------------
// Document factories (deterministic, index-based)
// ---------------------------------------------------------------------------

const STATUSES = ["active", "inactive", "pending", "archived"] as const;
const ROLES = ["admin", "user", "moderator", "editor", "viewer"] as const;
const CITIES = ["NYC", "LA", "Chicago", "Houston", "Phoenix"] as const;
const STATES = ["NY", "CA", "IL", "TX", "AZ"] as const;

function makeSmall(i: number) {
  return { id: i, status: STATUSES[i % 4], score: i % 100, name: `User_${i}`, active: i % 2 === 0 };
}

function makeMedium(i: number) {
  return {
    ...makeSmall(i),
    email: `user${i}@test.com`,
    role: ROLES[i % 5],
    address: { city: CITIES[i % 5], state: STATES[i % 5], zip: `${10000 + (i % 90000)}` },
    tags: [`tag${i % 10}`, `tag${(i + 3) % 10}`],
    metadata: {
      created: `2024-01-${String(1 + (i % 28)).padStart(2, "0")}`,
      updated: `2024-06-${String(1 + (i % 28)).padStart(2, "0")}`,
      version: i % 20,
    },
  };
}

function makeLarge(i: number) {
  return {
    ...makeMedium(i),
    orders: [
      {
        id: i * 10,
        amount: (i % 500) + 10,
        items: [
          { sku: `SKU${i % 100}`, qty: (i % 5) + 1 },
          { sku: `SKU${(i + 7) % 100}`, qty: (i % 3) + 1 },
        ],
      },
      { id: i * 10 + 1, amount: (i % 300) + 5, items: [{ sku: `SKU${(i + 20) % 100}`, qty: (i % 4) + 1 }] },
    ],
    preferences: {
      notifications: { email: i % 2 === 0, sms: i % 3 === 0 },
      theme: i % 2 === 0 ? "dark" : "light",
      language: i % 3 === 0 ? "en" : "es",
    },
    history: [
      {
        action: "login",
        timestamp: `2024-06-${String(1 + (i % 28)).padStart(2, "0")}T10:00:00Z`,
        details: { ip: `192.168.${i % 256}.${(i + 1) % 256}`, userAgent: "Mozilla/5.0" },
      },
      {
        action: "purchase",
        timestamp: `2024-06-${String(1 + (i % 28)).padStart(2, "0")}T12:00:00Z`,
        details: { ip: `10.0.${i % 256}.${(i + 2) % 256}`, userAgent: "Chrome/125" },
      },
    ],
  };
}

type DocFactory = (i: number) => Record<string, unknown>;
const DOC_FACTORIES: Record<string, DocFactory> = { small: makeSmall, medium: makeMedium, large: makeLarge };
const COLLECTION_SIZES = [100, 1_000, 10_000, 100_000] as const;

function generateCollection(factory: DocFactory, size: number): Record<string, unknown>[] {
  return Array.from({ length: size }, (_, i) => factory(i));
}

// ---------------------------------------------------------------------------
// Queries (shared between both libraries)
// ---------------------------------------------------------------------------

const QUERIES: Record<string, Record<string, unknown>> = {
  "simple-eq": { status: "active" },
  "multi+cmp": { status: "active", score: { $gte: 50 } },
  $or: { $or: [{ status: "active" }, { role: "admin" }] },
  "nested-dot": { "address.city": "NYC" },
  $in: { role: { $in: ["admin", "moderator", "editor"] } },
  $regex: { name: { $regex: "^User_1" } },
  compound: {
    $and: [{ status: "active" }, { score: { $gte: 50 } }, { $or: [{ role: "admin" }, { "address.state": "NY" }] }],
  },
  "complex-compound": {
    $and: [
      {
        $or: [
          { status: "active", score: { $gte: 50 } },
          { status: "pending", role: "admin" },
          { "address.state": "NY", score: { $lt: 20 } },
          { role: { $in: ["editor", "moderator"] } },
          { "metadata.version": { $gte: 10 } },
        ],
      },
      {
        $or: [
          { "address.city": { $in: ["NYC", "LA", "Chicago"] } },
          { tags: { $in: ["tag1", "tag3", "tag5"] } },
          { email: { $regex: "^user[0-9]" } },
          { score: { $gte: 75 } },
          { role: "viewer", active: true },
        ],
      },
    ],
  },
};

const ELEMATCH_QUERY = { orders: { $elemMatch: { amount: { $gte: 100 } } } };

// ---------------------------------------------------------------------------
// Measurement helpers
// ---------------------------------------------------------------------------

interface BenchResult {
  avgMs: number;
  opsPerSec: number;
}

function bench(fn: () => void, iterations: number, warmup = 3): BenchResult {
  for (let w = 0; w < warmup; w++) fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const totalMs = performance.now() - start;
  const avgMs = totalMs / iterations;
  return { avgMs, opsPerSec: 1000 / avgMs };
}

function iterations(size: number): number {
  return size >= 10_000 ? 20 : 50;
}

function fmt(ms: number): string {
  return ms < 1 ? `${(ms * 1000).toFixed(0)}µs` : `${ms.toFixed(2)}ms`;
}

function winner(pMs: number, kMs: number): string {
  if (pMs < kMs) return `pred ${(kMs / pMs).toFixed(1)}x`;
  if (kMs < pMs) return `kuery ${(pMs / kMs).toFixed(1)}x`;
  return "tie";
}

// ---------------------------------------------------------------------------
// Table printer
// ---------------------------------------------------------------------------

type Row = [string, string, string, string];

function printTable(title: string, rows: Row[]) {
  const header: Row = ["Scenario", "predicate", "kuery", "winner"];
  const cols = [0, 1, 2, 3].map((c) => Math.max(header[c].length, ...rows.map((r) => r[c].length)));
  const sep = `┼${cols.map((w) => "─".repeat(w + 2)).join("┼")}┼`;
  const line = (r: Row) => `│${r.map((v, c) => ` ${v.padEnd(cols[c])} `).join("│")}│`;

  console.log(`\n  ${title}`);
  console.log(`  ┌${cols.map((w) => "─".repeat(w + 2)).join("┬")}┐`);
  console.log(`  ${line(header)}`);
  console.log(`  ├${sep.slice(1)}`);
  for (const r of rows) console.log(`  ${line(r)}`);
  console.log(`  └${cols.map((w) => "─".repeat(w + 2)).join("┴")}┘`);
}

// ---------------------------------------------------------------------------
// Runner: runs both libs for a given query + collection, returns row data
// ---------------------------------------------------------------------------

function runComparison(
  label: string,
  query: Record<string, unknown>,
  collection: Record<string, unknown>[],
  mode: "cold" | "hot",
): Row {
  const iters = iterations(collection.length);

  let predResult: BenchResult;
  let kueryResult: BenchResult;

  if (mode === "cold") {
    predResult = bench(() => {
      find(collection, query);
    }, iters);
    kueryResult = bench(() => {
      new Kuery(query).find(collection);
    }, iters);
  } else {
    const filter = compileFilter(query);
    predResult = bench(() => {
      collection.filter((doc) => filter(doc));
    }, iters);
    const kq = new Kuery(query);
    kueryResult = bench(() => {
      kq.find(collection);
    }, iters);
  }

  return [label, fmt(predResult.avgMs), fmt(kueryResult.avgMs), winner(predResult.avgMs, kueryResult.avgMs)];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const allRows: { cold: Row[]; hot: Row[] } = { cold: [], hot: [] };

for (const [qName, query] of Object.entries(QUERIES)) {
  describe(`query: ${qName}`, () => {
    for (const [docSize, factory] of Object.entries(DOC_FACTORIES)) {
      // Skip queries needing nested fields on small docs
      if (docSize === "small" && ["nested-dot", "$or", "compound", "complex-compound"].includes(qName)) continue;

      describe(`docs: ${docSize}`, () => {
        for (const size of COLLECTION_SIZES) {
          test(
            `${size.toLocaleString()} items — cold`,
            { timeout: 60_000 },
            () => {
              const col = generateCollection(factory, size);
              const row = runComparison(`${qName}/${docSize[0]?.toUpperCase()}/${size}`, query, col, "cold");
              allRows.cold.push(row);
              console.log(`  COLD ${row[0]}: pred=${row[1]} kuery=${row[2]} → ${row[3]}`);
            },
          );

          test(
            `${size.toLocaleString()} items — hot`,
            { timeout: 60_000 },
            () => {
              const col = generateCollection(factory, size);
              const row = runComparison(`${qName}/${docSize[0]?.toUpperCase()}/${size}`, query, col, "hot");
              allRows.hot.push(row);
              console.log(`  HOT  ${row[0]}: pred=${row[1]} kuery=${row[2]} → ${row[3]}`);
            },
          );
        }
      });
    }
  });
}

describe("query: $elemMatch", () => {
  for (const size of COLLECTION_SIZES) {
    test(
      `large/${size.toLocaleString()} items — cold`,
      { timeout: 60_000 },
      () => {
        const col = generateCollection(makeLarge, size);
        const row = runComparison(`$elemMatch/L/${size}`, ELEMATCH_QUERY, col, "cold");
        allRows.cold.push(row);
        console.log(`  COLD ${row[0]}: pred=${row[1]} kuery=${row[2]} → ${row[3]}`);
      },
    );

    test(
      `large/${size.toLocaleString()} items — hot`,
      { timeout: 60_000 },
      () => {
        const col = generateCollection(makeLarge, size);
        const row = runComparison(`$elemMatch/L/${size}`, ELEMATCH_QUERY, col, "hot");
        allRows.hot.push(row);
        console.log(`  HOT  ${row[0]}: pred=${row[1]} kuery=${row[2]} → ${row[3]}`);
      },
    );
  }
});

describe("SUMMARY", () => {
  test("cold path results", () => {
    if (allRows.cold.length > 0) printTable("Cold (compile + find)", allRows.cold);
    else console.log("  No cold results collected (run full suite)");
  });

  test("hot path results", () => {
    if (allRows.hot.length > 0) printTable("Hot (pre-compiled find)", allRows.hot);
    else console.log("  No hot results collected (run full suite)");
  });
});

describe("memory footprint", () => {
  test("runtime memory: 1000 compiled queries", () => {
    const queries = Object.values(QUERIES);

    // Measure predicate
    if (typeof globalThis.gc === "function") globalThis.gc();
    const predBefore = process.memoryUsage().heapUsed;
    const predCompiled: ExprNode[] = [];
    for (let i = 0; i < 1000; i++) {
      predCompiled.push(compile(queries[i % queries.length]!));
    }
    const predAfter = process.memoryUsage().heapUsed;
    const predBytes = predAfter - predBefore;

    // Measure kuery
    if (typeof globalThis.gc === "function") globalThis.gc();
    const kueryBefore = process.memoryUsage().heapUsed;
    const kueryCompiled: unknown[] = [];
    for (let i = 0; i < 1000; i++) {
      kueryCompiled.push(new Kuery(queries[i % queries.length]!));
    }
    const kueryAfter = process.memoryUsage().heapUsed;
    const kueryBytes = kueryAfter - kueryBefore;

    console.log(`  predicate: ~${(predBytes / 1024).toFixed(1)} KB for 1000 queries`);
    console.log(`  kuery:     ~${(kueryBytes / 1024).toFixed(1)} KB for 1000 queries`);
    console.log(`  ratio:     ${(kueryBytes / Math.max(predBytes, 1)).toFixed(1)}x`);

    // Keep references alive to prevent GC
    expect(predCompiled.length).toBe(1000);
    expect(kueryCompiled.length).toBe(1000);
  });
});
