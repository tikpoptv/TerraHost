const jwt = require('jsonwebtoken');
const DatabaseService = require('../services/DatabaseService');

// DatabaseService is already an instance
const databaseService = DatabaseService;

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

class AuthMiddleware {
  // Verify JWT token and extract user info
  static async verifyToken(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          error: 'Access token required'
        });
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      
      // Verify JWT token
      const decoded = jwt.verify(token, JWT_SECRET);
      
      if (!decoded || !decoded.userId) {
        return res.status(401).json({
          success: false,
          error: 'Invalid token format'
        });
      }

      // Check if user still exists and is active
      const userResult = await databaseService.findById('users', decoded.userId);
      
      if (!userResult.success || !userResult.data) {
        return res.status(401).json({
          success: false,
          error: 'User not found'
        });
      }

      const user = userResult.data;
      
      if (!user.is_active || user.deleted_at) {
        return res.status(401).json({
          success: false,
          error: 'Account is deactivated'
        });
      }

      // Check if session exists and is active (2-layer security: JWT + Database)
      if (!decoded.sessionId) {
        return res.status(401).json({
          success: false,
          error: 'Session ID not found in token'
        });
      }

      const sessionResult = await databaseService.findById('user_sessions', decoded.sessionId);
      
      if (!sessionResult.success || !sessionResult.data) {
        return res.status(401).json({
          success: false,
          error: 'Session not found'
        });
      }

      const session = sessionResult.data;
      
      if (!session.is_active || session.deleted_at) {
        return res.status(401).json({
          success: false,
          error: 'Session expired or deactivated'
        });
      }

      console.log('✅ JWT + Session validation passed for user:', decoded.userId);

      // Attach user info and session ID to request
      req.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        is_active: user.is_active
      };

      req.token = token;
      req.sessionId = decoded.sessionId;
      
      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Token expired'
        });
      } else if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          error: 'Invalid token'
        });
      } else {
        console.error('Auth middleware error:', error);
        return res.status(500).json({
          success: false,
          error: 'Authentication error'
        });
      }
    }
  }

  // Optional auth - don't fail if no token
  static async optionalAuth(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        req.user = null;
        return next();
      }

      // Use the same verification logic
      await AuthMiddleware.verifyToken(req, res, next);
    } catch (error) {
      // Continue without auth if token is invalid
      req.user = null;
      next();
    }
  }

  // Check if user has specific role
  static requireRole(role) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      if (req.user.role !== role) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions'
        });
      }

      next();
    };
  }

  // Check if user is admin
  static requireAdmin(req, res, next) {
    return AuthMiddleware.requireRole('admin')(req, res, next);
  }
}

module.exports = AuthMiddleware;
