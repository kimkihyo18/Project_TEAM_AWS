import { config, isLocal } from '../config';
import pool from '../models/pool';
import logger from '../utils/logger';

interface RatingMessage {
  hotelId: string;
  action: 'create' | 'delete';
}

async function fetchRatingStats(hotelId: string): Promise<{ avg_rating: number; count: number }> {
  const url  = `${config.internal.reviewService}/internal/hotels/${hotelId}/rating-stats`;
  const http = url.startsWith('https') ? require('https') : require('http');

  return new Promise((resolve, reject) => {
    http.get(url, {
      headers: { 'x-internal-secret': config.internal.secret },
    }, (res: any) => {
      let data = '';
      res.on('data', (c: string) => { data += c; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.data ?? { avg_rating: 0, count: 0 });
        } catch { reject(new Error('parse error')); }
      });
    }).on('error', reject);
  });
}

async function updateHotelRating(hotelId: string): Promise<void> {
  const conn = await pool.getConnection();
  try {
    const stats = await fetchRatingStats(hotelId);
    await conn.execute(
      'UPDATE hotels SET rating = ?, review_count = ? WHERE id = ?',
      [Math.round((stats.avg_rating || 0) * 10) / 10, stats.count, hotelId]
    );
    logger.info('Hotel rating updated via SQS', { hotelId, rating: stats.avg_rating, count: stats.count });
  } finally {
    conn.release();
  }
}

export async function startSQSConsumer(): Promise<void> {
  const { endpoint: sqsEndpoint, queueUrl } = config.sqs;

  const { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } = require('@aws-sdk/client-sqs');

  const client = new SQSClient({
    region:      config.sqs.region,
    endpoint:    isLocal ? sqsEndpoint : undefined,
    credentials: isLocal ? { accessKeyId: 'local', secretAccessKey: 'local' } : undefined,
  });

  logger.info('SQS consumer started', { queueUrl });

  const poll = async () => {
    try {
      const result = await client.send(new ReceiveMessageCommand({
        QueueUrl:            queueUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds:     20,
      }));

      for (const msg of result.Messages ?? []) {
        try {
          const body = JSON.parse(msg.Body!) as RatingMessage;
          await updateHotelRating(body.hotelId);
          await client.send(new DeleteMessageCommand({
            QueueUrl:      queueUrl,
            ReceiptHandle: msg.ReceiptHandle!,
          }));
        } catch (err) {
          logger.error('SQS message processing failed', { err, msgId: msg.MessageId });
        }
      }
    } catch (err) {
      logger.error('SQS poll error', { err });
    }
    setTimeout(poll, 1000);
  };

  poll();
}
