CREATE DATABASE IF NOT EXISTS auth_db CHARACTER SET utf8mb4;
USE auth_db;

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
) CHARACTER SET utf8mb4;

INSERT IGNORE INTO users (id, email, password, name, phone, role) VALUES
  ('11111111-0000-0000-0000-000000000001', 'admin@travel.com', '__BCRYPT_HASH__', '관리자', '010-0000-0000', 'admin'),
  ('11111111-0000-0000-0000-000000000002', 'host@travel.com',  '__BCRYPT_HASH__', '김민준', '010-1111-2222', 'host'),
  ('11111111-0000-0000-0000-000000000003', 'host2@travel.com', '__BCRYPT_HASH__', '이서연', '010-2222-3333', 'host'),
  ('11111111-0000-0000-0000-000000000004', 'user@travel.com',  '__BCRYPT_HASH__', '박지호', '010-3333-4444', 'user'),
  ('11111111-0000-0000-0000-000000000005', 'user2@travel.com', '__BCRYPT_HASH__', '최수아', '010-4444-5555', 'user'),
  ('11111111-0000-0000-0000-000000000006', 'user3@travel.com', '__BCRYPT_HASH__', '정현우', '010-5555-6666', 'user');



CREATE DATABASE IF NOT EXISTS hotel_db CHARACTER SET utf8mb4;
USE hotel_db;

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
) CHARACTER SET utf8mb4;

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
) CHARACTER SET utf8mb4;

CREATE TABLE IF NOT EXISTS wishlists (
  id         VARCHAR(36) PRIMARY KEY,
  user_id    VARCHAR(36) NOT NULL,
  hotel_id   VARCHAR(36) NOT NULL,
  created_at DATETIME    NOT NULL DEFAULT NOW(),
  UNIQUE KEY uq_user_hotel (user_id, hotel_id),
  FOREIGN KEY (hotel_id) REFERENCES hotels(id)
) CHARACTER SET utf8mb4;

CREATE INDEX idx_hotels_city     ON hotels(city);
CREATE INDEX idx_hotels_region   ON hotels(region);
CREATE INDEX idx_hotels_category ON hotels(category);
CREATE INDEX idx_rooms_hotel     ON rooms(hotel_id);
CREATE INDEX idx_wishlists_user  ON wishlists(user_id);

INSERT IGNORE INTO hotels
  (id, host_id, name, description, category, address, city, region,
   latitude, longitude, amenities, images, check_in_time, check_out_time, rating, review_count)
