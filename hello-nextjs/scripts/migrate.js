import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

async function migrate() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'ai_video_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '1qaz2wsx',
  });

  try {
    console.log('Connecting to database...');
    const client = await pool.connect();
    
    console.log('Running migration...');
    const migrationFile = path.join(__dirname, '..', 'migrations', '001_local_schema.sql');
    const sql = fs.readFileSync(migrationFile, 'utf8');
    
    await client.query(sql);
    console.log('Migration completed successfully!');
    
    client.release();
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
