import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { RowDataPacket } from 'mysql2';
import pool from '../models/pool';
import { Hotel } from '../types';
import logger from '../utils/logger';

export async function toggleWishlist(req: Request, res: Response): Promise<void> {
  try {
    const { hotelId } = req.params;
    const userId      = req.user!.userId;

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM wishlists WHERE user_id = ? AND hotel_id = ?', [userId, hotelId]
    );

    if ((rows as RowDataPacket[]).length > 0) {
      await pool.query('DELETE FROM wishlists WHERE user_id = ? AND hotel_id = ?', [userId, hotelId]);
      res.json({ success: true, message: '위시리스트에서 제거되었습니다.', data: { wishlisted: false } });
    } else {
      await pool.query(
        'INSERT INTO wishlists (id, user_id, hotel_id) VALUES (?, ?, ?)',
        [uuidv4(), userId, hotelId]
      );
      res.json({ success: true, message: '위시리스트에 추가되었습니다.', data: { wishlisted: true } });
    }
  } catch (error) {
    logger.error('Toggle wishlist error', { error });
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
}

export async function getWishlist(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;

    const [rows] = await pool.query<RowDataPacket[]>(`
      SELECT h.*, MIN(r.price_per_night * (1 - r.discount_rate / 100)) as min_price
      FROM wishlists w
      JOIN hotels h ON w.hotel_id = h.id
      LEFT JOIN rooms r ON h.id = r.hotel_id AND r.is_available = 1
      WHERE w.user_id = ?
      GROUP BY h.id
      ORDER BY w.created_at DESC
    `, [userId]);

    res.json({
      success: true,
      data: (rows as any[]).map(h => ({
        ...h,
        amenities: typeof h.amenities === 'string' ? JSON.parse(h.amenities) : h.amenities,
        images:    typeof h.images    === 'string' ? JSON.parse(h.images)    : h.images,
        is_active: Boolean(h.is_active),
      })),
    });
  } catch (error) {
    logger.error('Get wishlist error', { error });
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
}