VALUES
  ('22222222-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000002',
   '그랜드 서울 호텔','서울 중심부에 위치한 5성급 럭셔리 호텔. 한강 뷰와 최고급 시설을 자랑합니다.',
   'hotel','서울특별시 중구 을지로 100','서울','서울/경기',37.5665,126.9780,
   '["수영장","스파","피트니스센터","레스토랑","바","주차장","조식포함","와이파이"]',
   '["https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800","https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800"]',
   '15:00','11:00',4.8,234),

  ('22222222-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000002',
   '제주 오션뷰 리조트','제주 해안가에 위치한 프리미엄 리조트. 청정 제주 바다를 한눈에 담을 수 있습니다.',
   'resort','제주특별자치도 서귀포시 중문관광로 100','제주','제주',33.2541,126.4128,
   '["수영장","해변","스파","레스토랑","카페","주차장","조식포함","와이파이","바베큐"]',
   '["https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800"]',
   '15:00','11:00',4.9,456),

  ('22222222-0000-0000-0000-000000000003','11111111-0000-0000-0000-000000000002',
   '부산 해운대 호텔','해운대 해수욕장 바로 앞! 탁 트인 바다 전망과 세련된 인테리어.',
   'hotel','부산광역시 해운대구 해운대해변로 200','부산','부산/경남',35.1583,129.1603,
   '["수영장","레스토랑","바","주차장","와이파이","피트니스센터"]',
   '["https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800"]',
   '14:00','12:00',4.6,187),

  ('22222222-0000-0000-0000-000000000004','11111111-0000-0000-0000-000000000003',
   '강릉 솔향 펜션','강릉 바다와 소나무 숲 사이에 자리한 아늑한 펜션. 자연 속 힐링 여행.',
   'pension','강원특별자치도 강릉시 강동면 정동진리 100','강릉','강원',37.7540,129.0630,
   '["바베큐","주차장","와이파이","바다뷰","취사가능"]',
   '["https://images.unsplash.com/photo-1510798831971-661eb04b3739?w=800"]',
   '15:00','11:00',4.5,89),

  ('22222222-0000-0000-0000-000000000005','11111111-0000-0000-0000-000000000003',
   '경주 한옥 게스트하우스','천년 고도 경주의 전통 한옥에서 즐기는 특별한 하룻밤.',
   'guesthouse','경상북도 경주시 교동 100','경주','대구/경북',35.8420,129.2115,
   '["한옥체험","조식포함","주차장","와이파이","문화체험"]',
   '["https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800"]',
   '16:00','10:00',4.7,123),

  ('22222222-0000-0000-0000-000000000006','11111111-0000-0000-0000-000000000003',
   '여수 밤바다 모텔','여수 밤바다가 보이는 아름다운 숙소. 합리적인 가격의 최고 전망.',
   'motel','전라남도 여수시 돌산읍 돌산로 300','여수','광주/전라',34.7604,127.6622,
   '["바다뷰","주차장","와이파이","에어컨"]',
   '["https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=800"]',
   '14:00','12:00',4.3,67),

  ('22222222-0000-0000-0000-000000000007','11111111-0000-0000-0000-000000000002',
   '속초 설악 글램핑','설악산 국립공원 인근의 프리미엄 글램핑 캠핑장.',
   'camping','강원특별자치도 속초시 설악산로 1000','속초','강원',38.2060,128.5918,
   '["바베큐","취사가능","주차장","와이파이","등산로"]',
   '["https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800"]',
   '14:00','12:00',4.4,45),

  ('22222222-0000-0000-0000-000000000008','11111111-0000-0000-0000-000000000002',
   '인천 공항 비즈니스 호텔','인천국제공항 10분 거리의 편리한 비즈니스 호텔. 무료 셔틀버스 운행.',
   'hotel','인천광역시 중구 공항로 700','인천','서울/경기',37.4602,126.4407,
   '["공항셔틀","주차장","와이파이","레스토랑","피트니스센터","비즈니스센터"]',
   '["https://images.unsplash.com/photo-1598928506311-c55ded91a20c?w=800"]',
   '14:00','12:00',4.2,312),

  ('22222222-0000-0000-0000-000000000009','11111111-0000-0000-0000-000000000003',
   '전주 한옥마을 스테이','전주 한옥마을 내 정통 한옥 숙소. 한복 체험 및 전통 음식 프로그램 운영.',
   'guesthouse','전라북도 전주시 완산구 기린대로 99','전주','광주/전라',35.8200,127.1520,
   '["한옥체험","문화체험","조식포함","주차장","와이파이"]',
   '["https://images.unsplash.com/photo-1578469645742-46cae010e5d4?w=800"]',
   '15:00','11:00',4.6,98),

  ('22222222-0000-0000-0000-000000000010','11111111-0000-0000-0000-000000000002',
   '제주 협재 풀빌라','협재 해변에서 도보 3분! 전용 수영장이 딸린 프라이빗 풀빌라.',
   'resort','제주특별자치도 제주시 한림읍 협재리 100','제주','제주',33.3935,126.2381,
   '["수영장","바다뷰","주차장","와이파이","바베큐","취사가능"]',
   '["https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=800"]',
   '15:00','11:00',4.95,78);

-- 객실 (호텔당 3개: 스탠다드 / 디럭스 / 패밀리)
INSERT IGNORE INTO rooms
  (id, hotel_id, name, description, type, capacity, price_per_night, discount_rate, images, amenities)
