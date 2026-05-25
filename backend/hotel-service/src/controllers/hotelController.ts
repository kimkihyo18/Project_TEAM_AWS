import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { RowDataPacket } from 'mysql2';
import pool from '../models/pool';
import { translateFields } from '../services/translateService';
import { Hotel, Room, SearchQuery } from '../types';
import logger from '../utils/logger';

export async function searchHotels(req: Request, res: Response): Promise<void> {
  try {
    const {
      city, region, category,
      guests, min_price, max_price, sort_by = 'popular',
      page = 1, limit = 10, lang = 'ko',
    } = req.query as unknown as SearchQuery & { lang?: string };

    let query = `
      SELECT h.*,
        MIN(r.price_per_night * (1 - r.discount_rate / 100)) as min_price,
        GROUP_CONCAT(DISTINCT r.id) as room_ids
      FROM hotels h
      LEFT JOIN rooms r ON h.id = r.hotel_id AND r.is_available = 1
      WHERE h.is_active = 1
    `;
    const params: (string | number)[] = [];

    if (city)     { query += ` AND h.city LIKE ?`;     params.push(`%${city}%`); }
    if (region)   { query += ` AND h.region LIKE ?`;   params.push(`%${region}%`); }
    if (category) { query += ` AND h.category = ?`;    params.push(category); }

    if (guests) {
      query += ` AND h.id IN (SELECT hotel_id FROM rooms WHERE capacity >= ? AND is_available = 1)`;
      params.push(Number(guests));
    }

    query += ` GROUP BY h.id`;

    if (min_price) { query += ` HAVING min_price >= ?`;                             params.push(Number(min_price)); }
    if (max_price) { query += ` ${min_price ? 'AND' : 'HAVING'} min_price <= ?`;   params.push(Number(max_price)); }

    switch (sort_by) {
      case 'price_asc':  query += ' ORDER BY min_price ASC';  break;
      case 'price_desc': query += ' ORDER BY min_price DESC'; break;
      case 'rating':     query += ' ORDER BY h.rating DESC';  break;
      default:           query += ' ORDER BY h.review_count DESC, h.rating DESC';
    }

    const offset = (Number(page) - 1) * Number(limit);
    query += ` LIMIT ? OFFSET ?`;
    params.push(Number(limit), offset);

    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    const hotels = rows as (Hotel & { min_price: number })[];

    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(DISTINCT h.id) as total FROM hotels h WHERE h.is_active = 1
       ${city     ? `AND h.city LIKE ?`     : ''}
       ${region   ? `AND h.region LIKE ?`   : ''}
       ${category ? `AND h.category = ?`    : ''}`,
      [
        ...(city     ? [`%${city}%`]  : []),
        ...(region   ? [`%${region}%`]: []),
        ...(category ? [category]     : []),
      ]
    );
    const total = (countRows[0] as { total: number }).total;

    let result = hotels.map(h => ({
      ...h,
      amenities: typeof h.amenities === 'string' ? JSON.parse(h.amenities) : h.amenities,
      images:    typeof h.images    === 'string' ? JSON.parse(h.images)    : h.images,
      is_active: Boolean(h.is_active),
    }));

    result = await translateFields(result, ['name', 'description'], lang ?? 'ko') as typeof result;

    res.json({
      success: true,
      data: {
        hotels: result,
        pagination: { total, page: Number(page), limit: Number(limit), total_pages: Math.ceil(total / Number(limit)) },
      },
    });
  } catch (error) {
    logger.error('Search hotels error', { error });
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
}

export async function getHotelById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const lang   = (req.query.lang as string) || 'ko';

    const [hotelRows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM hotels WHERE id = ? AND is_active = 1', [id]
    );
    const hotel = (hotelRows as RowDataPacket[])[0] as Hotel | undefined;
    if (!hotel) {
      res.status(404).json({ success: false, message: '숙소를 찾을 수 없습니다.' });
      return;
    }

    const [roomRows] = await pool.query<RowDataPacket[]>('SELECT * FROM rooms WHERE hotel_id = ?', [id]);
    const rooms      = roomRows as Room[];

    let hotelData: any = {
      ...hotel,
      amenities: typeof hotel.amenities === 'string' ? JSON.parse(hotel.amenities) : hotel.amenities,
      images:    typeof hotel.images    === 'string' ? JSON.parse(hotel.images)    : hotel.images,
      is_active: Boolean(hotel.is_active),
      rooms: rooms.map(r => ({
        ...r,
        amenities:        typeof r.amenities === 'string' ? JSON.parse(r.amenities) : r.amenities,
        images:           typeof r.images    === 'string' ? JSON.parse(r.images)    : r.images,
        is_available:     Boolean(r.is_available),
        discounted_price: Number(r.price_per_night) * (1 - Number(r.discount_rate) / 100),
      })),
    };

    [hotelData] = await translateFields([hotelData], ['name', 'description'], lang);

    res.json({ success: true, data: hotelData });
  } catch (error) {
    logger.error('Get hotel error', { error });
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
}

export async function createHotel(req: Request, res: Response): Promise<void> {
  try {
    const {
      name, description, category, address, city, region,
      latitude, longitude, amenities = [], images = [],
      check_in_time = '15:00', check_out_time = '11:00',
    } = req.body;

    if (!name || !description || !category || !address || !city || !region) {
      res.status(400).json({ success: false, message: '필수 정보를 모두 입력해주세요.' });
      return;
    }

    const hotelId = uuidv4();
    await pool.query(
      `INSERT INTO hotels (id, host_id, name, description, category, address, city, region,
        latitude, longitude, amenities, images, check_in_time, check_out_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        hotelId, req.user!.userId, name, description, category,
        address, city, region, latitude ?? null, longitude ?? null,
        JSON.stringify(amenities), JSON.stringify(images),
        check_in_time, check_out_time,
      ]
    );

    res.status(201).json({ success: true, message: '숙소가 등록되었습니다.', data: { id: hotelId } });
  } catch (error) {
    logger.error('Create hotel error', { error });
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
}

