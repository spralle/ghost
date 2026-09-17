import assert from "node:assert/strict";
import test from "node:test";

// ---------------------------------------------------------------------------
// Verify utility tab infrastructure has been removed
// ---------------------------------------------------------------------------

test("utility-tabs module no longer exists", async () => {
  try {
    await import("../src/utility-tabs.ts");
    assert.fail("utility-tabs.ts should not exist after infrastructure removal");
  } catch (err) {
    assert.ok(
      err.code === "ERR_MODULE_NOT_FOUND" || err.message?.includes("Cannot find"),
      "importing utility-tabs.ts should fail with module not found",
    );
  }
});
