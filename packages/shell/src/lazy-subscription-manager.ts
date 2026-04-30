/**
 * Manages lazy state subscriptions for services marked with { lazy: true }.
 * Subscriptions are only established when a secondary window first accesses the service.
 */

export interface LazySubscription {
  tokenId: string;
  /** Number of active consumers (secondary windows using this subscription) */
  consumerCount: number;
  /** Cleanup function to tear down the subscription */
  dispose: () => void;
}

export interface LazySubscriptionManagerOptions {
  /** Called when a lazy service is first accessed — should set up state replication */
  onActivate: (tokenId: string) => () => void;
}

export interface LazySubscriptionManager {
  /** Called when a secondary window accesses a lazy service for the first time */
  acquire(tokenId: string): void;
  /** Called when a secondary window disconnects or no longer needs the service */
  release(tokenId: string): void;
  /** Check if a service has an active subscription */
  isActive(tokenId: string): boolean;
  /** Get current consumer count for a service */
  getConsumerCount(tokenId: string): number;
  /** Tear down all subscriptions */
  disposeAll(): void;
}

export function createLazySubscriptionManager(options: LazySubscriptionManagerOptions): LazySubscriptionManager {
  const subscriptions = new Map<string, LazySubscription>();

  return {
    acquire(tokenId: string): void {
      const existing = subscriptions.get(tokenId);
      if (existing) {
        existing.consumerCount++;
        return;
      }
      const dispose = options.onActivate(tokenId);
      subscriptions.set(tokenId, { tokenId, consumerCount: 1, dispose });
    },

    release(tokenId: string): void {
      const existing = subscriptions.get(tokenId);
      if (!existing) return;
      existing.consumerCount--;
      if (existing.consumerCount <= 0) {
        existing.dispose();
        subscriptions.delete(tokenId);
      }
    },

    isActive(tokenId: string): boolean {
      return subscriptions.has(tokenId);
    },

    getConsumerCount(tokenId: string): number {
      return subscriptions.get(tokenId)?.consumerCount ?? 0;
    },

    disposeAll(): void {
      for (const sub of subscriptions.values()) {
        sub.dispose();
      }
      subscriptions.clear();
    },
  };
}
