import bcrypt from 'bcryptjs';
import pool from './models/pool';
import { initializeDatabase } from './models/database';

// ── 고정 UUID (다른 서비스 시드와 공유) ──────────────────────────────────────
export const SEED_ADMIN_ID  = '11111111-0000-0000-0000-000000000001';
export const SEED_HOST_ID   = '11111111-0000-0000-0000-000000000002';
export const SEED_HOST2_ID  = '11111111-0000-0000-0000-000000000003';
export const SEED_USER_ID   = '11111111-0000-0000-0000-000000000004';
export const SEED_USER2_ID  = '11111111-0000-0000-0000-000000000005';
export const SEED_USER3_ID  = '11111111-0000-0000-0000-000000000006';

async function seed() {
  await initializeDatabase();
  console.log('🌱 auth_db 시드 데이터 입력 중...');

  const pw = await bcrypt.hash('password123', 10);

  const users = [
    [SEED_ADMIN_ID,  'admin@travel.com',  pw, '관리자',   '010-0000-0000', 'admin'],
    [SEED_HOST_ID,   'host@travel.com',   pw, '김민준',   '010-1111-2222', 'host'],
    [SEED_HOST2_ID,  'host2@travel.com',  pw, '이서연',   '010-2222-3333', 'host'],
    [SEED_USER_ID,   'user@travel.com',   pw, '박지호',   '010-3333-4444', 'user'],
    [SEED_USER2_ID,  'user2@travel.com',  pw, '최수아',   '010-4444-5555', 'user'],
    [SEED_USER3_ID,  'user3@travel.com',  pw, '정현우',   '010-5555-6666', 'user'],
  ];

  for (const u of users) {
    await pool.query(
      `INSERT IGNORE INTO users (id, email, password, name, phone, role) VALUES (?, ?, ?, ?, ?, ?)`,
      u
    );
  }

  console.log('✅ auth_db 시드 완료');
  console.log('   admin@travel.com / password123 (관리자)');
  console.log('   host@travel.com  / password123 (호스트)');
  console.log('   user@travel.com  / password123 (사용자)');
  await pool.end();
}

seed().catch(e => { console.error(e); process.exit(1); });
