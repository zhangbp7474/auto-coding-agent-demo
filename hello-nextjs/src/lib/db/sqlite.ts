import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { getDatabaseConfig } from "@/lib/config";

import type { QueryResultRow } from "pg";

let db: Database.Database | null = null;

function getDbPath(): string {
  const dbConfig = getDatabaseConfig();
  const dbPath = path.resolve(dbConfig.sqlite_db_path);
  const dbDir = path.dirname(dbPath);
  
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  return dbPath;
}

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = getDbPath();
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    initializeTables(db);
  }
  return db;
}

function initializeTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      avatar_url TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      story TEXT,
      style TEXT DEFAULT 'default',
      stage TEXT DEFAULT 'draft',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS scenes (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      order_index INTEGER NOT NULL,
      description TEXT NOT NULL,
      description_confirmed INTEGER DEFAULT 0,
      image_status TEXT DEFAULT 'pending',
      image_confirmed INTEGER DEFAULT 0,
      video_status TEXT DEFAULT 'pending',
      video_confirmed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS images (
      id TEXT PRIMARY KEY,
      scene_id TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      url TEXT NOT NULL,
      width INTEGER,
      height INTEGER,
      version INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      scene_id TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      url TEXT NOT NULL,
      duration REAL,
      task_id TEXT,
      version INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
    CREATE INDEX IF NOT EXISTS idx_scenes_project_id ON scenes(project_id);
    CREATE INDEX IF NOT EXISTS idx_images_scene_id ON images(scene_id);
    CREATE INDEX IF NOT EXISTS idx_videos_scene_id ON videos(scene_id);
  `);
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}
