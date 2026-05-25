import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from '../models/pool';
import { generateToken } from '../middleware/auth';
import { User } from '../types';
import logger from '../utils/logger';

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, name, phone, role = 'user' } = req.body;

    if (!email || !password || !name) {
      res.status(400).json({ success: false, message: '이메일, 비밀번호, 이름은 필수입니다.' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ success: false, message: '비밀번호는 6자 이상이어야 합니다.' });
      return;
    }

    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM users WHERE email = ?', [email]
    );
    if ((existing as RowDataPacket[]).length > 0) {
      res.status(409).json({ success: false, message: '이미 사용 중인 이메일입니다.' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId         = uuidv4();
    const userRole       = role === 'host' ? 'host' : 'user';

    await pool.query<ResultSetHeader>(
      'INSERT INTO users (id, email, password, name, phone, role) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, email, hashedPassword, name, phone || null, userRole]
    );

    const token = generateToken({ userId, email, role: userRole, name });
    res.status(201).json({
      success: true,
      message: '회원가입이 완료되었습니다.',
      data: { token, user: { id: userId, email, name, role: userRole } },
    });
  } catch (error) {
    logger.error('Register error', { error });
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, message: '이메일과 비밀번호를 입력해주세요.' });
      return;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM users WHERE email = ?', [email]
    );
    const user = (rows as RowDataPacket[])[0] as User | undefined;
    if (!user) {
      res.status(401).json({ success: false, message: '이메일 또는 비밀번호가 잘못되었습니다.' });
      return;
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      res.status(401).json({ success: false, message: '이메일 또는 비밀번호가 잘못되었습니다.' });
      return;
    }

    const token = generateToken({ userId: user.id, email: user.email, role: user.role, name: user.name });
    res.json({
      success: true,
      message: '로그인 성공',
      data: {
        token,
        user: { id: user.id, email: user.email, name: user.name, role: user.role, profile_image: user.profile_image },
      },
    });
  } catch (error) {
    logger.error('Login error', { error });
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
}

export async function getProfile(req: Request, res: Response): Promise<void> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, email, name, phone, profile_image, role, created_at FROM users WHERE id = ?',
      [req.user!.userId]
    );
    const user = (rows as RowDataPacket[])[0];
    if (!user) {
      res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
      return;
    }
    res.json({ success: true, data: user });
  } catch (error) {
    logger.error('Get profile error', { error });
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  try {
    const { name, phone } = req.body;
    await pool.query(
      'UPDATE users SET name = ?, phone = ? WHERE id = ?',
      [name, phone, req.user!.userId]
    );
    res.json({ success: true, message: '프로필이 업데이트되었습니다.' });
  } catch (error) {
    logger.error('Update profile error', { error });
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  try {
    const { current_password, new_password } = req.body;

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM users WHERE id = ?', [req.user!.userId]
    );
    const user = (rows as RowDataPacket[])[0] as User | undefined;
    if (!user) {
      res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
      return;
    }

    const isValid = await bcrypt.compare(current_password, user.password);
    if (!isValid) {
      res.status(401).json({ success: false, message: '현재 비밀번호가 잘못되었습니다.' });
      return;
    }
    if (new_password.length < 6) {
      res.status(400).json({ success: false, message: '새 비밀번호는 6자 이상이어야 합니다.' });
      return;
    }

    const hashed = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user!.userId]);
    res.json({ success: true, message: '비밀번호가 변경되었습니다.' });
  } catch (error) {
    logger.error('Change password error', { error });
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
}

// 내부 서비스 전용: 사용자 정보 조회 (x-internal-secret 필요)
export async function getInternalUser(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, email, name, profile_image, role FROM users WHERE id = ?', [id]
    );
    const user = (rows as RowDataPacket[])[0];
    if (!user) {
      res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다.' });
      return;
    }
    res.json({ success: true, data: user });
  } catch (error) {
    logger.error('Get internal user error', { error });
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
}
