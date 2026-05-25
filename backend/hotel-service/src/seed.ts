import pool from './models/pool';
import { initializeDatabase } from './models/database';
import { v4 as uuidv4 } from 'uuid';

// ── 공유 UUID (auth-service seed와 동일) ─────────────────────────────────────
const HOST_ID  = '11111111-0000-0000-0000-000000000002';
const HOST2_ID = '11111111-0000-0000-0000-000000000003';
const USER_ID  = '11111111-0000-0000-0000-000000000004';
const USER2_ID = '11111111-0000-0000-0000-000000000005';

// 고정 Hotel/Room UUID (booking, review seed에서 참조)
export const SEED_HOTELS = [
  { id: '22222222-0000-0000-0000-000000000001', hostId: HOST_ID, name: '그랜드 서울 호텔',
    desc: '서울 중심부에 위치한 5성급 럭셔리 호텔. 한강 뷰와 최고급 시설을 자랑합니다.',
    cat: 'hotel', addr: '서울특별시 중구 을지로 100', city: '서울', region: '서울/경기',
    lat: 37.5665, lng: 126.9780, ci: '15:00', co: '11:00', rating: 4.8, rc: 234,
    amenities: ['수영장','스파','피트니스센터','레스토랑','바','주차장','조식포함','와이파이'],
    images: ['https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800','https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800'] },

  { id: '22222222-0000-0000-0000-000000000002', hostId: HOST_ID, name: '제주 오션뷰 리조트',
    desc: '제주 해안가에 위치한 프리미엄 리조트. 청정 제주 바다를 한눈에 담을 수 있습니다.',
    cat: 'resort', addr: '제주특별자치도 서귀포시 중문관광로 100', city: '제주', region: '제주',
    lat: 33.2541, lng: 126.4128, ci: '15:00', co: '11:00', rating: 4.9, rc: 456,
    amenities: ['수영장','해변','스파','레스토랑','카페','주차장','조식포함','와이파이','바베큐'],
    images: ['https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800'] },

  { id: '22222222-0000-0000-0000-000000000003', hostId: HOST_ID, name: '부산 해운대 호텔',
    desc: '해운대 해수욕장 바로 앞! 탁 트인 바다 전망과 세련된 인테리어.',
    cat: 'hotel', addr: '부산광역시 해운대구 해운대해변로 200', city: '부산', region: '부산/경남',
    lat: 35.1583, lng: 129.1603, ci: '14:00', co: '12:00', rating: 4.6, rc: 187,
    amenities: ['수영장','레스토랑','바','주차장','와이파이','피트니스센터'],
    images: ['https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800'] },

  { id: '22222222-0000-0000-0000-000000000004', hostId: HOST2_ID, name: '강릉 솔향 펜션',
    desc: '강릉 바다와 소나무 숲 사이에 자리한 아늑한 펜션. 자연 속 힐링 여행.',
    cat: 'pension', addr: '강원특별자치도 강릉시 강동면 정동진리 100', city: '강릉', region: '강원',
    lat: 37.7540, lng: 129.0630, ci: '15:00', co: '11:00', rating: 4.5, rc: 89,
    amenities: ['바베큐','주차장','와이파이','바다뷰','취사가능'],
    images: ['https://images.unsplash.com/photo-1510798831971-661eb04b3739?w=800'] },

  { id: '22222222-0000-0000-0000-000000000005', hostId: HOST2_ID, name: '경주 한옥 게스트하우스',
    desc: '천년 고도 경주의 전통 한옥에서 즐기는 특별한 하룻밤.',
    cat: 'guesthouse', addr: '경상북도 경주시 교동 100', city: '경주', region: '대구/경북',
    lat: 35.8420, lng: 129.2115, ci: '16:00', co: '10:00', rating: 4.7, rc: 123,
    amenities: ['한옥체험','조식포함','주차장','와이파이','문화체험'],
    images: ['https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800'] },

  { id: '22222222-0000-0000-0000-000000000006', hostId: HOST2_ID, name: '여수 밤바다 모텔',
    desc: '여수 밤바다가 보이는 아름다운 숙소. 합리적인 가격의 최고 전망.',
    cat: 'motel', addr: '전라남도 여수시 돌산읍 돌산로 300', city: '여수', region: '광주/전라',
    lat: 34.7604, lng: 127.6622, ci: '14:00', co: '12:00', rating: 4.3, rc: 67,
    amenities: ['바다뷰','주차장','와이파이','에어컨'],
    images: ['https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=800'] },

  { id: '22222222-0000-0000-0000-000000000007', hostId: HOST_ID, name: '속초 설악 글램핑',
    desc: '설악산 국립공원 인근의 프리미엄 글램핑 캠핑장.',
    cat: 'camping', addr: '강원특별자치도 속초시 설악산로 1000', city: '속초', region: '강원',
    lat: 38.2060, lng: 128.5918, ci: '14:00', co: '12:00', rating: 4.4, rc: 45,
    amenities: ['바베큐','취사가능','주차장','와이파이','등산로'],
    images: ['https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800'] },

  { id: '22222222-0000-0000-0000-000000000008', hostId: HOST_ID, name: '인천 공항 비즈니스 호텔',
    desc: '인천국제공항 10분 거리의 편리한 비즈니스 호텔. 무료 셔틀버스 운행.',
    cat: 'hotel', addr: '인천광역시 중구 공항로 700', city: '인천', region: '서울/경기',
    lat: 37.4602, lng: 126.4407, ci: '14:00', co: '12:00', rating: 4.2, rc: 312,
    amenities: ['공항셔틀','주차장','와이파이','레스토랑','피트니스센터','비즈니스센터'],
    images: ['https://images.unsplash.com/photo-1598928506311-c55ded91a20c?w=800'] },

  { id: '22222222-0000-0000-0000-000000000009', hostId: HOST2_ID, name: '전주 한옥마을 스테이',
    desc: '전주 한옥마을 내 정통 한옥 숙소. 한복 체험 및 전통 음식 프로그램 운영.',
    cat: 'guesthouse', addr: '전라북도 전주시 완산구 기린대로 99', city: '전주', region: '광주/전라',
    lat: 35.8200, lng: 127.1520, ci: '15:00', co: '11:00', rating: 4.6, rc: 98,
    amenities: ['한옥체험','문화체험','조식포함','주차장','와이파이'],
    images: ['https://images.unsplash.com/photo-1578469645742-46cae010e5d4?w=800'] },

  { id: '22222222-0000-0000-0000-000000000010', hostId: HOST_ID, name: '제주 협재 풀빌라',
    desc: '협재 해변에서 도보 3분! 전용 수영장이 딸린 프라이빗 풀빌라.',
    cat: 'resort', addr: '제주특별자치도 제주시 한림읍 협재리 100', city: '제주', region: '제주',
    lat: 33.3935, lng: 126.2381, ci: '15:00', co: '11:00', rating: 4.95, rc: 78,
    amenities: ['수영장','바다뷰','주차장','와이파이','바베큐','취사가능'],
    images: ['https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=800'] },
];

