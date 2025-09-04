const TokenService = require('../services/TokenService');

class ApiKeyMiddleware {
  constructor() {
    this.tokenService = new TokenService();
  }

  /**
   * ตรวจสอบ API key และเพิ่มข้อมูลผู้ใช้ลงใน req
   */
  async verifyApiKey(req, res, next) {
    try {
      // รับ API key จาก header หรือ query parameter
      const apiKey = req.headers['x-api-key'] || 
                    req.headers['authorization']?.replace('Bearer ', '') ||
                    req.query.api_key;

      if (!apiKey) {
        return res.status(401).json({
          success: false,
          error: 'API key is required'
        });
      }

      // ตรวจสอบ API key
      const validation = await this.tokenService.validateApiKey(apiKey);

      if (!validation.success) {
        return res.status(401).json({
          success: false,
          error: validation.error
        });
      }

      // เพิ่มข้อมูลผู้ใช้ลงใน req
      req.apiUser = validation.data;
      next();
    } catch (error) {
      console.error('API key verification error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to verify API key'
      });
    }
  }

  /**
   * ตรวจสอบสิทธิ์เฉพาะ
   */
  requirePermission(requiredPermission) {
    return async (req, res, next) => {
      try {
        if (!req.apiUser) {
          return res.status(401).json({
            success: false,
            error: 'API key verification required'
          });
        }

        const hasPermission = req.apiUser.permissions.includes(requiredPermission);

        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            error: `Insufficient permissions. Required: ${requiredPermission}`
          });
        }

        next();
      } catch (error) {
        console.error('Permission check error:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to check permissions'
        });
      }
    };
  }

  /**
   * ตรวจสอบสิทธิ์หลายอย่าง (ต้องมีอย่างน้อยหนึ่งสิทธิ์)
   */
  requireAnyPermission(requiredPermissions) {
    return async (req, res, next) => {
      try {
        if (!req.apiUser) {
          return res.status(401).json({
            success: false,
            error: 'API key verification required'
          });
        }

        const hasAnyPermission = requiredPermissions.some(permission => 
          req.apiUser.permissions.includes(permission)
        );

        if (!hasAnyPermission) {
          return res.status(403).json({
            success: false,
            error: `Insufficient permissions. Required one of: ${requiredPermissions.join(', ')}`
          });
        }

        next();
      } catch (error) {
        console.error('Permission check error:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to check permissions'
        });
      }
    };
  }

  /**
   * ตรวจสอบสิทธิ์หลายอย่าง (ต้องมีทุกสิทธิ์)
   */
  requireAllPermissions(requiredPermissions) {
    return async (req, res, next) => {
      try {
        if (!req.apiUser) {
          return res.status(401).json({
            success: false,
            error: 'API key verification required'
          });
        }

        const hasAllPermissions = requiredPermissions.every(permission => 
          req.apiUser.permissions.includes(permission)
        );

        if (!hasAllPermissions) {
          return res.status(403).json({
            success: false,
            error: `Insufficient permissions. Required all: ${requiredPermissions.join(', ')}`
          });
        }

        next();
      } catch (error) {
        console.error('Permission check error:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to check permissions'
        });
      }
    };
  }

  /**
   * ตรวจสอบว่าเป็น admin หรือไม่
   */
  requireAdmin() {
    return async (req, res, next) => {
      try {
        if (!req.apiUser) {
          return res.status(401).json({
            success: false,
            error: 'API key verification required'
          });
        }

        if (req.apiUser.userRole !== 'admin') {
          return res.status(403).json({
            success: false,
            error: 'Admin access required'
          });
        }

        next();
      } catch (error) {
        console.error('Admin check error:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to check admin status'
        });
      }
    };
  }

  /**
   * Rate limiting สำหรับ API key
   */
  rateLimit(maxRequests = 100, windowMs = 15 * 60 * 1000) { // 100 requests per 15 minutes
    const requests = new Map();

    return async (req, res, next) => {
      try {
        if (!req.apiUser) {
          return res.status(401).json({
            success: false,
            error: 'API key verification required'
          });
        }

        const key = req.apiUser.userId;
        const now = Date.now();
        const windowStart = now - windowMs;

        // ลบข้อมูลเก่า
        if (requests.has(key)) {
          requests.set(key, requests.get(key).filter(timestamp => timestamp > windowStart));
        }

        const currentRequests = requests.get(key) || [];
        
        if (currentRequests.length >= maxRequests) {
          return res.status(429).json({
            success: false,
            error: 'Rate limit exceeded. Please try again later.'
          });
        }

        // เพิ่ม request ใหม่
        currentRequests.push(now);
        requests.set(key, currentRequests);

        next();
      } catch (error) {
        console.error('Rate limiting error:', error);
        next(); // ให้ผ่านไปในกรณีที่เกิดข้อผิดพลาด
      }
    };
  }
}

module.exports = new ApiKeyMiddleware();
