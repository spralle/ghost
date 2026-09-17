// @vitest-environment happy-dom

import type { PluginLayerSurfaceContribution } from "@ghost-shell/contracts";
import { createFocusGrabManager, createKeyboardExclusiveManager, LayerRegistry } from "@ghost-shell/layer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createShellRuntime } from "../app/runtime.js";
import type { ShellFederationRuntime } from "../federation-runtime.js";
import {
  finishSurfaceMount,
  type ReconcilerContext,
  reconcileLayerContainer,
  type SurfaceMountCompletionContext,
} from "./surface-reconciler.js";

const PLUGIN_ID = "plugin";
const SURFACE_KEY = `${PLUGIN_ID}--notice`;
const surface: PluginLayerSurfaceContribution = {
  id: "notice",
  component: "notice-component",
  layer: "notification",
  anchor: 1,
};

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T | PromiseLike<T>) => void;
}

interface FederationFixture {
  readonly container: HTMLDivElement;
  readonly context: ReconcilerContext;
  readonly onSurfaceMounted: ReturnType<typeof vi.fn>;
  readonly onSurfaceMountError: ReturnType<typeof vi.fn>;
  readonly runtime: ReturnType<typeof createShellRuntime>;
}

function createDeferred<T>(): Deferred<T> {
  let resolve: Deferred<T>["resolve"] = () => {
    throw new Error("Deferred promise was not initialized");
  };
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function createSnapshotMap(): ReconcilerContext["pluginSnapshotMap"] {
  return new Map([
    [
      PLUGIN_ID,
      {
        id: PLUGIN_ID,
        enabled: true,
        loadStrategy: "federation",
        descriptor: {
          id: PLUGIN_ID,
          version: "1.0.0",
          entry: "https://plugins.example/remote.js",
          compatibility: { shell: "*", pluginContract: "*" },
        },
        contract: null,
        failure: null,
        lifecycle: {
          state: "active",
          lastTransitionAt: "2026-09-17T00:00:00.000Z",
          lastTrigger: null,
        },
      },
    ],
  ]);
}

function createFederationRuntime(loadRemoteModule: ShellFederationRuntime["loadRemoteModule"]): ShellFederationRuntime {
  return {
    registerRemote: vi.fn(),
    loadRemoteModule,
    loadPluginContract: async () => undefined,
    loadPluginComponents: async () => undefined,
    loadPluginServices: async () => undefined,
  };
}

function createFederationFixture(loadRemoteModule: ShellFederationRuntime["loadRemoteModule"]): FederationFixture {
  const layerRegistry = new LayerRegistry();
  layerRegistry.registerBuiltinLayers();
  const onSurfaceMounted = vi.fn();
  const onSurfaceMountError = vi.fn();
  const context: ReconcilerContext = {
    mounted: new Map(),
    dismissedSurfaces: new Set(),
    registeredRemoteIds: new Set(),
    builtInSurfaceMounts: new Map(),
    layerRegistry,
    federationRuntime: createFederationRuntime(loadRemoteModule),
    focusGrabManager: createFocusGrabManager(createKeyboardExclusiveManager()),
    generation: 1,
    pluginSnapshotMap: createSnapshotMap(),
    cleanupSurfaceBehaviors: vi.fn(),
    maybeActivateSurfaceBehaviors: vi.fn(),
    onSurfaceMounted,
    onSurfaceMountError,
    onSurfaceEntering: vi.fn(),
  };
  return {
    container: document.createElement("div"),
    context,
    onSurfaceMounted,
    onSurfaceMountError,
    runtime: createShellRuntime({ windowId: "surface-reconciler-test" }),
  };
}

function reconcileFixture(fixture: FederationFixture, generation = fixture.context.generation): Promise<void> {
  return reconcileLayerContainer(
    fixture.context,
    fixture.container,
    [{ pluginId: PLUGIN_ID, surface }],
    fixture.runtime,
    generation,
  );
}

function createCompletionContext(generation: number): SurfaceMountCompletionContext {
  return {
    generation,
    mounted: new Map(),
    maybeActivateSurfaceBehaviors: vi.fn(),
    onSurfaceMounted: vi.fn(),
    onSurfaceEntering: vi.fn(),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("finishSurfaceMount", () => {
  it("cleans up stale asynchronous mounts without publishing lifecycle events", () => {
    const context = createCompletionContext(2);
    const cleanup = vi.fn();

    finishSurfaceMount(context, document.createElement("div"), PLUGIN_ID, surface, SURFACE_KEY, "key", 1, cleanup);

    expect(cleanup).toHaveBeenCalledOnce();
    expect(context.mounted.size).toBe(0);
    expect(context.onSurfaceMounted).not.toHaveBeenCalled();
  });

  it("records current mounts and publishes lifecycle events", () => {
    const context = createCompletionContext(1);
    const target = document.createElement("div");

    finishSurfaceMount(context, target, PLUGIN_ID, surface, SURFACE_KEY, "key", 1, null);

    expect(context.mounted.get(SURFACE_KEY)?.element).toBe(target);
    expect(context.maybeActivateSurfaceBehaviors).toHaveBeenCalledOnce();
    expect(context.onSurfaceMounted).toHaveBeenCalledWith(SURFACE_KEY, PLUGIN_ID);
    expect(context.onSurfaceEntering).toHaveBeenCalledWith(target, SURFACE_KEY, PLUGIN_ID);
  });
});

describe("federated surface reconciliation", () => {
  it("mounts through federation and preserves synchronous function cleanup", async () => {
    const cleanup = vi.fn();
    const mountSurface = vi.fn(() => cleanup);
    const fixture = createFederationFixture(async () => ({ mountSurface }));

    await reconcileFixture(fixture);

    const mounted = fixture.context.mounted.get(SURFACE_KEY);
    expect(mountSurface).toHaveBeenCalledWith(mounted?.element, expect.objectContaining({ surfaceId: SURFACE_KEY }));
    mounted?.cleanup?.();
    expect(cleanup).toHaveBeenCalledOnce();
    expect(fixture.onSurfaceMounted).toHaveBeenCalledOnce();
  });

  it("normalizes object dispose cleanup from the federated mount", async () => {
    const dispose = vi.fn();
    const fixture = createFederationFixture(async () => ({ mountSurface: () => ({ dispose }) }));

    await reconcileFixture(fixture);
    fixture.context.mounted.get(SURFACE_KEY)?.cleanup?.();

    expect(dispose).toHaveBeenCalledOnce();
  });

  it("normalizes object unmount cleanup from the federated mount", async () => {
    const unmount = vi.fn();
    const fixture = createFederationFixture(async () => ({ mountSurface: () => ({ unmount }) }));

    await reconcileFixture(fixture);
    fixture.context.mounted.get(SURFACE_KEY)?.cleanup?.();

    expect(unmount).toHaveBeenCalledOnce();
  });

  it("awaits asynchronous federated mounts and records their cleanup", async () => {
    const cleanup = vi.fn();
    const mountSurface = vi.fn(async () => cleanup);
    const fixture = createFederationFixture(async () => ({ mountSurface }));

    await reconcileFixture(fixture);
    fixture.context.mounted.get(SURFACE_KEY)?.cleanup?.();

    expect(mountSurface).toHaveBeenCalledOnce();
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it("does not invoke a mount from a stale remote-load generation", async () => {
    const remoteLoad = createDeferred<unknown>();
    const mountSurface = vi.fn();
    const fixture = createFederationFixture(() => remoteLoad.promise);

    const pendingReconcile = reconcileFixture(fixture, 1);
    fixture.context.generation = 2;
    remoteLoad.resolve({ mountSurface });
    await pendingReconcile;

    expect(mountSurface).not.toHaveBeenCalled();
    expect(fixture.context.mounted.size).toBe(0);
    expect(fixture.onSurfaceMounted).not.toHaveBeenCalled();
  });

  it("cleans a stale pending mount exactly once without replacing the current mount", async () => {
    const staleCleanupResult = createDeferred<unknown>();
    const staleMountStarted = createDeferred<void>();
    const currentMountStarted = createDeferred<void>();
    const staleCleanup = vi.fn();
    const currentCleanup = vi.fn();
    let mountCount = 0;
    const mountSurface = vi.fn(() => {
      mountCount += 1;
      if (mountCount === 1) {
        staleMountStarted.resolve();
        return staleCleanupResult.promise;
      }
      currentMountStarted.resolve();
      return currentCleanup;
    });
    const fixture = createFederationFixture(async () => ({ mountSurface }));

    const staleReconcile = reconcileFixture(fixture, 1);
    await staleMountStarted.promise;
    fixture.context.generation = 2;
    const currentReconcile = reconcileFixture(fixture, 2);
    await currentMountStarted.promise;
    await currentReconcile;
    staleCleanupResult.resolve(staleCleanup);
    await staleReconcile;

    expect(staleCleanup).toHaveBeenCalledOnce();
    expect(currentCleanup).not.toHaveBeenCalled();
    expect(fixture.context.mounted.get(SURFACE_KEY)?.cleanup).toBe(currentCleanup);
    expect(fixture.onSurfaceMounted).toHaveBeenCalledOnce();
  });

  it("reports remote-load failures without publishing a mount", async () => {
    const failure = new Error("remote load failed");
    const fixture = createFederationFixture(async () => {
      throw failure;
    });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await reconcileFixture(fixture);

    expect(fixture.onSurfaceMountError).toHaveBeenCalledWith(SURFACE_KEY, PLUGIN_ID, failure);
    expect(fixture.context.mounted.size).toBe(0);
  });

  it("reports synchronous mount failures without publishing a mount", async () => {
    const failure = new Error("sync mount failed");
    const fixture = createFederationFixture(async () => ({
      mountSurface: () => {
        throw failure;
      },
    }));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await reconcileFixture(fixture);

    expect(fixture.onSurfaceMountError).toHaveBeenCalledWith(SURFACE_KEY, PLUGIN_ID, failure);
    expect(fixture.context.mounted.size).toBe(0);
  });

  it("reports asynchronous mount failures without publishing a mount", async () => {
    const failure = new Error("async mount failed");
    const fixture = createFederationFixture(async () => ({
      mountSurface: async () => {
        throw failure;
      },
    }));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await reconcileFixture(fixture);

    expect(fixture.onSurfaceMountError).toHaveBeenCalledWith(SURFACE_KEY, PLUGIN_ID, failure);
    expect(fixture.context.mounted.size).toBe(0);
  });

  it.each([
    null,
    "invalid",
    { dispose: "not-callable" },
  ])("records a mount without cleanup for invalid mount result %#", async (invalidResult) => {
    const fixture = createFederationFixture(async () => ({ mountSurface: () => invalidResult }));

    await reconcileFixture(fixture);

    expect(fixture.context.mounted.get(SURFACE_KEY)?.cleanup).toBeNull();
    expect(fixture.onSurfaceMounted).toHaveBeenCalledOnce();
    expect(fixture.onSurfaceMountError).not.toHaveBeenCalled();
  });
});
