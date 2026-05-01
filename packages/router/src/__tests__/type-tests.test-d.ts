import { expectTypeOf, test } from "vitest";
import { z } from "zod";

import { createActionToken, createIntentToken, createViewToken, createContextToken } from "@ghost-shell/contracts";

import type { NavigationTarget } from "../core/types.js";
import type { NavigationGuardResult } from "../core/guard-types.js";
import { routeTarget, intentTarget, viewTarget } from "../core/typed-targets.js";

test("ActionToken phantom carries inferred args type", () => {
  const token = createActionToken("test.action", z.object({ id: z.string() }));
  expectTypeOf(token.__args).toEqualTypeOf<{ id: string }>();
});

test("ActionToken phantom carries result type", () => {
  const token = createActionToken<z.ZodObject<{ id: z.ZodString }>, number>("test.action", z.object({ id: z.string() }));
  expectTypeOf(token.__result).toEqualTypeOf<number>();
});

test("IntentToken phantom carries facts type", () => {
  const token = createIntentToken("test.intent", z.object({ entityId: z.string() }));
  expectTypeOf(token.__facts).toEqualTypeOf<{ entityId: string }>();
});

test("ViewToken phantom carries args type", () => {
  const token = createViewToken("test.view", z.object({ viewId: z.string() }));
  expectTypeOf(token.__args).toEqualTypeOf<{ viewId: string }>();
});

test("ContextToken phantom carries value type", () => {
  const token = createContextToken<{ name: string }>("test.ctx");
  expectTypeOf(token.__type).toEqualTypeOf<{ name: string }>();
});

test("routeTarget returns NavigationTarget-compatible value with typed params", () => {
  const target = routeTarget("vessel.detail", { vesselId: "v123" });
  expectTypeOf(target).toMatchTypeOf<NavigationTarget>();
  expectTypeOf(target.params).toEqualTypeOf<Readonly<{ vesselId: string }>>();
});

test("intentTarget enforces facts type from token schema", () => {
  const token = createIntentToken("open.entity", z.object({ entityId: z.string() }));
  const target = intentTarget(token, { entityId: "e1" });
  expectTypeOf(target).toMatchTypeOf<NavigationTarget>();
});

test("viewTarget enforces args type from token schema", () => {
  const token = createViewToken("detail.view", z.object({ id: z.string() }));
  const target = viewTarget(token, { id: "v1" });
  expectTypeOf(target).toMatchTypeOf<NavigationTarget>();
});

test("NavigationGuardResult is a proper discriminated union", () => {
  const allowed: NavigationGuardResult = { allow: true };
  const blocked: NavigationGuardResult = { allow: false, reason: "unauthorized" };
  expectTypeOf(allowed).toMatchTypeOf<NavigationGuardResult>();
  expectTypeOf(blocked).toMatchTypeOf<NavigationGuardResult>();
});
