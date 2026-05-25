import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { RowDataPacket } from 'mysql2';
import pool from '../models/pool';
import { getInternalBooking } from '../clients/bookingClient';
import { publishRatingUpdate } from '../services/sqsPublisher';
import { Review } from '../types';
import logger from '../utils/logger';

export async function createReview(req: Request, res: Response): Promise<void> {
  try {
    const { hotel_id, booking_id, rating, title, content, images = [] } = req.body;
    const userId   = req.user!.userId;
    const userName = req.user!.name || req.user!.email;

    if (!hotel_id || !booking_id || !rating || !title || !content) {
      res.status(400).json({ success: false, message: '필수 정보를 모두 입력해주세요.' });
      return;
    }
    if (rating < 1 || rating > 5) {
      res.status(400).json({ success: false, message: '평점은 1~5 사이여야 합니다.' });
      return;
    }

    // booking-service에서 예약 확인
    let booking: Awaited<ReturnType<typeof getInternalBooking>>;
    try {
      booking = await getInternalBooking(booking_id);
    } catch {
      res.status(403).json({ success: false, message: '해당 예약에 대한 리뷰를 작성할 권한이 없습니다.' });
      return;
    }

    if (booking.user_id !== userId || booking.hotel_id !== hotel_id) {
      res.status(403).json({ success: false, message: '해당 예약에 대한 리뷰를 작성할 권한이 없습니다.' });
      return;
    }
    if (booking.status !== 'completed' && booking.status !== 'confirmed') {
      res.status(400).json({ success: false, message: '체크아웃 후 리뷰를 작성할 수 있습니다.' });
      return;
    }

    const [existingRows] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM reviews WHERE booking_id = ?', [booking_id]
    );
    if ((existingRows as RowDataPacket[]).length > 0) {
      res.status(409).json({ success: false, message: '이미 리뷰를 작성했습니다.' });
      return;
    }

    const reviewId = uuidv4();
    await pool.query(
      `INSERT INTO reviews (id, user_id, user_name, hotel_id, booking_id, rating, title, content, images)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [reviewId, userId, userName, hotel_id, booking_id, rating, title, content, JSON.stringify(images)]
    );

    // SQS로 평점 업데이트 알림 (hotel-service가 소비)
    await publishRatingUpdate({ hotelId: hotel_id, action: 'create', rating });

    res.status(201).json({ success: true, message: '리뷰가 등록되었습니다.', data: { id: reviewId } });
  } catch (error) {
    logger.error('Create review error', { error });
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
}

export async function getHotelReviews(req: Request, res: Response): Promise<void> {
  try {
    const { hotelId } = req.params;
    const { page = 1, limit = 10, sort_by = 'recent' } = req.query;

    let orderBy = 'r.created_at DESC';
    if (sort_by === 'rating_high') orderBy = 'r.rating DESC, r.created_at DESC';
    if (sort_by === 'rating_low')  orderBy = 'r.rating ASC, r.created_at DESC';

    const [reviewRows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM reviews r
       WHERE r.hotel_id = ?
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
      [hotelId, Number(limit), (Number(page) - 1) * Number(limit)]
    );

    const [statsRows] = await pool.query<RowDataPacket[]>(
      `SELECT
         COUNT(*)                                        as total,
         AVG(rating)                                     as average,
         SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END)    as five_star,
         SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END)    as four_star,
         SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END)    as three_star,
         SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END)    as two_star,
         SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END)    as one_star
       FROM reviews WHERE hotel_id = ?`,
      [hotelId]
    );
    const stats = (statsRows as RowDataPacket[])[0] as {
      total: number; average: number;
      five_star: number; four_star: number; three_star: number; two_star: number; one_star: number;
    };

    res.json({
      success: true,
      data: {
        reviews: (reviewRows as (Review & { user_name: string; user_avatar?: string })[]).map(r => ({
          ...r,
          images: typeof r.images === 'string' ? JSON.parse(r.images) : r.images,
        })),
        stats: { ...stats, average: Math.round((stats.average || 0) * 10) / 10 },
        pagination: {
          total: stats.total,
          page:  Number(page),
          limit: Number(limit),
          total_pages: Math.ceil(stats.total / Number(limit)),
        },
      },
    });
  } catch (error) {
    logger.error('Get reviews error', { error });
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
}

export async function deleteReview(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM reviews WHERE id = ?', [id]);
    const review = (rows as RowDataPacket[])[0] as Review | undefined;
    if (!review) {
      res.status(404).json({ success: false, message: '리뷰를 찾을 수 없습니다.' });
      return;
    }
    if (review.user_id !== userId && req.user!.role !== 'admin') {
      res.status(403).json({ success: false, message: '권한이 없습니다.' });
      return;
    }

    await pool.query('DELETE FROM reviews WHERE id = ?', [id]);

    // SQS로 평점 재계산 알림
    await publishRatingUpdate({ hotelId: review.hotel_id, action: 'delete' });

    res.json({ success: true, message: '리뷰가 삭제되었습니다.' });
  } catch (error) {
    logger.error('Delete review error', { error });
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
}

// 내부 서비스 전용: hotel-service SQS consumer가 평점 계산에 사용
export async function getInternalRatingStats(req: Request, res: Response): Promise<void> {
  try {
    const { hotelId } = req.params;
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT AVG(rating) as avg_rating, COUNT(*) as count FROM reviews WHERE hotel_id = ?',
      [hotelId]
    );
    const stats = (rows as RowDataPacket[])[0] as { avg_rating: number | null; count: number };
    res.json({ success: true, data: { avg_rating: stats.avg_rating ?? 0, count: stats.count } });
  } catch (error) {
    logger.error('Get internal rating stats error', { error });
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
}
