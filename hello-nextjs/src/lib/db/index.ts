import { getDatabaseConfig, getAppConfig } from "@/lib/config";

const USE_SQLITE = true;

export function shouldUseSQLite(): boolean {
  const appConfig = getAppConfig();
  return appConfig.development || USE_SQLITE;
}

export async function initializeDatabase(): Promise<void> {
  if (shouldUseSQLite()) {
    const { getDb } = await import("./sqlite");
    getDb();
    console.log("Using SQLite database for development");
  } else {
    const { getPool } = await import("./pg-client");
    const pool = getPool();
    try {
      await pool.query("SELECT 1");
      console.log("Connected to PostgreSQL database");
    } catch (error) {
      console.error("Failed to connect to PostgreSQL:", error);
      throw error;
    }
  }
}
