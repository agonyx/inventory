import 'reflect-metadata';
import { mock } from 'bun:test';

/**
 * Mutable mock state. Set repo mocks in beforeEach, cleared in resetMockState().
 * The module mock factory (passed to mock()) captures this by reference.
 */
export const mockState: {
  repos: Record<string, ReturnType<typeof createMockRepo>>;
  transactionFn: ((fn: (mgr: any) => Promise<any>) => Promise<any>) | null;
} = {
  repos: {},
  transactionFn: null,
};

/** Reset all mock state between tests */
export function resetMockState() {
  mockState.repos = {};
  mockState.transactionFn = null;
}

/**
 * Create a flexible mock TypeORM repository.
 * Pass seed data — the mock uses simple where-clause matching for findOne.
 */
export function createMockRepo(seed: any[] = []) {
  const store = [...seed];

  const matchWhere = (item: any, where: any): boolean => {
    if (!where) return true;
    for (const [key, val] of Object.entries(where)) {
      if (item[key] !== val) return false;
    }
    return true;
  };

  return {
    _store: store,
    find: mock(async (opts?: any) => {
      if (opts?.where) return store.filter((i) => matchWhere(i, opts.where));
      return store;
    }),
    findOne: mock(async (opts?: any) => {
      if (opts?.where) return store.find((i) => matchWhere(i, opts.where)) ?? null;
      return store[0] ?? null;
    }),
    findBy: mock(async (_criteria?: any) => store),
    create: mock((data: any) => ({ ...data })),
    save: mock(async (item: any) => {
      const saved = typeof item === 'object' && !Array.isArray(item) ? { ...item } : item;
      if (!saved.id && typeof saved === 'object') saved.id = crypto.randomUUID();
      return saved;
    }),
    delete: mock(async () => ({ affected: 1 })),
    merge: mock((target: any, ...sources: any[]) => Object.assign({}, target, ...sources)),
  };
}

/**
 * Create a mock EntityManager for use inside transactions.
 */
export function createMockManager() {
  return {
    findOne: mock(async () => null),
    find: mock(async () => []),
    create: mock((_entity: any, data: any) => ({ ...data })),
    save: mock(async (item: any) => {
      if (!item.id) item.id = crypto.randomUUID();
      return item;
    }),
  };
}

/**
 * Factory for the data-source mock. Call mock() with this in each test file:
 *
 *   import { mock } from 'bun:test';
 *   import { mockState, createMockRepo } from './helpers';
 *
 *   mock('../src/data-source', () => ({
 *     AppDataSource: createMockDataSource(),
 *   }));
 */
export function createMockDataSource() {
  return {
    getRepository: (entity: any) => {
      const name = entity?.name || 'Unknown';
      return mockState.repos[name] || createMockRepo();
    },
    transaction: async (fn: (mgr: any) => Promise<any>) => {
      if (mockState.transactionFn) return mockState.transactionFn(fn);
      return fn(createMockManager());
    },
    initialize: () => Promise.resolve(),
  };
}

/** AUTH_TOKEN value used in tests */
export const TEST_AUTH_TOKEN = 'test-token-123';
export const authHeader = { Authorization: `Bearer ${TEST_AUTH_TOKEN}` };
