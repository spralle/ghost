import type {
  InvalidationEvent,
  InvalidationProcessor,
  InvalidationProcessorConfig,
} from "./types.js";

const DEFAULT_DEBOUNCE_MS = 100;

/**
 * Create an invalidation processor that debounces events and
 * batches affected principal IDs before invalidating.
 */
export function createInvalidationProcessor(
  config: InvalidationProcessorConfig,
): InvalidationProcessor {
  const { snapshotManager, handler, debounceMs = DEFAULT_DEBOUNCE_MS } = config;

  let pending = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  function execute(): void {
    timer = null;
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
      for (const id of event.affectedPrincipalIds) {
        pending.add(id);
      }

      if (timer !== null) {
        clearTimeout(timer);
      }
      timer = setTimeout(execute, debounceMs);
    },

    flush(): void {
      if (timer !== null) {
        clearTimeout(timer);
      }
      execute();
    },
  };
}