VALUES
  -- 그랜드 서울 호텔
  (UUID(),'22222222-0000-0000-0000-000000000001','스탠다드 룸','편안하고 깔끔한 스탠다드 객실','standard',2,89000,0,'["https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800"]','["에어컨","미니바","TV","욕실용품","드라이기"]'),
  (UUID(),'22222222-0000-0000-0000-000000000001','디럭스 룸','넓고 쾌적한 프리미엄 디럭스 객실','deluxe',2,140000,10,'["https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800"]','["에어컨","미니바","TV","욕실용품","드라이기"]'),
  (UUID(),'22222222-0000-0000-0000-000000000001','패밀리 룸','가족 여행에 최적화된 넓은 패밀리 룸','family',4,200000,5,'["https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800"]','["에어컨","미니바","TV","욕실용품","드라이기"]'),
  -- 제주 오션뷰 리조트
  (UUID(),'22222222-0000-0000-0000-000000000002','스탠다드 룸','편안하고 깔끔한 스탠다드 객실','standard',2,75000,0,'["https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800"]','["에어컨","미니바","TV","욕실용품","드라이기"]'),
  (UUID(),'22222222-0000-0000-0000-000000000002','디럭스 룸','넓고 쾌적한 프리미엄 디럭스 객실','deluxe',2,120000,10,'["https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800"]','["에어컨","미니바","TV","욕실용품","드라이기"]'),
  (UUID(),'22222222-0000-0000-0000-000000000002','패밀리 룸','가족 여행에 최적화된 넓은 패밀리 룸','family',4,180000,5,'["https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800"]','["에어컨","미니바","TV","욕실용품","드라이기"]'),
  -- 부산 해운대 호텔
  (UUID(),'22222222-0000-0000-0000-000000000003','스탠다드 룸','편안하고 깔끔한 스탠다드 객실','standard',2,70000,0,'["https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800"]','["에어컨","미니바","TV","욕실용품","드라이기"]'),
  (UUID(),'22222222-0000-0000-0000-000000000003','디럭스 룸','넓고 쾌적한 프리미엄 디럭스 객실','deluxe',2,110000,10,'["https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800"]','["에어컨","미니바","TV","욕실용품","드라이기"]'),
  (UUID(),'22222222-0000-0000-0000-000000000003','패밀리 룸','가족 여행에 최적화된 넓은 패밀리 룸','family',4,170000,5,'["https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800"]','["에어컨","미니바","TV","욕실용품","드라이기"]'),
  -- 강릉 솔향 펜션
  (UUID(),'22222222-0000-0000-0000-000000000004','스탠다드 룸','편안하고 깔끔한 스탠다드 객실','standard',2,65000,0,'["https://images.unsplash.com/photo-1510798831971-661eb04b3739?w=800"]','["에어컨","TV","욕실용품","드라이기"]'),
  (UUID(),'22222222-0000-0000-0000-000000000004','디럭스 룸','넓고 쾌적한 프리미엄 디럭스 객실','deluxe',2,100000,10,'["https://images.unsplash.com/photo-1510798831971-661eb04b3739?w=800"]','["에어컨","TV","욕실용품","드라이기"]'),
  (UUID(),'22222222-0000-0000-0000-000000000004','패밀리 룸','가족 여행에 최적화된 넓은 패밀리 룸','family',4,160000,5,'["https://images.unsplash.com/photo-1510798831971-661eb04b3739?w=800"]','["에어컨","TV","욕실용품","드라이기"]'),
  -- 경주 한옥 게스트하우스
  (UUID(),'22222222-0000-0000-0000-000000000005','스탠다드 룸','편안하고 깔끔한 스탠다드 객실','standard',2,60000,0,'["https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800"]','["에어컨","TV","욕실용품"]'),
  (UUID(),'22222222-0000-0000-0000-000000000005','디럭스 룸','넓고 쾌적한 프리미엄 디럭스 객실','deluxe',2,95000,10,'["https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800"]','["에어컨","TV","욕실용품"]'),
  (UUID(),'22222222-0000-0000-0000-000000000005','패밀리 룸','가족 여행에 최적화된 넓은 패밀리 룸','family',4,150000,5,'["https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800"]','["에어컨","TV","욕실용품"]'),
  -- 여수 밤바다 모텔
  (UUID(),'22222222-0000-0000-0000-000000000006','스탠다드 룸','편안하고 깔끔한 스탠다드 객실','standard',2,55000,0,'["https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=800"]','["에어컨","TV","욕실용품"]'),
  (UUID(),'22222222-0000-0000-0000-000000000006','디럭스 룸','넓고 쾌적한 프리미엄 디럭스 객실','deluxe',2,85000,10,'["https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=800"]','["에어컨","TV","욕실용품"]'),
  (UUID(),'22222222-0000-0000-0000-000000000006','패밀리 룸','가족 여행에 최적화된 넓은 패밀리 룸','family',4,140000,5,'["https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=800"]','["에어컨","TV","욕실용품"]'),
  -- 속초 설악 글램핑
  (UUID(),'22222222-0000-0000-0000-000000000007','스탠다드 룸','편안하고 깔끔한 스탠다드 객실','standard',2,70000,0,'["https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800"]','["에어컨","TV","욕실용품"]'),
  (UUID(),'22222222-0000-0000-0000-000000000007','디럭스 룸','넓고 쾌적한 프리미엄 디럭스 객실','deluxe',2,105000,10,'["https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800"]','["에어컨","TV","욕실용품"]'),
  (UUID(),'22222222-0000-0000-0000-000000000007','패밀리 룸','가족 여행에 최적화된 넓은 패밀리 룸','family',4,165000,5,'["https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800"]','["에어컨","TV","욕실용품"]'),
  -- 인천 공항 비즈니스 호텔
  (UUID(),'22222222-0000-0000-0000-000000000008','스탠다드 룸','편안하고 깔끔한 스탠다드 객실','standard',2,80000,0,'["https://images.unsplash.com/photo-1598928506311-c55ded91a20c?w=800"]','["에어컨","미니바","TV","욕실용품","드라이기"]'),
  (UUID(),'22222222-0000-0000-0000-000000000008','디럭스 룸','넓고 쾌적한 프리미엄 디럭스 객실','deluxe',2,125000,10,'["https://images.unsplash.com/photo-1598928506311-c55ded91a20c?w=800"]','["에어컨","미니바","TV","욕실용품","드라이기"]'),
  (UUID(),'22222222-0000-0000-0000-000000000008','패밀리 룸','가족 여행에 최적화된 넓은 패밀리 룸','family',4,190000,5,'["https://images.unsplash.com/photo-1598928506311-c55ded91a20c?w=800"]','["에어컨","미니바","TV","욕실용품","드라이기"]'),
  -- 전주 한옥마을 스테이
  (UUID(),'22222222-0000-0000-0000-000000000009','스탠다드 룸','편안하고 깔끔한 스탠다드 객실','standard',2,62000,0,'["https://images.unsplash.com/photo-1578469645742-46cae010e5d4?w=800"]','["에어컨","TV","욕실용품"]'),
  (UUID(),'22222222-0000-0000-0000-000000000009','디럭스 룸','넓고 쾌적한 프리미엄 디럭스 객실','deluxe',2,98000,10,'["https://images.unsplash.com/photo-1578469645742-46cae010e5d4?w=800"]','["에어컨","TV","욕실용품"]'),
  (UUID(),'22222222-0000-0000-0000-000000000009','패밀리 룸','가족 여행에 최적화된 넓은 패밀리 룸','family',4,155000,5,'["https://images.unsplash.com/photo-1578469645742-46cae010e5d4?w=800"]','["에어컨","TV","욕실용품"]'),
  -- 제주 협재 풀빌라
  (UUID(),'22222222-0000-0000-0000-000000000010','스탠다드 룸','편안하고 깔끔한 스탠다드 객실','standard',2,95000,0,'["https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=800"]','["에어컨","미니바","TV","욕실용품","드라이기"]'),
  (UUID(),'22222222-0000-0000-0000-000000000010','디럭스 룸','넓고 쾌적한 프리미엄 디럭스 객실','deluxe',2,150000,10,'["https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=800"]','["에어컨","미니바","TV","욕실용품","드라이기"]'),
  (UUID(),'22222222-0000-0000-0000-000000000010','패밀리 룸','가족 여행에 최적화된 넓은 패밀리 룸','family',4,210000,5,'["https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=800"]','["에어컨","미니바","TV","욕실용품","드라이기"]');

