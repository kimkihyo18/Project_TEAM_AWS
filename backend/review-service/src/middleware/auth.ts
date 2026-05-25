import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config, isLocal } from '../config';
import { JwtPayload } from '../types';

declare global {
  namespace Express {
    interface Request { user?: JwtPayload; }
  }
}

let cognitoVerifier: any = null;
if (!isLocal && config.cognito.userPoolId) {
  try {
    const { CognitoJwtVerifier } = require('aws-jwt-verify');
    cognitoVerifier = CognitoJwtVerifier.create({
      userPoolId: config.cognito.userPoolId,
      tokenUse:   'access',
      clientId:   config.cognito.clientId,
    });
  } catch {
    console.warn('aws-jwt-verify 로드 실패 — Cognito 검증 비활성화');
  }
}

export async function authenticateToken(
  req: Request, res: Response, next: NextFunction
): Promise<void> {
  const token = req.headers['authorization']?.split(' ')[1];

  if (!token) {
    res.status(401).json({ success: false, message: '인증 토큰이 필요합니다.' });
    return;
  }

  try {
    if (isLocal) {
      const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
      req.user = decoded;
    } else {
      if (!cognitoVerifier) throw new Error('Cognito verifier not initialized');
      const payload = await cognitoVerifier.verify(token);
      req.user = {
        userId: payload.sub,
        email:  payload.email ?? '',
        role:   payload['custom:role'] ?? 'user',
      };
    }
    next();
  } catch {
    res.status(403).json({ success: false, message: '유효하지 않은 토큰입니다.' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: '인증이 필요합니다.' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ success: false, message: '권한이 없습니다.' });
      return;
    }
    next();
  };
}

export function requireInternal(req: Request, res: Response, next: NextFunction): void {
  if (req.headers['x-internal-secret'] !== config.internal.secret) {
    res.status(403).json({ success: false, message: '내부 인증 실패' });
    return;
  }
  next();
}