async function seed() {
  await initializeDatabase();
  console.log('🌱 hotel_db 시드 데이터 입력 중...');

  for (const h of SEED_HOTELS) {
    await pool.query(
      `INSERT IGNORE INTO hotels
         (id, host_id, name, description, category, address, city, region,
          latitude, longitude, amenities, images, check_in_time, check_out_time, rating, review_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        h.id, h.hostId, h.name, h.desc, h.cat,
        h.addr, h.city, h.region, h.lat, h.lng,
        JSON.stringify(h.amenities), JSON.stringify(h.images),
        h.ci, h.co, h.rating, h.rc,
      ]
    );

    // 각 호텔에 3개 객실 등록
    const rooms = [
      { name: '스탠다드 룸', desc: '편안하고 깔끔한 스탠다드 객실', type: 'standard', cap: 2,
        price: Math.floor(Math.random() * 40000) + 60000, disc: 0 },
      { name: '디럭스 룸',   desc: '넓고 쾌적한 프리미엄 디럭스 객실', type: 'deluxe',   cap: 2,
        price: Math.floor(Math.random() * 60000) + 100000, disc: 10 },
      { name: '패밀리 룸',   desc: '가족 여행에 최적화된 넓은 패밀리 룸', type: 'family',  cap: 4,
        price: Math.floor(Math.random() * 80000) + 150000, disc: 5 },
    ];

    for (const r of rooms) {
      await pool.query(
        `INSERT IGNORE INTO rooms
           (id, hotel_id, name, description, type, capacity, price_per_night, discount_rate, images, amenities)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(), h.id, r.name, r.desc, r.type, r.cap, r.price, r.disc,
          JSON.stringify(h.images.slice(0, 1)),
          JSON.stringify(['에어컨','미니바','TV','욕실용품','드라이기']),
        ]
      );
    }

    // 위시리스트: user들이 첫 3개 호텔 찜
    if (['22222222-0000-0000-0000-000000000001',
         '22222222-0000-0000-0000-000000000002',
         '22222222-0000-0000-0000-000000000003'].includes(h.id)) {
      for (const userId of [USER_ID, USER2_ID]) {
        await pool.query(
          `INSERT IGNORE INTO wishlists (id, user_id, hotel_id) VALUES (UUID(), ?, ?)`,
          [userId, h.id]
        );
      }
    }
  }

  console.log(`✅ hotel_db 시드 완료: ${SEED_HOTELS.length}개 호텔, ${SEED_HOTELS.length * 3}개 객실`);
  await pool.end();
}

seed().catch(e => { console.error(e); process.exit(1); });