-- 위시리스트 (user, user2가 첫 3개 호텔 찜)
INSERT IGNORE INTO wishlists (id, user_id, hotel_id) VALUES
  (UUID(),'11111111-0000-0000-0000-000000000004','22222222-0000-0000-0000-000000000001'),
  (UUID(),'11111111-0000-0000-0000-000000000004','22222222-0000-0000-0000-000000000002'),
  (UUID(),'11111111-0000-0000-0000-000000000004','22222222-0000-0000-0000-000000000003'),
  (UUID(),'11111111-0000-0000-0000-000000000005','22222222-0000-0000-0000-000000000001'),
  (UUID(),'11111111-0000-0000-0000-000000000005','22222222-0000-0000-0000-000000000002'),
  (UUID(),'11111111-0000-0000-0000-000000000005','22222222-0000-0000-0000-000000000003');

-- ── booking_db ───────────────────────────────────────────────
CREATE DATABASE IF NOT EXISTS booking_db CHARACTER SET utf8mb4;
USE booking_db;

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
) CHARACTER SET utf8mb4;

CREATE INDEX idx_bookings_user  ON bookings(user_id);
CREATE INDEX idx_bookings_hotel ON bookings(hotel_id);
CREATE INDEX idx_bookings_room  ON bookings(room_id);

