import { describe, it, expect, beforeEach } from 'bun:test';
import { MongoSentinelStore } from '../mongodb-store';
import type { Db, Collection } from 'mongodb';

/** Minimal in-memory mock of a MongoDB Collection */
function createMockCollection<T extends Record<string, unknown>>(): Collection<T> {
  let docs: Record<string, unknown>[] = [];

  const col = {
    find(filter: Record<string, unknown>, options?: { projection?: Record<string, unknown> }) {
      const results = docs.filter((doc) => {
        for (const [key, val] of Object.entries(filter)) {
          if (doc[key] !== val) return false;
        }
        return true;
      });
      const mapped = options?.projection
        ? results.map((d) => {
            const copy = { ...d };
            const proj = options.projection!;
            for (const [key, val] of Object.entries(proj)) {
              if (val === 0) delete copy[key];
            }
            return copy;
          })
        : results;
      return { toArray: () => Promise.resolve(mapped) };
    },
    findOne(filter: Record<string, unknown>, options?: { projection?: Record<string, unknown> }) {
      const found = docs.find((doc) => {
        for (const [key, val] of Object.entries(filter)) {
          if (doc[key] !== val) return false;
        }
        return true;
      });
      if (!found) return Promise.resolve(null);
      if (options?.projection) {
        const copy = { ...found };
        const proj = options.projection!;
        for (const [key, val] of Object.entries(proj)) {
          if (val === 0) delete copy[key];
        }
        return Promise.resolve(copy);
      }
      return Promise.resolve(found);
    },
    insertOne(doc: Record<string, unknown>) {
      docs.push({ _id: Math.random().toString(), ...doc });
      return Promise.resolve({ insertedId: docs[docs.length - 1]._id });
    },
    insertMany(items: Record<string, unknown>[]) {
      for (const doc of items) {
        docs.push({ _id: Math.random().toString(), ...doc });
      }
      return Promise.resolve({ insertedCount: items.length });
    },
    updateOne(
      filter: Record<string, unknown>,
      update: { $set?: Record<string, unknown> },
      options?: { upsert?: boolean },
    ) {
      const idx = docs.findIndex((doc) => {
        for (const [key, val] of Object.entries(filter)) {
          if (doc[key] !== val) return false;
        }
        return true;
      });
      if (idx >= 0 && update.$set) {
        docs[idx] = { ...docs[idx], ...update.$set };
      } else if (idx < 0 && options?.upsert && update.$set) {
        docs.push({ _id: Math.random().toString(), ...update.$set });
      }
      return Promise.resolve({ modifiedCount: idx >= 0 ? 1 : 0 });
    },
    deleteOne(filter: Record<string, unknown>) {
      const idx = docs.findIndex((doc) => {
        for (const [key, val] of Object.entries(filter)) {
          if (doc[key] !== val) return false;
        }
        return true;
      });
      if (idx >= 0) docs.splice(idx, 1);
      return Promise.resolve({ deletedCount: idx >= 0 ? 1 : 0 });
    },
    deleteMany(filter: Record<string, unknown>) {
      const before = docs.length;
      if (Object.keys(filter).length === 0) {
        docs = [];
      } else {
        docs = docs.filter((doc) => {
          for (const [key, val] of Object.entries(filter)) {
            if (doc[key] !== val) return true;
          }
          return false;
        });
      }
      return Promise.resolve({ deletedCount: before - docs.length });
    },
    createIndex() {
      return Promise.resolve('ok');
    },
  };

  return col as unknown as Collection<T>;
}

function createMockDb(): Db {
  const collections = new Map<string, unknown>();
  return {
    collection(name: string) {
      if (!collections.has(name)) {
        collections.set(name, createMockCollection<Record<string, unknown>>());
      }
      return collections.get(name);
    },
  } as unknown as Db;
}

