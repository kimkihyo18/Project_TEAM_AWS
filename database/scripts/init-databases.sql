-- 마이크로서비스 DB 초기화 스크립트
-- 각 서비스의 app.ts에서 CREATE TABLE IF NOT EXISTS로 테이블을 생성합니다.

CREATE DATABASE IF NOT EXISTS auth_db    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS hotel_db   CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS booking_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS review_db  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 각 서비스가 자신의 DB에 접근할 수 있도록 권한 부여
GRANT ALL PRIVILEGES ON auth_db.*    TO 'root'@'%';
GRANT ALL PRIVILEGES ON hotel_db.*   TO 'root'@'%';
GRANT ALL PRIVILEGES ON booking_db.* TO 'root'@'%';
GRANT ALL PRIVILEGES ON review_db.*  TO 'root'@'%';
FLUSH PRIVILEGES;
