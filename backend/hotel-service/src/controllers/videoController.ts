import { Request, Response } from 'express';
import { RowDataPacket } from 'mysql2';
import pool from '../models/pool';
import { config, isLocal } from '../config';
import { Hotel } from '../types';
import logger from '../utils/logger';

let getSignedUrl: any;
let PutObjectCommand: any;
let S3Client: any;

if (!isLocal) {
  const s3Mod      = require('@aws-sdk/client-s3');
  const presignMod = require('@aws-sdk/s3-request-presigner');
  S3Client         = s3Mod.S3Client;
  PutObjectCommand = s3Mod.PutObjectCommand;
  getSignedUrl     = presignMod.getSignedUrl;
}

export async function getVideoUploadUrl(req: Request, res: Response): Promise<void> {
  if (isLocal) {
    res.status(503).json({ success: false, message: '영상 업로드는 AWS 환경에서만 지원됩니다.' });
    return;
  }

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

    const s3      = new S3Client({ region: config.s3.region });
    const key     = `source-videos/${id}/original.mp4`;
    const command = new PutObjectCommand({
      Bucket:      config.s3.sourceBucket,
      Key:         key,
      ContentType: 'video/mp4',
    });
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 });

    await pool.query(`UPDATE hotels SET video_status = 'processing' WHERE id = ?`, [id]);

    res.json({ success: true, data: { uploadUrl, key, expiresIn: 900 } });
  } catch (error) {
    logger.error('Get video upload URL error', { error });
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
}

export async function updateVideoUrl(req: Request, res: Response): Promise<void> {
  try {
    const { id }                = req.params;
    const { video_url, secret } = req.body;

    if (!secret || secret !== config.s3.lambdaSecret) {
      res.status(403).json({ success: false, message: '인증 실패' });
      return;
    }
    if (!video_url) {
      res.status(400).json({ success: false, message: 'video_url 필요' });
      return;
    }

    await pool.query(
      `UPDATE hotels SET video_url = ?, video_status = 'ready' WHERE id = ?`,
      [video_url, id]
    );

    res.json({ success: true, message: '영상 URL이 업데이트되었습니다.' });
  } catch (error) {
    logger.error('Update video URL error', { error });
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
}

export async function getVideoStatus(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT video_url, video_status FROM hotels WHERE id = ?', [id]
    );
    const row = (rows as RowDataPacket[])[0];
    if (!row) {
      res.status(404).json({ success: false, message: '숙소를 찾을 수 없습니다.' });
      return;
    }
    res.json({ success: true, data: { video_url: row.video_url, video_status: row.video_status || 'none' } });
  } catch (error) {
    logger.error('Get video status error', { error });
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
}
