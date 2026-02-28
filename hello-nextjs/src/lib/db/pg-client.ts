import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
import { getDatabaseConfig } from "@/lib/config";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const config = getDatabaseConfig();
    pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.name,
      user: config.user,
      password: config.password,
      max: config.pool_size,
      connectionTimeoutMillis: config.connection_timeout,
      idleTimeoutMillis: config.idle_timeout,
    });

    pool.on("error", (err) => {
      console.error("Unexpected error on idle client", err);
    });
  }
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const pool = getPool();
  return pool.query<T>(text, params);
}

export async function getClient(): Promise<PoolClient> {
  const pool = getPool();
  return pool.connect();
}

export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getClient();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
