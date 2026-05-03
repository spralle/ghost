import { describe, expect, test } from 'bun:test';
import { defineBundle, expandBundles, grantsContain, STANDARD_BUNDLES } from '../permission-bundle';

describe('defineBundle', () => {
  test('freezes the bundle', () => {
    const bundle = defineBundle({
      id: 'test',
      name: 'Test',
      description: 'A test bundle',
      grants: [{ action: 'view', resourceType: 'order' }],
    });
    expect(Object.isFrozen(bundle)).toBe(true);
  });
});

describe('expandBundles', () => {
  test('collects grants from multiple bundles', () => {
    const grants = expandBundles(['order-viewer', 'shipment-viewer'], STANDARD_BUNDLES);
    expect(grants).toHaveLength(3);
  });

  test('deduplicates identical grants', () => {
    // order-viewer and order-editor both have view:order
    const grants = expandBundles(['order-viewer', 'order-editor'], STANDARD_BUNDLES);
    const viewOrders = grants.filter((g) => g.action === 'view' && g.resourceType === 'order');
    expect(viewOrders).toHaveLength(1);
  });

  test('returns empty for unknown bundle IDs', () => {
    const grants = expandBundles(['nonexistent'], STANDARD_BUNDLES);
    expect(grants).toHaveLength(0);
  });
});

describe('grantsContain', () => {
  const grants = [
    { action: 'view', resourceType: 'order' },
    { action: 'edit', resourceType: 'order' },
  ];

  test('returns true for matching grant', () => {
    expect(grantsContain(grants, 'view', 'order')).toBe(true);
  });

  test('returns false for non-matching', () => {
    expect(grantsContain(grants, 'delete', 'order')).toBe(false);
  });
});
