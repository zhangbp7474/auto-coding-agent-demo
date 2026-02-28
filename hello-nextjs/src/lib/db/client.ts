import { getAppConfig, getDatabaseConfig } from "@/lib/config";

type DbRow = Record<string, unknown>;

interface DbResult<T = DbRow> {
  rows: T[];
  rowCount: number | null;
}

let useSQLite: boolean | null = null;

function shouldUseSQLite(): boolean {
  if (useSQLite === null) {
    const dbConfig = getDatabaseConfig();
    useSQLite = dbConfig.type === "sqlite";
  }
  return useSQLite;
}

export async function query<T extends DbRow = DbRow>(
  text: string,
  params?: unknown[]
): Promise<DbResult<T>> {
  if (shouldUseSQLite()) {
    const { getDb } = await import("./sqlite");
    const db = getDb();
    
    const stmt = db.prepare(text);
    
    if (text.trim().toUpperCase().startsWith("SELECT")) {
      const rows = stmt.all(...(params || [])) as T[];
      return { rows, rowCount: rows.length };
    } else if (text.trim().toUpperCase().startsWith("INSERT")) {
      const info = stmt.run(...(params || []));
      const tableName = text.match(/INSERT INTO (\w+)/i)?.[1];
      if (tableName && params && params.length > 0) {
        const idStmt = db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`);
        const row = idStmt.get(params[0]) as T | undefined;
        return { rows: row ? [row] : [], rowCount: info.changes };
      }
      return { rows: [], rowCount: info.changes };
    } else if (text.trim().toUpperCase().startsWith("UPDATE")) {
      const info = stmt.run(...(params || []));
      return { rows: [], rowCount: info.changes };
    } else if (text.trim().toUpperCase().startsWith("DELETE")) {
      const info = stmt.run(...(params || []));
      return { rows: [], rowCount: info.changes };
    } else {
      const rows = stmt.all(...(params || [])) as T[];
      return { rows, rowCount: rows.length };
    }
  } else {
    const { getPool } = await import("./pg-client");
    const pool = getPool();
    const result = await pool.query<T>(text, params);
    return {
      rows: result.rows,
      rowCount: result.rowCount,
    };
  }
}

export function generateId(): string {
  const { getAppConfig } = require("@/lib/config");
  const crypto = require("crypto");
  return crypto.randomUUID();
}

export async function closeConnections(): Promise<void> {
  if (shouldUseSQLite()) {
    const { closeDb } = await import("./sqlite");
    closeDb();
  } else {
    const { closePool } = await import("./pg-client");
    await closePool();
  }
}
