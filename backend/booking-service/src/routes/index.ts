import { Router } from 'express';
import { authenticateToken, requireRole, requireInternal } from '../middleware/auth';
import * as booking from '../controllers/bookingController';

const router = Router();

// 사용자 예약
router.post('/bookings',       authenticateToken, booking.createBooking);
router.get('/bookings/host',   authenticateToken, requireRole('host','admin'), booking.getHostBookings);
router.get('/bookings',        authenticateToken, booking.getUserBookings);
router.get('/bookings/:id',    authenticateToken, booking.getBookingById);
router.delete('/bookings/:id', authenticateToken, booking.cancelBooking);

// 내부 서비스 전용
router.get('/internal/bookings/:id', requireInternal, booking.getInternalBooking);

export default router;
