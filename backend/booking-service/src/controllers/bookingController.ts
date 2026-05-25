import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { RowDataPacket } from 'mysql2';
import pool from '../models/pool';
import { getInternalRoom } from '../clients/hotelClient';
import { publishBookingNotification } from '../services/sqsPublisher';
import { Booking } from '../types';
import logger from '../utils/logger';

export async function createBooking(req: Request, res: Response): Promise<void> {
  try {
    const { hotel_id, room_id, check_in_date, check_out_date, guests, special_requests } = req.body;
    const userId = req.user!.userId;

    if (!hotel_id || !room_id || !check_in_date || !check_out_date || !guests) {
      res.status(400).json({ success: false, message: '필수 정보를 모두 입력해주세요.' });
      return;
    }

    const checkIn  = new Date(check_in_date);
    const checkOut = new Date(check_out_date);

    if (checkIn >= checkOut) {
      res.status(400).json({ success: false, message: '체크아웃 날짜는 체크인 날짜보다 나중이어야 합니다.' });
      return;
    }
    if (checkIn < new Date()) {
      res.status(400).json({ success: false, message: '체크인 날짜는 오늘 이후여야 합니다.' });
      return;
    }

    // hotel-service에서 객실 정보 조회
    let room: Awaited<ReturnType<typeof getInternalRoom>>;
    try {
      room = await getInternalRoom(hotel_id, room_id);
    } catch {
      res.status(404).json({ success: false, message: '객실을 찾을 수 없습니다.' });
      return;
    }

    if (room.capacity < Number(guests)) {
      res.status(400).json({ success: false, message: `해당 객실의 최대 수용 인원은 ${room.capacity}명입니다.` });
      return;
    }

    // 예약 중복 확인 (booking_db에서)
    const [conflictRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM bookings
       WHERE room_id = ? AND status IN ('confirmed','pending')
       AND check_in_date < ? AND check_out_date > ?`,
      [room_id, check_out_date, check_in_date]
    );
    if (((conflictRows as RowDataPacket[])[0] as { count: number }).count > 0) {
      res.status(409).json({ success: false, message: '해당 날짜에 이미 예약이 있습니다.' });
      return;
    }

    const nights     = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
    const discounted = Number(room.price_per_night) * (1 - Number(room.discount_rate) / 100);
    const totalPrice = discounted * nights;
    const bookingId  = uuidv4();

    await pool.query(
      `INSERT INTO bookings
        (id, user_id, host_id, hotel_id, hotel_name, hotel_address, hotel_images, room_id, room_name, room_type,
         check_in_date, check_out_date, guests, total_price, status, special_requests)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?)`,
      [
        bookingId, userId, room.host_id, hotel_id,
        room.hotel_name, room.hotel_address ?? '',
        room.hotel_images != null
          ? JSON.stringify(Array.isArray(room.hotel_images) ? room.hotel_images : [room.hotel_images])
          : null,
        room_id, room.name, room.type,
        check_in_date, check_out_date, guests, totalPrice,
        special_requests ?? null,
      ]
    );

    res.status(201).json({
      success: true,
      message: '예약이 완료되었습니다.',
      data: { id: bookingId, total_price: totalPrice, nights, status: 'confirmed' },
    });

    // SQS 이메일 알림 (응답 후 비동기 발행 — 실패해도 예약에 영향 없음)
    publishBookingNotification({
      bookingId,
      userEmail:  req.user!.email,
      userName:   req.user!.name || req.user!.email,
      hotelName:  room.hotel_name,
      roomName:   room.name,
      checkIn:    check_in_date,
      checkOut:   check_out_date,
      guests:     Number(guests),
      totalPrice,
      nights,
    });
  } catch (error) {
    logger.error('Create booking error', { error });
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
}

export async function getUserBookings(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { status, page = 1, limit = 10 } = req.query;

    let query  = `SELECT * FROM bookings WHERE user_id = ?`;
    const params: (string | number)[] = [userId];

    if (status) { query += ` AND status = ?`; params.push(status as string); }
    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), (Number(page) - 1) * Number(limit));

    const [rows] = await pool.query<RowDataPacket[]>(query, params);

    const countParams: (string | number)[] = [userId];
    if (status) countParams.push(String(status));
    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM bookings WHERE user_id = ? ${status ? 'AND status = ?' : ''}`,
      countParams
    );
    const total = ((countRows as RowDataPacket[])[0] as { count: number }).count;

    const bookings = (rows as RowDataPacket[]).map(b => ({
      ...b,
      hotel_images: (() => {
        if (!b.hotel_images) return [];
        try {
          const parsed = JSON.parse(b.hotel_images);
          return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          return [b.hotel_images];
        }
      })(),
    }));

    res.json({
      success: true,
      data: {
        bookings,
        pagination: { total, page: Number(page), limit: Number(limit), total_pages: Math.ceil(total / Number(limit)) },
      },
    });
  } catch (error) {
    logger.error('Get bookings error', { error });
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
}

export async function getBookingById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM bookings WHERE id = ? AND user_id = ?', [id, userId]
    );
    const booking = (rows as RowDataPacket[])[0];
    if (!booking) {
      res.status(404).json({ success: false, message: '예약을 찾을 수 없습니다.' });
      return;
    }

    res.json({ success: true, data: booking });
  } catch (error) {
    logger.error('Get booking error', { error });
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
}

// DELETE /bookings/:id (기존 백엔드 호환)
export async function cancelBooking(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM bookings WHERE id = ? AND user_id = ?', [id, userId]
    );
    const booking = (rows as RowDataPacket[])[0] as Booking | undefined;
    if (!booking) {
      res.status(404).json({ success: false, message: '예약을 찾을 수 없습니다.' });
      return;
    }
    if (booking.status === 'cancelled') {
      res.status(400).json({ success: false, message: '이미 취소된 예약입니다.' });
      return;
    }
    if (booking.status === 'completed') {
      res.status(400).json({ success: false, message: '완료된 예약은 취소할 수 없습니다.' });
      return;
    }

    const hoursUntilCheckIn = (new Date(booking.check_in_date).getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursUntilCheckIn < 24) {
      res.status(400).json({ success: false, message: '체크인 24시간 전에는 취소할 수 없습니다.' });
      return;
    }

    await pool.query(`UPDATE bookings SET status = 'cancelled' WHERE id = ?`, [id]);
    res.json({ success: true, message: '예약이 취소되었습니다.' });
  } catch (error) {
    logger.error('Cancel booking error', { error });
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
}

export async function getHostBookings(req: Request, res: Response): Promise<void> {
  try {
    const hostId = req.user!.userId;
    const { status, page = 1, limit = 20 } = req.query;

    let query  = `SELECT * FROM bookings WHERE host_id = ?`;
    const params: (string | number)[] = [hostId];

    if (status) { query += ` AND status = ?`; params.push(status as string); }
    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), (Number(page) - 1) * Number(limit));

    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    logger.error('Get host bookings error', { error });
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
}

// 내부 서비스 전용: 예약 존재 여부 확인 (review-service에서 호출)
export async function getInternalBooking(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, user_id, hotel_id, status FROM bookings WHERE id = ?', [id]
    );
    const booking = (rows as RowDataPacket[])[0];
    if (!booking) {
      res.status(404).json({ success: false, message: '예약을 찾을 수 없습니다.' });
      return;
    }
    res.json({ success: true, data: booking });
  } catch (error) {
    logger.error('Get internal booking error', { error });
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
}
