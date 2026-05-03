import { describe, test, expect, mock, beforeEach } from 'bun:test';

// Mock @ghost/sentinel BEFORE any imports that use it
const mockCheck = mock((): { effect: 'allow' | 'deny'; matchedRules: { name: string; effect: string; salience: number }[]; reason: string } => ({ effect: 'allow', matchedRules: [], reason: 'allowed' }));
const mockExpand = mock((): { type: 'decision'; description: string; children?: readonly never[]; metadata: Record<string, unknown> } => ({ type: 'decision', description: 'deny: denied', metadata: {} }));

mock.module('@ghost/sentinel', () => ({
  check: mockCheck,
  expand: mockExpand,
  // Re-export types as empty to satisfy any type imports
  createPrincipal: () => ({}),
  GraphSubset: class {},
}));

// Now import our code (which imports @ghost/sentinel)
const { resolveAction } = await import('../action-mapper.js');
const { AuthorizationError } = await import('../types.js');
const { createSentinelPlugin } = await import('../sentinel-plugin.js');

type AuthorizationErrorInstance = InstanceType<typeof AuthorizationError>;

function makePrincipal(userId = 'user-1', tenantId = 'tenant-1') {
  return { userId, tenantId, roles: ['admin'], partyIds: [], orgChain: [] };
}

function makeCtx(commandType: string, meta: unknown = { principal: makePrincipal() }) {
  return { aggregateId: 'agg-1', commandType, payload: { foo: 'bar' }, meta };
}

const defaultConfig = () => ({
  actionMap: { 'order.create': 'order:create', 'order.*': 'order:wildcard' } as Record<string, string>,
  resolvePrincipal: (meta: unknown) => {
    const m = meta as { principal?: ReturnType<typeof makePrincipal> } | undefined;
    return m?.principal;
  },
  mode: {
    kind: 'snapshot' as const,
    getSnapshot: (_id: string) => ({
      principalId: 'user-1',
      tenantId: 'tenant-1',
      resolvedRoles: ['admin'],
      compiledPolicy: { rules: [] },
      graphCone: { resolve: () => [] },
      redactionMap: {},
      timestamp: Date.now(),
      ttl: 3600,
    }),
  },
});

beforeEach(() => {
  mockCheck.mockReset();
  mockExpand.mockReset();
  mockCheck.mockReturnValue({ effect: 'allow', matchedRules: [], reason: 'allowed' });
  mockExpand.mockReturnValue({ type: 'decision', description: 'deny', metadata: {} });
});

describe('resolveAction', () => {
  test('direct match works', () => {
    expect(resolveAction({ 'order.create': 'order:create' }, 'order.create')).toBe('order:create');
  });

  test('wildcard match works', () => {
    expect(resolveAction({ 'order.*': 'order:any' }, 'order.update')).toBe('order:any');
  });

  test('no match returns undefined', () => {
    expect(resolveAction({ 'order.create': 'order:create' }, 'invoice.create')).toBeUndefined();
  });
});

describe('AuthorizationError', () => {
  test('has correct message format', () => {
    const err = new AuthorizationError({
      principal: makePrincipal(),
      action: 'order:create',
      commandType: 'order.create',
      aggregateId: 'agg-1',
      checkResult: { effect: 'deny', matchedRules: [], reason: 'no permission' },
    });
    expect(err.message).toBe('Authorization denied: order:create on agg-1 — no permission');
    expect(err.code).toBe('AUTHORIZATION_DENIED');
    expect(err.name).toBe('AuthorizationError');
  });
});