INSERT IGNORE INTO bookings
  (id, user_id, host_id, hotel_id, hotel_name, hotel_address,
   room_id, room_name, room_type, check_in_date, check_out_date,
   guests, total_price, status)
VALUES
  ('33333333-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000004','11111111-0000-0000-0000-000000000002',
   '22222222-0000-0000-0000-000000000001','그랜드 서울 호텔','서울특별시 중구 을지로 100',
   UUID(),'디럭스 룸','deluxe','2025-01-15','2025-01-17',2,220000,'completed'),

  ('33333333-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000004','11111111-0000-0000-0000-000000000002',
   '22222222-0000-0000-0000-000000000002','제주 오션뷰 리조트','제주특별자치도 서귀포시 중문관광로 100',
   UUID(),'스탠다드 룸','standard','2025-02-10','2025-02-13',2,255000,'completed'),

  ('33333333-0000-0000-0000-000000000003','11111111-0000-0000-0000-000000000005','11111111-0000-0000-0000-000000000002',
   '22222222-0000-0000-0000-000000000003','부산 해운대 호텔','부산광역시 해운대구 해운대해변로 200',
   UUID(),'패밀리 룸','family','2025-03-05','2025-03-07',4,360000,'completed'),

  (UUID(),'11111111-0000-0000-0000-000000000004','11111111-0000-0000-0000-000000000002',
   '22222222-0000-0000-0000-000000000001','그랜드 서울 호텔','서울특별시 중구 을지로 100',
   UUID(),'스탠다드 룸','standard','2026-06-01','2026-06-03',2,160000,'confirmed'),

  (UUID(),'11111111-0000-0000-0000-000000000006','11111111-0000-0000-0000-000000000003',
   '22222222-0000-0000-0000-000000000004','강릉 솔향 펜션','강원특별자치도 강릉시 강동면 정동진리 100',
   UUID(),'패밀리 룸','family','2025-04-20','2025-04-22',3,310000,'completed'),

  (UUID(),'11111111-0000-0000-0000-000000000005','11111111-0000-0000-0000-000000000003',
   '22222222-0000-0000-0000-000000000005','경주 한옥 게스트하우스','경상북도 경주시 교동 100',
   UUID(),'스탠다드 룸','standard','2025-05-10','2025-05-12',2,140000,'cancelled');

