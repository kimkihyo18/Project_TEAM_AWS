import pool from './models/pool';
import { initializeDatabase } from './models/database';
import { v4 as uuidv4 } from 'uuid';

// ── 공유 UUID ─────────────────────────────────────────────────────────────────
const USER_ID  = '11111111-0000-0000-0000-000000000004';
const USER2_ID = '11111111-0000-0000-0000-000000000005';
const USER3_ID = '11111111-0000-0000-0000-000000000006';

const H1 = '22222222-0000-0000-0000-000000000001';
const H2 = '22222222-0000-0000-0000-000000000002';
const H3 = '22222222-0000-0000-0000-000000000003';
const H4 = '22222222-0000-0000-0000-000000000004';
const H5 = '22222222-0000-0000-0000-000000000005';

const B1 = '33333333-0000-0000-0000-000000000001';
const B2 = '33333333-0000-0000-0000-000000000002';
const B3 = '33333333-0000-0000-0000-000000000003';

async function seed() {
  await initializeDatabase();
  console.log('🌱 review_db 시드 데이터 입력 중...');

  const reviews = [
    {
      id: uuidv4(), userId: USER_ID, userName: '박지호',
      hotelId: H1, bookingId: B1, rating: 5,
      title: '완벽한 서울 여행!',
      content: '한강 뷰가 정말 환상적이었습니다. 직원들도 너무 친절하고 시설도 깔끔했어요. 다음에 또 오고 싶은 호텔입니다.',
      images: [],
    },
    {
      id: uuidv4(), userId: USER_ID, userName: '박지호',
      hotelId: H2, bookingId: B2, rating: 5,
      title: '제주 최고의 리조트',
      content: '제주에서 묵어본 숙소 중 단연 최고입니다. 오션뷰 방에서 일출을 보는 경험은 평생 잊지 못할 것 같아요. 수영장도 크고 깨끗했어요.',
      images: [],
    },
    {
      id: uuidv4(), userId: USER2_ID, userName: '최수아',
      hotelId: H3, bookingId: B3, rating: 4,
      title: '해운대 전망 최고!',
      content: '해운대 바다가 바로 보이는 방이 정말 좋았습니다. 조금 가격이 있지만 그만한 가치가 있어요. 조식도 맛있었습니다.',
      images: [],
    },
    {
      id: uuidv4(), userId: USER3_ID, userName: '정현우',
      hotelId: H1, bookingId: uuidv4(), rating: 4,
      title: '비즈니스 출장에 완벽한 호텔',
      content: '회의실 시설이 훌륭하고 접근성도 좋았습니다. 객실 청결도 만점이고 어메니티도 고급스러웠어요.',
      images: [],
    },
    {
      id: uuidv4(), userId: USER2_ID, userName: '최수아',
      hotelId: H2, bookingId: uuidv4(), rating: 5,
      title: '허니문에 완벽한 리조트',
      content: '신혼여행으로 왔는데 정말 낭만적이었어요! 스파도 너무 좋고 저녁 노을이 방에서 보이는 게 환상적이었습니다. 강추!',
      images: [],
    },
    {
      id: uuidv4(), userId: USER_ID, userName: '박지호',
      hotelId: H4, bookingId: uuidv4(), rating: 4,
      title: '자연 속에서 힐링',
      content: '소나무 숲과 바다 소리를 들으며 정말 힐링됐어요. 바베큐도 맛있고 주인분이 친절하셨습니다.',
      images: [],
    },
    {
      id: uuidv4(), userId: USER3_ID, userName: '정현우',
      hotelId: H5, bookingId: uuidv4(), rating: 5,
      title: '경주 여행의 절정!',
      content: '한옥에서 하룻밤 자는 경험이 너무 특별했어요. 아침에 제공되는 한식 아침도 맛있고, 역사 도시 경주를 느낄 수 있었습니다.',
      images: [],
    },
    {
      id: uuidv4(), userId: USER2_ID, userName: '최수아',
      hotelId: H1, bookingId: uuidv4(), rating: 3,
      title: '가격 대비 아쉬운 부분도 있어요',
      content: '전체적으로 좋은 호텔이지만 가격이 좀 비싼 편이에요. 조식 퀄리티는 좋았고 위치는 최고였습니다.',
      images: [],
    },
  ];

  for (const r of reviews) {
    await pool.query(
      `INSERT IGNORE INTO reviews
         (id, user_id, user_name, hotel_id, booking_id, rating, title, content, images)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [r.id, r.userId, r.userName, r.hotelId, r.bookingId, r.rating, r.title, r.content, JSON.stringify(r.images)]
    );
  }

  console.log(`✅ review_db 시드 완료: ${reviews.length}개 리뷰`);
  await pool.end();
}

seed().catch(e => { console.error(e); process.exit(1); });
