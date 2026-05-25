import pool from './pool';

export async function initializeDatabase(): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS bookings (
        id               VARCHAR(36)   PRIMARY KEY,
        user_id          VARCHAR(36)   NOT NULL,
        host_id          VARCHAR(36)   NOT NULL DEFAULT '',
        hotel_id         VARCHAR(36)   NOT NULL,
        hotel_name       VARCHAR(255)  NOT NULL DEFAULT '',
        hotel_address    TEXT,
        hotel_images     TEXT,
        room_id          VARCHAR(36)   NOT NULL,
        room_name        VARCHAR(255)  NOT NULL DEFAULT '',
        room_type        VARCHAR(50)   NOT NULL DEFAULT 'standard',
        check_in_date    DATE          NOT NULL,
        check_out_date   DATE          NOT NULL,
        guests           INT           NOT NULL DEFAULT 1,
        total_price      DECIMAL(10,2) NOT NULL,
        status           ENUM('pending','confirmed','cancelled','completed') NOT NULL DEFAULT 'pending',
        special_requests TEXT,
        created_at       DATETIME      NOT NULL DEFAULT NOW(),
        updated_at       DATETIME      NOT NULL DEFAULT NOW() ON UPDATE NOW()
      ) CHARACTER SET utf8mb4
    `);

    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_bookings_user  ON bookings(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_bookings_hotel ON bookings(hotel_id)`,
      `CREATE INDEX IF NOT EXISTS idx_bookings_room  ON bookings(room_id)`,
    ];
    for (const idx of indexes) {
      try { await conn.execute(idx); } catch { /* 이미 존재하면 무시 */ }
    }

    console.log('✅ booking_db initialized');
  } finally {
    conn.release();
  }
}
