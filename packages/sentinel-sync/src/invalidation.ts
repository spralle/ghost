import type {
  InvalidationEvent,
  InvalidationProcessor,
  InvalidationProcessorConfig,
} from "./types";

const DEFAULT_DEBOUNCE_MS = 100;
const DEFAULT_MAX_WAIT_MS = 5_000;

/**
 * Create an invalidation processor that debounces events and
 * batches affected principal IDs before invalidating.
 *
 * A maxWaitMs cap ensures batches flush within a bounded window
 * even under sustained event throughput.
 */
export function createInvalidationProcessor(
  config: InvalidationProcessorConfig,
): InvalidationProcessor {
  const {
    snapshotManager,
    handler,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    maxWaitMs = DEFAULT_MAX_WAIT_MS,
  } = config;

  let pending = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let batchStartTime: number | null = null;
  let destroyed = false;

  function clearTimer(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function execute(): void {
    clearTimer();
    batchStartTime = null;
    if (pending.size === 0) return;

    const batch = [...pending];
    pending = new Set();

    for (const id of batch) {
      snapshotManager.invalidate(id);
    }

    handler.onInvalidate(batch);
  }

  return {
    process(event: InvalidationEvent): void {
      if (destroyed) return;

      for (const id of event.affectedPrincipalIds) {
        pending.add(id);
      }

      const now = Date.now();
      if (batchStartTime === null) {
        batchStartTime = now;
      }

      // If max wait exceeded, flush immediately instead of resetting
      if (now - batchStartTime >= maxWaitMs) {
        execute();
        return;
      }

      clearTimer();
      timer = setTimeout(execute, debounceMs);
    },

    flush(): void {
      clearTimer();
      execute();
    },

    destroy(options?: { readonly flush?: boolean }): void {
      if (destroyed) return;
      destroyed = true;
      if (options?.flush) {
        execute();
      } else {
        clearTimer();
        pending = new Set();
        batchStartTime = null;
      }
    },
  };
}