describe('MongoSentinelStore', () => {
  let store: MongoSentinelStore;

  beforeEach(() => {
    const db = createMockDb();
    store = new MongoSentinelStore({ db, tenantId: 'tenant-1' });
  });

  it('loadTuples returns empty array when no tuples match', async () => {
    expect(await store.loadTuples('user', 'u1', 'member')).toEqual([]);
  });

  it('loadTuples returns matching tuples filtered by nodeType+nodeId+relation', async () => {
    await store.addTuple({ nodeType: 'org', nodeId: 'o1', relation: 'member', targetType: 'user', targetId: 'u1' });
    await store.addTuple({ nodeType: 'org', nodeId: 'o1', relation: 'member', targetType: 'user', targetId: 'u2' });
    const result = await store.loadTuples('org', 'o1', 'member');
    expect(result).toHaveLength(2);
    expect(result[0].targetId).toBe('u1');
  });

  it('loadTuples does NOT return tuples with different relation', async () => {
    await store.addTuple({ nodeType: 'org', nodeId: 'o1', relation: 'owner', targetType: 'user', targetId: 'u1' });
    await store.addTuple({ nodeType: 'org', nodeId: 'o1', relation: 'member', targetType: 'user', targetId: 'u2' });
    const result = await store.loadTuples('org', 'o1', 'owner');
    expect(result).toHaveLength(1);
    expect(result[0].targetId).toBe('u1');
  });

  it('loadTuplesFrom returns all tuples for a node', async () => {
    await store.addTuple({ nodeType: 'org', nodeId: 'o1', relation: 'owner', targetType: 'user', targetId: 'u1' });
    await store.addTuple({ nodeType: 'org', nodeId: 'o1', relation: 'member', targetType: 'user', targetId: 'u2' });
    const result = await store.loadTuplesFrom({ type: 'org', id: 'o1' });
    expect(result).toHaveLength(2);
  });

  it('loadPolicies returns policies for given resourceType', async () => {
    await store.addPolicy({ resourceType: 'document', action: 'read', condition: { role: 'viewer' }, effect: 'grant' });
    const result = await store.loadPolicies('document');
    expect(result).toHaveLength(1);
    expect(result[0].action).toBe('read');
  });

  it('loadPolicies returns empty for unknown resourceType', async () => {
    expect(await store.loadPolicies('unknown')).toEqual([]);
  });

  it('loadRoles returns roles for principalId', async () => {
    await store.setRoles('u1', ['admin', 'editor']);
    const roles = await store.loadRoles('u1');
    expect(roles).toEqual(['admin', 'editor']);
  });

  it('loadRoles returns empty array for unknown principalId', async () => {
    expect(await store.loadRoles('unknown')).toEqual([]);
  });

  it('addTuple stores and is retrievable', async () => {
    await store.addTuple({ nodeType: 'team', nodeId: 't1', relation: 'member', targetType: 'user', targetId: 'u1' });
    const result = await store.loadTuples('team', 't1', 'member');
    expect(result).toHaveLength(1);
  });

  it('addTuples bulk stores multiple', async () => {
    await store.addTuples([
      { nodeType: 'org', nodeId: 'o1', relation: 'member', targetType: 'user', targetId: 'u1' },
      { nodeType: 'org', nodeId: 'o1', relation: 'member', targetType: 'user', targetId: 'u2' },
      { nodeType: 'org', nodeId: 'o1', relation: 'member', targetType: 'user', targetId: 'u3' },
    ]);
    const result = await store.loadTuples('org', 'o1', 'member');
    expect(result).toHaveLength(3);
  });

  it('removeTuple removes specific tuple', async () => {
    const tuple = { nodeType: 'org', nodeId: 'o1', relation: 'member', targetType: 'user', targetId: 'u1' };
    await store.addTuple(tuple);
    await store.removeTuple(tuple);
    expect(await store.loadTuples('org', 'o1', 'member')).toEqual([]);
  });

  it('setRoles upserts (create + update)', async () => {
    await store.setRoles('u1', ['viewer']);
    expect(await store.loadRoles('u1')).toEqual(['viewer']);
    await store.setRoles('u1', ['admin']);
    expect(await store.loadRoles('u1')).toEqual(['admin']);
  });

  it('removeRoles deletes role document', async () => {
    await store.setRoles('u1', ['admin']);
    await store.removeRoles('u1');
    expect(await store.loadRoles('u1')).toEqual([]);
  });

  it('clear removes all data', async () => {
    await store.addTuple({ nodeType: 'org', nodeId: 'o1', relation: 'member', targetType: 'user', targetId: 'u1' });
    await store.addPolicy({ resourceType: 'doc', action: 'read', condition: null, effect: 'grant' });
    await store.setRoles('u1', ['admin']);
    await store.clear();
    expect(await store.loadTuples('org', 'o1', 'member')).toEqual([]);
    expect(await store.loadPolicies('doc')).toEqual([]);
    expect(await store.loadRoles('u1')).toEqual([]);
  });

  it('write methods return store instance (fluent)', async () => {
    const result = await store.addTuple({ nodeType: 'a', nodeId: 'b', relation: 'c', targetType: 'd', targetId: 'e' });
    expect(result).toBe(store);
  });

  it('tenant isolation: store A cannot see store B tuples', async () => {
    const db = createMockDb();
    const storeA = new MongoSentinelStore({ db, tenantId: 'tenant-a' });
    const storeB = new MongoSentinelStore({ db, tenantId: 'tenant-b' });
    await storeA.addTuple({ nodeType: 'org', nodeId: 'o1', relation: 'member', targetType: 'user', targetId: 'u1' });
    await storeB.addTuple({ nodeType: 'org', nodeId: 'o1', relation: 'member', targetType: 'user', targetId: 'u2' });
    const resultA = await storeA.loadTuples('org', 'o1', 'member');
    const resultB = await storeB.loadTuples('org', 'o1', 'member');
    expect(resultA).toHaveLength(1);
    expect(resultA[0].targetId).toBe('u1');
    expect(resultB).toHaveLength(1);
    expect(resultB[0].targetId).toBe('u2');
  });

  it('tenant isolation: policies are scoped per tenant', async () => {
    const db = createMockDb();
    const storeA = new MongoSentinelStore({ db, tenantId: 'tenant-a' });
    const storeB = new MongoSentinelStore({ db, tenantId: 'tenant-b' });
    await storeA.addPolicy({ resourceType: 'doc', action: 'read', condition: null, effect: 'grant' });
    expect(await storeA.loadPolicies('doc')).toHaveLength(1);
    expect(await storeB.loadPolicies('doc')).toHaveLength(0);
  });

  it('tenant isolation: roles are scoped per tenant', async () => {
    const db = createMockDb();
    const storeA = new MongoSentinelStore({ db, tenantId: 'tenant-a' });
    const storeB = new MongoSentinelStore({ db, tenantId: 'tenant-b' });
    await storeA.setRoles('u1', ['admin']);
    expect(await storeA.loadRoles('u1')).toEqual(['admin']);
    expect(await storeB.loadRoles('u1')).toEqual([]);
  });

  it('tenant isolation: clear only removes current tenant data', async () => {
    const db = createMockDb();
    const storeA = new MongoSentinelStore({ db, tenantId: 'tenant-a' });
    const storeB = new MongoSentinelStore({ db, tenantId: 'tenant-b' });
    await storeA.addTuple({ nodeType: 'org', nodeId: 'o1', relation: 'member', targetType: 'user', targetId: 'u1' });
    await storeB.addTuple({ nodeType: 'org', nodeId: 'o1', relation: 'member', targetType: 'user', targetId: 'u2' });
    await storeA.clear();
    expect(await storeA.loadTuples('org', 'o1', 'member')).toEqual([]);
    expect(await storeB.loadTuples('org', 'o1', 'member')).toHaveLength(1);
  });
});
