import { Router } from 'express';
import { login, logout, getCurrentUser, refreshToken, authenticate } from '@/web/middleware/auth.js';
// import { logger } from '@/utils/logger.js';

export function createAuthRouter(): Router {
  const router = Router();

  // Public routes
  router.post('/login', login);

  // Protected routes
  router.use(authenticate);
  router.post('/logout', logout);
  router.get('/me', getCurrentUser);
  router.post('/refresh', refreshToken);

  return router;
}
