export type QueryRunner = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }>;
};

export type Queryable = QueryRunner & {
  transaction: <T>(callback: (tx: QueryRunner) => Promise<T>) => Promise<T>;
  close: () => Promise<void>;
};

export type DatabaseOptions = {
  databaseUrl?: string | null;
  pgliteDir?: string;
  migrate?: boolean;
};

let dbPromise: Promise<Queryable> | null = null;
let testDb: Queryable | null = null;

async function connect(options: DatabaseOptions = {}): Promise<Queryable> {
  const url = options.databaseUrl !== undefined ? options.databaseUrl : process.env.DATABASE_URL;
  if (url) {
    const pg = await import('pg');
    const Pool = (pg as any).default?.Pool ?? (pg as any).Pool;
    const pool = new Pool({ connectionString: url, max: 3 });
    return {
      query: (text, params) => pool.query(text, params as any[]),
      transaction: async <T>(callback: (tx: QueryRunner) => Promise<T>) => {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const result = await callback({ query: (text, params) => client.query(text, params as any[]) });
          await client.query('COMMIT');
          return result;
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      },
      close: () => pool.end(),
    };
  }

  if (process.env.VERCEL && options.pgliteDir === undefined) {
    throw new Error('DATABASE_URL is not set. On Vercel you must connect a Postgres database (e.g. Neon / Vercel Postgres).');
  }

  const { PGlite } = await import('@electric-sql/pglite');
  const dir = options.pgliteDir ?? process.env.PGLITE_DIR ?? './.data/pglite';
  const memory = dir === ':memory:' || dir === 'memory://';
  if (!memory) {
    const fs = await import('node:fs');
    fs.mkdirSync(dir, { recursive: true });
  }
  const database = memory ? new PGlite() : new PGlite(dir);
  await database.waitReady;
  return {
    query: (text, params) => database.query(text, params as any[]) as any,
    transaction: (callback) => database.transaction((tx) => callback({ query: (text, params) => tx.query(text, params as any[]) as any })),
    close: () => database.close(),
  };
}

export async function createDatabase(options: DatabaseOptions = {}): Promise<Queryable> {
  const database = await connect(options);
  if (options.migrate !== false) {
    const { migrate } = await import('./schema');
    await migrate(database);
  }
  return database;
}

export function getDb(): Promise<Queryable> {
  if (testDb) return Promise.resolve(testDb);
  if (!dbPromise) {
    dbPromise = createDatabase();
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

function assertTestEnvironment() {
  if (process.env.NODE_ENV !== 'test') throw new Error('Test database injection requires NODE_ENV=test');
}

export async function installTestDatabase(database: Queryable | null) {
  assertTestEnvironment();
  if (testDb && testDb !== database) await testDb.close();
  if (dbPromise) {
    const current = await dbPromise.catch(() => null);
    if (current && current !== database) await current.close();
  }
  dbPromise = null;
  testDb = database;
}

export async function closeDb() {
  if (testDb) {
    const current = testDb;
    testDb = null;
    await current.close();
  }
  if (dbPromise) {
    const current = await dbPromise.catch(() => null);
    dbPromise = null;
    if (current) await current.close();
  }
}
