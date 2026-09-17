import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

test("intent execution boundary activates plugin with intent trigger", async () => {
  const sourcePath = resolve(process.cwd(), "packages/shell/src/shell-runtime/runtime-event-handlers.ts");
  const source = await readFile(sourcePath, "utf8");

  const start = source.indexOf("async function executeResolvedAction(");
  const end = source.indexOf("return {", start);
  assert.ok(start >= 0 && end > start, "executeResolvedAction function should exist");

  const block = source.slice(start, end);
  assert.match(
    block,
    /bindings\.activatePluginForBoundary\(\{[\s\S]*?triggerType:\s*"intent"[\s\S]*?\}\)/,
    "intent execution should call activation boundary with triggerType 'intent'",
  );
  assert.match(
    block,
    /const triggerId = intent\?\.type \?\? match\.intentType;/,
    "intent execution should derive trigger id from intent type",
  );
});

test("keyboard handlers resolve and dispatch through keybinding service", async () => {
  const keyboardPath = resolve(process.cwd(), "packages/shell/src/shell-runtime/keyboard-handlers.ts");
  const dispatcherPath = resolve(process.cwd(), "packages/shell/src/shell-runtime/keyboard-action-dispatcher.ts");
  const keyboardSource = await readFile(keyboardPath, "utf8");
  const dispatcherSource = await readFile(dispatcherPath, "utf8");

  assert.match(
    keyboardSource,
    /const resolution = keybindingService\.resolveSequence\(chords, context\);/,
    "keybindings should resolve through keybinding service",
  );
  assert.match(
    dispatcherSource,
    /const result = await keybindingService\.dispatchSequence\(chords, context\);/,
    "keybinding dispatch should route through keybinding service",
  );
});
