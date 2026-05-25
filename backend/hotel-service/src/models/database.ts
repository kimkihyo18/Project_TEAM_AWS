import pool from './pool';

export async function initializeDatabase(): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS hotels (
        id             VARCHAR(36)  PRIMARY KEY,
        host_id        VARCHAR(36)  NOT NULL,
        name           VARCHAR(255) NOT NULL,
        description    TEXT         NOT NULL,
        category       ENUM('hotel','motel','pension','guesthouse','resort','camping') NOT NULL,
        address        TEXT         NOT NULL,
        city           VARCHAR(100) NOT NULL,
        region         VARCHAR(100) NOT NULL,
        latitude       DOUBLE,
        longitude      DOUBLE,
        amenities      JSON         NOT NULL,
        images         JSON         NOT NULL,
        check_in_time  VARCHAR(10)  NOT NULL DEFAULT '15:00',
        check_out_time VARCHAR(10)  NOT NULL DEFAULT '11:00',
        rating         DECIMAL(3,1) NOT NULL DEFAULT 0,
        review_count   INT          NOT NULL DEFAULT 0,
        is_active      TINYINT(1)   NOT NULL DEFAULT 1,
        video_url      VARCHAR(500) NULL,
        video_status   ENUM('none','processing','ready') NOT NULL DEFAULT 'none',
        created_at     DATETIME     NOT NULL DEFAULT NOW(),
        updated_at     DATETIME     NOT NULL DEFAULT NOW() ON UPDATE NOW()
      ) CHARACTER SET utf8mb4
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS rooms (
        id              VARCHAR(36)   PRIMARY KEY,
        hotel_id        VARCHAR(36)   NOT NULL,
        name            VARCHAR(255)  NOT NULL,
        description     TEXT          NOT NULL,
        type            ENUM('standard','deluxe','suite','family','dormitory') NOT NULL,
        capacity        INT           NOT NULL DEFAULT 2,
        price_per_night DECIMAL(10,2) NOT NULL,
        discount_rate   DECIMAL(5,2)  NOT NULL DEFAULT 0,
        images          JSON          NOT NULL,
        amenities       JSON          NOT NULL,
        is_available    TINYINT(1)    NOT NULL DEFAULT 1,
        created_at      DATETIME      NOT NULL DEFAULT NOW(),
        updated_at      DATETIME      NOT NULL DEFAULT NOW() ON UPDATE NOW(),
        FOREIGN KEY (hotel_id) REFERENCES hotels(id)
      ) CHARACTER SET utf8mb4
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS wishlists (
        id         VARCHAR(36) PRIMARY KEY,
        user_id    VARCHAR(36) NOT NULL,
        hotel_id   VARCHAR(36) NOT NULL,
        created_at DATETIME    NOT NULL DEFAULT NOW(),
        UNIQUE KEY uq_user_hotel (user_id, hotel_id),
        FOREIGN KEY (hotel_id) REFERENCES hotels(id)
      ) CHARACTER SET utf8mb4
    `);

    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_hotels_city     ON hotels(city)`,
      `CREATE INDEX IF NOT EXISTS idx_hotels_region   ON hotels(region)`,
      `CREATE INDEX IF NOT EXISTS idx_hotels_category ON hotels(category)`,
      `CREATE INDEX IF NOT EXISTS idx_rooms_hotel     ON rooms(hotel_id)`,
      `CREATE INDEX IF NOT EXISTS idx_wishlists_user  ON wishlists(user_id)`,
    ];
    for (const idx of indexes) {
      try { await conn.execute(idx); } catch { /* 이미 존재하면 무시 */ }
    }

    console.log('✅ hotel_db initialized');
  } finally {
    conn.release();
  }
}
