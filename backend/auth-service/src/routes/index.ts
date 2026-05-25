import { Router } from 'express';
import { authenticateToken, requireInternal } from '../middleware/auth';
import * as auth from '../controllers/authController';

const router = Router();

// 공개 엔드포인트
router.post('/auth/register', auth.register);
router.post('/auth/login',    auth.login);

// 인증 필요
router.get('/auth/profile',  authenticateToken, auth.getProfile);
router.put('/auth/profile',  authenticateToken, auth.updateProfile);
router.put('/auth/password', authenticateToken, auth.changePassword);

// 내부 서비스 전용 (x-internal-secret)
router.get('/internal/users/:id', requireInternal, auth.getInternalUser);

export default router;
