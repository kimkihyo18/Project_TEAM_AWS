import { Router } from 'express';
import { authenticateToken, requireRole, requireInternal } from '../middleware/auth';
import * as hotel     from '../controllers/hotelController';
import * as video     from '../controllers/videoController';
import * as wishlist  from '../controllers/wishlistController';
import * as recommend from '../controllers/recommendController';

const router = Router();

// ── 호텔 공개 ──────────────────────────────────────────────────────────────────
router.get('/hotels/featured', hotel.getFeaturedHotels);
router.get('/hotels/regions',  hotel.getRegions);
router.get('/hotels/mine',     authenticateToken, requireRole('host','admin'), hotel.getMyHotels);
router.get('/hotels/search',   hotel.searchHotels);
router.get('/hotels',          hotel.searchHotels);
router.get('/hotels/:id',      hotel.getHotelById);

router.get('/hotels/:hotelId/rooms/:roomId', hotel.getRoomById);

// ── 호텔 관리 (host/admin) ────────────────────────────────────────────────────
router.post('/hotels',        authenticateToken, requireRole('host','admin'), hotel.createHotel);
router.put('/hotels/:id',     authenticateToken, requireRole('host','admin'), hotel.updateHotel);

router.post('/hotels/:hotelId/rooms',
  authenticateToken, requireRole('host','admin'), hotel.createRoom);

// ── 영상 ──────────────────────────────────────────────────────────────────────
router.post('/hotels/:id/video-upload-url',
  authenticateToken, requireRole('host','admin'), video.getVideoUploadUrl);
router.post('/hotels/:id/video-url', video.updateVideoUrl);
router.get('/hotels/:id/video-status', video.getVideoStatus);

// ── 위시리스트 ────────────────────────────────────────────────────────────────
router.post('/wishlist/:hotelId', authenticateToken, wishlist.toggleWishlist);
router.get('/wishlist',           authenticateToken, wishlist.getWishlist);

// ── AI 추천 ───────────────────────────────────────────────────────────────────
router.post('/recommend', authenticateToken, recommend.getRecommendations);

// ── 내부 서비스 전용 ──────────────────────────────────────────────────────────
router.get('/internal/hotels/:hotelId/rooms/:roomId', requireInternal, hotel.getInternalRoom);

export default router;