export async function updateHotel(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM hotels WHERE id = ?', [id]);
    const hotel  = (rows as RowDataPacket[])[0] as Hotel | undefined;
    if (!hotel) {
      res.status(404).json({ success: false, message: '숙소를 찾을 수 없습니다.' });
      return;
    }
    if (hotel.host_id !== req.user!.userId && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, message: '권한이 없습니다.' });
      return;
    }

    const { name, description, address, amenities, images, check_in_time, check_out_time, is_active } = req.body;

    await pool.query(
      `UPDATE hotels SET
        name           = COALESCE(?, name),
        description    = COALESCE(?, description),
        address        = COALESCE(?, address),
        amenities      = COALESCE(?, amenities),
        images         = COALESCE(?, images),
        check_in_time  = COALESCE(?, check_in_time),
        check_out_time = COALESCE(?, check_out_time),
        is_active      = COALESCE(?, is_active)
       WHERE id = ?`,
      [
        name ?? null, description ?? null, address ?? null,
        amenities ? JSON.stringify(amenities) : null,
        images    ? JSON.stringify(images)    : null,
        check_in_time ?? null, check_out_time ?? null,
        is_active !== undefined ? (is_active ? 1 : 0) : null,
        id,
      ]
    );

    res.json({ success: true, message: '숙소 정보가 업데이트되었습니다.' });
  } catch (error) {
    logger.error('Update hotel error', { error });
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
}

export async function getRoomById(req: Request, res: Response): Promise<void> {
  try {
    const { hotelId, roomId } = req.params;
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM rooms WHERE id = ? AND hotel_id = ?', [roomId, hotelId]
    );
    const room = (rows as RowDataPacket[])[0] as Room | undefined;
    if (!room) {
      res.status(404).json({ success: false, message: '객실을 찾을 수 없습니다.' });
      return;
    }

    res.json({
      success: true,
      data: {
        ...room,
        amenities:        typeof room.amenities === 'string' ? JSON.parse(room.amenities) : room.amenities,
        images:           typeof room.images    === 'string' ? JSON.parse(room.images)    : room.images,
        is_available:     Boolean(room.is_available),
        discounted_price: Number(room.price_per_night) * (1 - Number(room.discount_rate) / 100),
      },
    });
  } catch (error) {
    logger.error('Get room error', { error });
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
}

