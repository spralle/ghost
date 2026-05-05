import { describe, expect, it } from "vitest";
import type { Middleware, MiddlewareDecision } from "../contracts.js";
import {
  disposeMiddlewares,
  initMiddlewares,
  runNotifyHooksAsync,
  runNotifyHooksSync,
  runVetoHooksAsync,
  runVetoHooksSync,
} from "../middleware-runner.js";

function makeMw(id: string, overrides: Partial<Middleware> = {}): Middleware {
  return { id, ...overrides };
}

describe("middleware-runner", () => {
  describe("runVetoHooksSync", () => {
    it("returns continue for empty array", () => {
      const result = runVetoHooksSync([], "beforeAction", {});
      expect(result.action).toBe("continue");
    });

    it("executes middlewares in registration order", () => {
      const order: string[] = [];
      const mws = [
        makeMw("a", {
          beforeAction: () => {
            order.push("a");
            return { action: "continue" as const };
          },
        }),
        makeMw("b", {
          beforeAction: () => {
            order.push("b");
            return { action: "continue" as const };
          },
        }),
        makeMw("c", {
          beforeAction: () => {
            order.push("c");
            return { action: "continue" as const };
          },
        }),
      ];
      runVetoHooksSync(mws, "beforeAction", {});
      expect(order).toEqual(["a", "b", "c"]);
    });

    it("veto from first middleware short-circuits remaining", () => {
      const order: string[] = [];
      const mws = [
        makeMw("a", {
          beforeAction: () => {
            order.push("a");
            return { action: "veto" as const, reason: "nope" };
          },
        }),
        makeMw("b", {
          beforeAction: () => {
            order.push("b");
            return { action: "continue" as const };
          },
        }),
      ];
      const result = runVetoHooksSync(mws, "beforeAction", {});
      expect(result.action).toBe("veto");
      expect(order).toEqual(["a"]);
    });

    it("hook that throws is treated as veto", () => {
      const mws = [
        makeMw("thrower", {
          beforeAction: () => {
            throw new Error("boom");
          },
        }),
      ];
      const result = runVetoHooksSync(mws, "beforeAction", {});
      expect(result.action).toBe("veto");
    });
  });

  describe("runNotifyHooksSync", () => {
    it("executes all hooks in order", () => {
      const order: string[] = [];
      const mws = [
        makeMw("a", {
          afterAction: () => {
            order.push("a");
          },
        }),
        makeMw("b", {
          afterAction: () => {
            order.push("b");
          },
        }),
      ];
      runNotifyHooksSync(mws, "afterAction", {});
      expect(order).toEqual(["a", "b"]);
    });

    it("swallows errors from throwing hooks and continues", () => {
      const order: string[] = [];
      const mws = [
        makeMw("a", {
          afterAction: () => {
            throw new Error("fail");
          },
        }),
        makeMw("b", {
          afterAction: () => {
            order.push("b");
          },
        }),
      ];
      runNotifyHooksSync(mws, "afterAction", {});
      expect(order).toEqual(["b"]);
    });
  });

  describe("runVetoHooksAsync", () => {
    it("awaits async hooks", async () => {
      const mws = [
        makeMw("async", {
          beforeAction: () => Promise.resolve({ action: "continue" as const }),
        }),
      ];
      const result = await runVetoHooksAsync(mws, "beforeAction", {});
      expect(result.action).toBe("continue");
    });

    it("async veto short-circuits", async () => {
      const order: string[] = [];
      const mws = [
        makeMw("a", {
          beforeAction: () => Promise.resolve({ action: "veto" as const, reason: "no" }),
        }),
        makeMw("b", {
          beforeAction: () => {
            order.push("b");
            return { action: "continue" as const };
          },
        }),
      ];
      const result = await runVetoHooksAsync(mws, "beforeAction", {});
      expect(result.action).toBe("veto");
      expect(order).toEqual([]);
    });

    it("timeout triggers veto for veto hooks", async () => {
      const mws = [
        makeMw("slow", {
          beforeAction: () =>
            new Promise<MiddlewareDecision>(() => {
              // never resolves
            }),
        }),
      ];
      const result = await runVetoHooksAsync(mws, "beforeAction", {}, 10);
      expect(result.action).toBe("veto");
      expect((result as { reason: string }).reason).toContain("timed out");
    });

    it("mixed sync/async middlewares work together", async () => {
      const order: string[] = [];
      const mws = [
        makeMw("sync", {
          beforeAction: () => {
            order.push("sync");
            return { action: "continue" as const };
          },
        }),
        makeMw("async", {
          beforeAction: async () => {
            order.push("async");
            return { action: "continue" as const };
          },
        }),
      ];
      const result = await runVetoHooksAsync(mws, "beforeAction", {});
      expect(result.action).toBe("continue");
      expect(order).toEqual(["sync", "async"]);
    });
  });

  describe("runNotifyHooksAsync", () => {
    it("awaits async hooks", async () => {
      const order: string[] = [];
      const mws = [
        makeMw("a", {
          afterAction: async () => {
            order.push("a");
          },
        }),
      ];
      await runNotifyHooksAsync(mws, "afterAction", {});
      expect(order).toEqual(["a"]);
    });

    it("timeout is swallowed for notify hooks", async () => {
      const order: string[] = [];
      const mws = [
        makeMw("slow", {
          afterAction: () => new Promise<void>(() => {}) as unknown as undefined,
        }),
        makeMw("fast", {
          afterAction: () => {
            order.push("fast");
          },
        }),
      ];
      await runNotifyHooksAsync(mws, "afterAction", {}, 10);
      expect(order).toEqual(["fast"]);
    });
  });

  describe("initMiddlewares", () => {
    it("calls onInit on all middlewares in order", () => {
      const order: string[] = [];
      const mws = [
        makeMw("a", {
          onInit: () => {
            order.push("a");
          },
        }),
        makeMw("b", {
          onInit: () => {
            order.push("b");
          },
        }),
      ];
      initMiddlewares(mws, { state: {} as never });
      expect(order).toEqual(["a", "b"]);
    });

    it("swallows init errors", () => {
      const order: string[] = [];
      const mws = [
        makeMw("a", {
          onInit: () => {
            throw new Error("fail");
          },
        }),
        makeMw("b", {
          onInit: () => {
            order.push("b");
          },
        }),
      ];
      initMiddlewares(mws, { state: {} as never });
      expect(order).toEqual(["b"]);
    });
  });

  describe("disposeMiddlewares", () => {
    it("calls onDispose on all middlewares", () => {
      const order: string[] = [];
      const mws = [
        makeMw("a", {
          onDispose: () => {
            order.push("a");
          },
        }),
        makeMw("b", {
          onDispose: () => {
            order.push("b");
          },
        }),
      ];
      disposeMiddlewares(mws);
      expect(order).toEqual(["a", "b"]);
    });

    it("swallows dispose errors", () => {
      const order: string[] = [];
      const mws = [
        makeMw("a", {
          onDispose: () => {
            throw new Error("fail");
          },
        }),
        makeMw("b", {
          onDispose: () => {
            order.push("b");
          },
        }),
      ];
      disposeMiddlewares(mws);
      expect(order).toEqual(["b"]);
    });
  });

  describe("empty middleware array", () => {
    it("all runners handle empty arrays", async () => {
      expect(runVetoHooksSync([], "beforeAction", {}).action).toBe("continue");
      runNotifyHooksSync([], "afterAction", {});
      expect((await runVetoHooksAsync([], "beforeAction", {})).action).toBe("continue");
      await runNotifyHooksAsync([], "afterAction", {});
      initMiddlewares([], { state: {} as never });
      disposeMiddlewares([]);
    });
  });
});
