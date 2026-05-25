import pool from './models/pool';
import { initializeDatabase } from './models/database';
import { v4 as uuidv4 } from 'uuid';

// ── 공유 UUID ─────────────────────────────────────────────────────────────────
const USER_ID  = '11111111-0000-0000-0000-000000000004';
const USER2_ID = '11111111-0000-0000-0000-000000000005';
const USER3_ID = '11111111-0000-0000-0000-000000000006';
const HOST_ID  = '11111111-0000-0000-0000-000000000002';
const HOST2_ID = '11111111-0000-0000-0000-000000000003';

const H1 = '22222222-0000-0000-0000-000000000001'; // 그랜드 서울 호텔
const H2 = '22222222-0000-0000-0000-000000000002'; // 제주 오션뷰 리조트
const H3 = '22222222-0000-0000-0000-000000000003'; // 부산 해운대 호텔

// 고정 Booking UUID (review seed에서 참조)
export const SEED_BOOKING_1 = '33333333-0000-0000-0000-000000000001';
export const SEED_BOOKING_2 = '33333333-0000-0000-0000-000000000002';
export const SEED_BOOKING_3 = '33333333-0000-0000-0000-000000000003';

async function seed() {
  await initializeDatabase();
  console.log('🌱 booking_db 시드 데이터 입력 중...');

  const bookings = [
    {
      id: SEED_BOOKING_1, userId: USER_ID, hostId: HOST_ID,
      hotelId: H1, hotelName: '그랜드 서울 호텔', hotelAddress: '서울특별시 중구 을지로 100',
      roomId: uuidv4(), roomName: '디럭스 룸', roomType: 'deluxe',
      checkIn: '2025-01-15', checkOut: '2025-01-17', guests: 2,
      price: 220000, status: 'completed',
    },
    {
      id: SEED_BOOKING_2, userId: USER_ID, hostId: HOST_ID,
      hotelId: H2, hotelName: '제주 오션뷰 리조트', hotelAddress: '제주특별자치도 서귀포시 중문관광로 100',
      roomId: uuidv4(), roomName: '스탠다드 룸', roomType: 'standard',
      checkIn: '2025-02-10', checkOut: '2025-02-13', guests: 2,
      price: 255000, status: 'completed',
    },
    {
      id: SEED_BOOKING_3, userId: USER2_ID, hostId: HOST_ID,
      hotelId: H3, hotelName: '부산 해운대 호텔', hotelAddress: '부산광역시 해운대구 해운대해변로 200',
      roomId: uuidv4(), roomName: '패밀리 룸', roomType: 'family',
      checkIn: '2025-03-05', checkOut: '2025-03-07', guests: 4,
      price: 360000, status: 'completed',
    },
    {
      id: uuidv4(), userId: USER_ID, hostId: HOST_ID,
      hotelId: H1, hotelName: '그랜드 서울 호텔', hotelAddress: '서울특별시 중구 을지로 100',
      roomId: uuidv4(), roomName: '스탠다드 룸', roomType: 'standard',
      checkIn: '2026-06-01', checkOut: '2026-06-03', guests: 2,
      price: 160000, status: 'confirmed',
    },
    {
      id: uuidv4(), userId: USER3_ID, hostId: HOST2_ID,
      hotelId: '22222222-0000-0000-0000-000000000004',
      hotelName: '강릉 솔향 펜션', hotelAddress: '강원특별자치도 강릉시 강동면 정동진리 100',
      roomId: uuidv4(), roomName: '패밀리 룸', roomType: 'family',
      checkIn: '2025-04-20', checkOut: '2025-04-22', guests: 3,
      price: 310000, status: 'completed',
    },
    {
      id: uuidv4(), userId: USER2_ID, hostId: HOST2_ID,
      hotelId: '22222222-0000-0000-0000-000000000005',
      hotelName: '경주 한옥 게스트하우스', hotelAddress: '경상북도 경주시 교동 100',
      roomId: uuidv4(), roomName: '스탠다드 룸', roomType: 'standard',
      checkIn: '2025-05-10', checkOut: '2025-05-12', guests: 2,
      price: 140000, status: 'cancelled',
    },
  ];

  for (const b of bookings) {
    await pool.query(
      `INSERT IGNORE INTO bookings
         (id, user_id, host_id, hotel_id, hotel_name, hotel_address,
          room_id, room_name, room_type, check_in_date, check_out_date,
          guests, total_price, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        b.id, b.userId, b.hostId, b.hotelId, b.hotelName, b.hotelAddress,
        b.roomId, b.roomName, b.roomType, b.checkIn, b.checkOut,
        b.guests, b.price, b.status,
      ]
    );
  }

  console.log(`✅ booking_db 시드 완료: ${bookings.length}개 예약`);
  await pool.end();
}

seed().catch(e => { console.error(e); process.exit(1); });
