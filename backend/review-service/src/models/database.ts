import pool from './pool';

export async function initializeDatabase(): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS reviews (
        id          VARCHAR(36)  PRIMARY KEY,
        user_id     VARCHAR(36)  NOT NULL,
        user_name   VARCHAR(100) NOT NULL DEFAULT '',
        user_avatar TEXT,
        hotel_id    VARCHAR(36)  NOT NULL,
        booking_id  VARCHAR(36)  NOT NULL,
        rating      TINYINT      NOT NULL CHECK (rating BETWEEN 1 AND 5),
        title       VARCHAR(255) NOT NULL,
        content     TEXT         NOT NULL,
        images      JSON         NOT NULL,
        created_at  DATETIME     NOT NULL DEFAULT NOW(),
        updated_at  DATETIME     NOT NULL DEFAULT NOW() ON UPDATE NOW()
      ) CHARACTER SET utf8mb4
    `);

    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_reviews_hotel  ON reviews(hotel_id)`,
      `CREATE INDEX IF NOT EXISTS idx_reviews_user   ON reviews(user_id)`,
    ];
    for (const idx of indexes) {
      try { await conn.execute(idx); } catch { /* 이미 존재하면 무시 */ }
    }

    console.log('✅ review_db initialized');
  } finally {
    conn.release();
  }
}