describe('createSentinelPlugin', () => {
  test('allowed command passes through', async () => {
    mockCheck.mockReturnValue({ effect: 'allow', matchedRules: [], reason: 'allowed' });
    const plugin = createSentinelPlugin(defaultConfig() as never);
    await expect(plugin.onBeforeCommand!(makeCtx('order.create'))).resolves.toBeUndefined();
  });

  test('denied command throws AuthorizationError', async () => {
    mockCheck.mockReturnValue({ effect: 'deny', matchedRules: [{ name: 'r1', effect: 'deny', salience: 10 }], reason: 'denied' });
    mockExpand.mockReturnValue({ type: 'decision', description: 'deny', metadata: {} });
    const plugin = createSentinelPlugin(defaultConfig() as never);
    try {
      await plugin.onBeforeCommand!(makeCtx('order.create'));
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeInstanceOf(AuthorizationError);
      const err = e as AuthorizationErrorInstance;
      expect(err.action).toBe('order:create');
      expect(err.checkResult.effect).toBe('deny');
      expect(err.derivation).toBeDefined();
    }
  });

  test('unmapped command passes through (denyUnmapped=false)', async () => {
    const plugin = createSentinelPlugin(defaultConfig() as never);
    await expect(plugin.onBeforeCommand!(makeCtx('unknown.cmd'))).resolves.toBeUndefined();
  });

  test('unmapped command denied (denyUnmapped=true)', async () => {
    const cfg = { ...defaultConfig(), denyUnmapped: true };
    const plugin = createSentinelPlugin(cfg as never);
    try {
      await plugin.onBeforeCommand!(makeCtx('unknown.cmd'));
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeInstanceOf(AuthorizationError);
      expect((e as AuthorizationErrorInstance).checkResult.reason).toBe('Unmapped command denied');
    }
  });

  test('anonymous denied by default', async () => {
    const plugin = createSentinelPlugin(defaultConfig() as never);
    try {
      await plugin.onBeforeCommand!(makeCtx('order.create', {}));
      expect(true).toBe(false);
    } catch (e) {
      expect(e).toBeInstanceOf(AuthorizationError);
      expect((e as AuthorizationErrorInstance).checkResult.reason).toBe('Anonymous access denied');
    }
  });

  test('anonymous passthrough when denyAnonymous=false', async () => {
    const cfg = { ...defaultConfig(), denyAnonymous: false };
    const plugin = createSentinelPlugin(cfg as never);
    await expect(plugin.onBeforeCommand!(makeCtx('order.create', {}))).resolves.toBeUndefined();
  });

  test('store mode builds context from live store', async () => {
    mockCheck.mockReturnValue({ effect: 'allow', matchedRules: [], reason: 'ok' });
    const cfg = {
      ...defaultConfig(),
      mode: {
        kind: 'store' as const,
        store: {
          getCompiledPolicy: () => ({ rules: [] }),
          getGraphSubset: () => ({ resolve: () => [] }),
        },
      },
    };
    const plugin = createSentinelPlugin(cfg as never);
    await expect(plugin.onBeforeCommand!(makeCtx('order.create'))).resolves.toBeUndefined();
    expect(mockCheck).toHaveBeenCalled();
  });

  test('snapshot mode builds context from snapshot', async () => {
    mockCheck.mockReturnValue({ effect: 'allow', matchedRules: [], reason: 'ok' });
    const plugin = createSentinelPlugin(defaultConfig() as never);
    await expect(plugin.onBeforeCommand!(makeCtx('order.create'))).resolves.toBeUndefined();
    expect(mockCheck).toHaveBeenCalled();
  });

  test('derivation included in error for debugging', async () => {
    mockCheck.mockReturnValue({ effect: 'deny', matchedRules: [], reason: 'nope' });
    const derivationNode = { type: 'decision' as const, description: 'deny: nope', children: [] as readonly never[], metadata: { effect: 'deny' } };
    mockExpand.mockReturnValue(derivationNode);
    const plugin = createSentinelPlugin(defaultConfig() as never);
    try {
      await plugin.onBeforeCommand!(makeCtx('order.create'));
      expect(true).toBe(false);
    } catch (e) {
      expect((e as AuthorizationErrorInstance).derivation).toEqual(derivationNode);
    }
  });

  test('buildResource customizer is called with command context', async () => {
    mockCheck.mockReturnValue({ effect: 'allow', matchedRules: [], reason: 'ok' });
    const buildResource = mock((ctx: { aggregateId: string; commandType: string; payload: unknown }) => ({
      id: ctx.aggregateId,
      type: 'custom',
    }));
    const cfg = { ...defaultConfig(), buildResource };
    const plugin = createSentinelPlugin(cfg as never);
    await plugin.onBeforeCommand!(makeCtx('order.create'));
    expect(buildResource).toHaveBeenCalledWith({
      aggregateId: 'agg-1',
      commandType: 'order.create',
      payload: { foo: 'bar' },
    });
  });

  test('plugin key is sentinel-auth', () => {
    const plugin = createSentinelPlugin(defaultConfig() as never);
    expect(plugin.key).toBe('sentinel-auth');
  });
});
