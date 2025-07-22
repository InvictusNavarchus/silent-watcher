import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { logger } from '@/utils/logger.js';
import { config } from '@/config/index.js';
import type { JWTPayload, AuthUser } from '@/types/index.js';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Authentication middleware
 */
export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
      
      req.user = {
        id: decoded.userId,
        username: decoded.username,
        role: decoded.role as 'admin' | 'viewer'
      };
      
      next();
    } catch (jwtError) {
      logger.warn('Invalid JWT token', { error: jwtError });
      res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }
  } catch (error) {
    logger.error('Authentication middleware error', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Authorization middleware for admin-only routes
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
    return;
  }

  if (req.user.role !== 'admin') {
    res.status(403).json({
      success: false,
      error: 'Admin access required'
    });
    return;
  }

  next();
};

/**
 * Login handler
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({
        success: false,
        error: 'Username and password are required'
      });
      return;
    }

    // Check credentials against config
    if (!config.web.username || !config.web.password) {
      res.status(500).json({
        success: false,
        error: 'Authentication not configured'
      });
      return;
    }

    const isValidUsername = username === config.web.username;
    const isValidPassword = await bcrypt.compare(password, await bcrypt.hash(config.web.password, 10));

    if (!isValidUsername || !isValidPassword) {
      logger.warn('Failed login attempt', { username, ip: req.ip });
      res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
      return;
    }

    // Generate JWT token
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId: 'admin',
      username: config.web.username,
      role: 'admin'
    };

    const token = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn
    } as jwt.SignOptions);

    logger.info('Successful login', { username, ip: req.ip });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: 'admin',
          username: config.web.username,
          role: 'admin'
        }
      }
    });
  } catch (error) {
    logger.error('Login error', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Get current user info
 */
export const getCurrentUser = (req: Request, res: Response): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
    return;
  }

  res.json({
    success: true,
    data: req.user
  });
};

/**
 * Logout handler (client-side token removal)
 */
export const logout = (req: Request, res: Response): void => {
  logger.info('User logged out', { username: req.user?.username, ip: req.ip });
  
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
};

/**
 * Refresh token handler
 */
export const refreshToken = (req: Request, res: Response): void => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    // Generate new token
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId: req.user.id,
      username: req.user.username,
      role: req.user.role
    };

    const token = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn
    } as jwt.SignOptions);

    res.json({
      success: true,
      data: { token }
    });
  } catch (error) {
    logger.error('Token refresh error', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};
