import pool from './pool';

export async function initializeDatabase(): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id            VARCHAR(36)  PRIMARY KEY,
        email         VARCHAR(255) UNIQUE NOT NULL,
        password      VARCHAR(255) NOT NULL,
        name          VARCHAR(100) NOT NULL,
        phone         VARCHAR(20),
        profile_image TEXT,
        role          ENUM('user','host','admin') NOT NULL DEFAULT 'user',
        created_at    DATETIME NOT NULL DEFAULT NOW(),
        updated_at    DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW()
      ) CHARACTER SET utf8mb4
    `);

    console.log('✅ auth_db initialized');
  } finally {
    conn.release();
  }
}
