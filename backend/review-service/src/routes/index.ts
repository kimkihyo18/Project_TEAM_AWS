import { Router } from 'express';
import { authenticateToken, requireRole, requireInternal } from '../middleware/auth';
import * as review from '../controllers/reviewController';

const router = Router();

// 리뷰 작성/조회/삭제
router.post('/reviews',                    authenticateToken, review.createReview);
router.get('/hotels/:hotelId/reviews',     review.getHotelReviews);
router.delete('/reviews/:id',              authenticateToken, review.deleteReview);

// 내부 서비스 전용 (hotel-service SQS consumer가 호출)
router.get('/internal/hotels/:hotelId/rating-stats', requireInternal, review.getInternalRatingStats);

export default router;