export async function createRoom(req: Request, res: Response): Promise<void> {
  try {
    const { hotelId } = req.params;

    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM hotels WHERE id = ?', [hotelId]);
    const hotel  = (rows as RowDataPacket[])[0] as Hotel | undefined;
    if (!hotel) {
      res.status(404).json({ success: false, message: '숙소를 찾을 수 없습니다.' });
      return;
    }
    if (hotel.host_id !== req.user!.userId && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, message: '권한이 없습니다.' });
      return;
    }

    const { name, description, type, capacity, price_per_night, discount_rate = 0, images = [], amenities = [] } = req.body;
    if (!name || !description || !type || !capacity || !price_per_night) {
      res.status(400).json({ success: false, message: '필수 정보를 모두 입력해주세요.' });
      return;
    }

    const roomId = uuidv4();
    await pool.query(
      `INSERT INTO rooms (id, hotel_id, name, description, type, capacity, price_per_night, discount_rate, images, amenities)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [roomId, hotelId, name, description, type, capacity, price_per_night, discount_rate, JSON.stringify(images), JSON.stringify(amenities)]
    );

    res.status(201).json({ success: true, message: '객실이 등록되었습니다.', data: { id: roomId } });
  } catch (error) {
    logger.error('Create room error', { error });
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
}

export async function getFeaturedHotels(req: Request, res: Response): Promise<void> {
  try {
    const lang = (req.query.lang as string) || 'ko';

    const [rows] = await pool.query<RowDataPacket[]>(`
      SELECT h.*, MIN(r.price_per_night * (1 - r.discount_rate / 100)) as min_price
      FROM hotels h
      LEFT JOIN rooms r ON h.id = r.hotel_id AND r.is_available = 1
      WHERE h.is_active = 1
      GROUP BY h.id
      ORDER BY h.rating DESC, h.review_count DESC
      LIMIT 8
    `);

    let result = (rows as (Hotel & { min_price: number })[]).map(h => ({
      ...h,
      amenities: typeof h.amenities === 'string' ? JSON.parse(h.amenities) : h.amenities,
      images:    typeof h.images    === 'string' ? JSON.parse(h.images)    : h.images,
      is_active: Boolean(h.is_active),
    }));

    result = await translateFields(result, ['name', 'description'], lang) as typeof result;

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Get featured hotels error', { error });
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
}

export async function getMyHotels(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const role   = req.user!.role;

    const [rows] = await pool.query<RowDataPacket[]>(
      role === 'admin'
        ? `SELECT h.*, COUNT(DISTINCT r.id) as room_count,
             MIN(r.price_per_night * (1 - r.discount_rate / 100)) as min_price
           FROM hotels h LEFT JOIN rooms r ON h.id = r.hotel_id
           GROUP BY h.id ORDER BY h.created_at DESC`
        : `SELECT h.*, COUNT(DISTINCT r.id) as room_count,
             MIN(r.price_per_night * (1 - r.discount_rate / 100)) as min_price
           FROM hotels h LEFT JOIN rooms r ON h.id = r.hotel_id
           WHERE h.host_id = ?
           GROUP BY h.id ORDER BY h.created_at DESC`,
      role === 'admin' ? [] : [userId]
    );

    const hotels = (rows as any[]).map(h => ({
      ...h,
      amenities: typeof h.amenities === 'string' ? JSON.parse(h.amenities) : h.amenities,
      images:    typeof h.images    === 'string' ? JSON.parse(h.images)    : h.images,
      is_active: Boolean(h.is_active),
    }));

    res.json({ success: true, data: hotels });
  } catch (error) {
    logger.error('Get my hotels error', { error });
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
}

export async function getRegions(req: Request, res: Response): Promise<void> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(`
      SELECT region, city, COUNT(*) as hotel_count
      FROM hotels WHERE is_active = 1
      GROUP BY region, city
      ORDER BY hotel_count DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    logger.error('Get regions error', { error });
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
}

// 내부 서비스 전용: 객실 상세 조회 (booking-service에서 호출)
export async function getInternalRoom(req: Request, res: Response): Promise<void> {
  try {
    const { hotelId, roomId } = req.params;

    const [hotelRows] = await pool.query<RowDataPacket[]>(
      'SELECT id, host_id, name, address, images FROM hotels WHERE id = ?', [hotelId]
    );
    const hotel = (hotelRows as RowDataPacket[])[0] as (Hotel & { host_id: string }) | undefined;
    if (!hotel) {
      res.status(404).json({ success: false, message: '숙소를 찾을 수 없습니다.' });
      return;
    }

    const [roomRows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM rooms WHERE id = ? AND hotel_id = ? AND is_available = 1', [roomId, hotelId]
    );
    const room = (roomRows as RowDataPacket[])[0] as Room | undefined;
    if (!room) {
      res.status(404).json({ success: false, message: '객실을 찾을 수 없거나 예약 불가 상태입니다.' });
      return;
    }

    res.json({
      success: true,
      data: {
        ...room,
        host_id:       hotel.host_id,
        hotel_name:    hotel.name,
        hotel_address: hotel.address,
        hotel_images:  hotel.images,
        is_available:  Boolean(room.is_available),
      },
    });
  } catch (error) {
    logger.error('Get internal room error', { error });
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
}