-- ── review_db ─────────────────────────────────────────────────
CREATE DATABASE IF NOT EXISTS review_db CHARACTER SET utf8mb4;
USE review_db;

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
) CHARACTER SET utf8mb4;

CREATE INDEX idx_reviews_hotel ON reviews(hotel_id);
CREATE INDEX idx_reviews_user  ON reviews(user_id);

INSERT IGNORE INTO reviews
  (id, user_id, user_name, hotel_id, booking_id, rating, title, content, images)
VALUES
  (UUID(),'11111111-0000-0000-0000-000000000004','박지호','22222222-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000001',5,'완벽한 서울 여행!','한강 뷰가 정말 환상적이었습니다. 직원들도 너무 친절하고 시설도 깔끔했어요. 다음에 또 오고 싶은 호텔입니다.','[]'),
  (UUID(),'11111111-0000-0000-0000-000000000004','박지호','22222222-0000-0000-0000-000000000002','33333333-0000-0000-0000-000000000002',5,'제주 최고의 리조트','제주에서 묵어본 숙소 중 단연 최고입니다. 오션뷰 방에서 일출을 보는 경험은 평생 잊지 못할 것 같아요. 수영장도 크고 깨끗했어요.','[]'),
  (UUID(),'11111111-0000-0000-0000-000000000005','최수아','22222222-0000-0000-0000-000000000003','33333333-0000-0000-0000-000000000003',4,'해운대 전망 최고!','해운대 바다가 바로 보이는 방이 정말 좋았습니다. 조금 가격이 있지만 그만한 가치가 있어요. 조식도 맛있었습니다.','[]'),
  (UUID(),'11111111-0000-0000-0000-000000000006','정현우','22222222-0000-0000-0000-000000000001',UUID(),4,'비즈니스 출장에 완벽한 호텔','회의실 시설이 훌륭하고 접근성도 좋았습니다. 객실 청결도 만점이고 어메니티도 고급스러웠어요.','[]'),
  (UUID(),'11111111-0000-0000-0000-000000000005','최수아','22222222-0000-0000-0000-000000000002',UUID(),5,'허니문에 완벽한 리조트','신혼여행으로 왔는데 정말 낭만적이었어요! 스파도 너무 좋고 저녁 노을이 방에서 보이는 게 환상적이었습니다. 강추!','[]'),
  (UUID(),'11111111-0000-0000-0000-000000000004','박지호','22222222-0000-0000-0000-000000000004',UUID(),4,'자연 속에서 힐링','소나무 숲과 바다 소리를 들으며 정말 힐링됐어요. 바베큐도 맛있고 주인분이 친절하셨습니다.','[]'),
  (UUID(),'11111111-0000-0000-0000-000000000006','정현우','22222222-0000-0000-0000-000000000005',UUID(),5,'경주 여행의 절정!','한옥에서 하룻밤 자는 경험이 너무 특별했어요. 아침에 제공되는 한식 아침도 맛있고, 역사 도시 경주를 느낄 수 있었습니다.','[]'),
  (UUID(),'11111111-0000-0000-0000-000000000005','최수아','22222222-0000-0000-0000-000000000001',UUID(),3,'가격 대비 아쉬운 부분도 있어요','전체적으로 좋은 호텔이지만 가격이 좀 비싼 편이에요. 조식 퀄리티는 좋았고 위치는 최고였습니다.','[]');
