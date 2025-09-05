const BaseController = require('./BaseController');
const TokenService = require('../services/TokenService');
const AuthMiddleware = require('../middleware/authMiddleware');

class TokenController extends BaseController {
  constructor() {
    super();
    this.tokenService = new TokenService();
  }

  initializeRoutes() {
    this.router.post('/create', 
      AuthMiddleware.verifyToken, 
      this.createApiKey.bind(this)
    );

    this.router.get('/list', 
      AuthMiddleware.verifyToken, 
      this.getUserApiKeys.bind(this)
    );

    this.router.delete('/:apiKeyId', 
      AuthMiddleware.verifyToken, 
      this.deleteApiKey.bind(this)
    );

    this.router.patch('/:apiKeyId/status', 
      AuthMiddleware.verifyToken, 
      this.updateApiKeyStatus.bind(this)
    );

    this.router.post('/validate', 
      this.validateApiKey.bind(this)
    );

    this.router.post('/check-permission', 
      this.checkPermission.bind(this)
    );

    this.router.post('/session/create', 
      AuthMiddleware.verifyToken, 
      this.createSessionToken.bind(this)
    );

    this.router.post('/session/validate', 
      this.validateSessionToken.bind(this)
    );

    this.router.delete('/session/:token', 
      AuthMiddleware.verifyToken, 
      this.deleteSessionToken.bind(this)
    );
  }

  async createApiKey(req, res) {
    try {
      const userId = req.user.id;
      const { name, permissions = [], expiresAt = null } = req.body;

      if (!name) {
        return res.status(400).json({
          success: false,
          error: 'API key name is required'
        });
      }

      if (req.user.role !== 'admin') {
        const allowedPermissions = ['read:files', 'read:metadata', 'query:spatial'];
        const hasValidPermissions = permissions.every(perm => allowedPermissions.includes(perm));
        
        if (!hasValidPermissions) {
          return res.status(403).json({
            success: false,
            error: 'Insufficient permissions to create API key with requested permissions'
          });
        }
      }

      const result = await this.tokenService.createApiKey(userId, name, permissions, expiresAt);

      if (result.success) {
        res.status(201).json({
          success: true,
          data: {
            id: result.data.id,
            name: result.data.name,
            permissions: result.data.permissions,
            isActive: result.data.is_active,
            expiresAt: result.data.expires_at,
            createdAt: result.data.created_at,
            apiKey: result.data.apiKey
          },
          message: 'API key created successfully. Please save this key as it will not be shown again.'
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Create API key error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create API key'
      });
    }
  }

  async getUserApiKeys(req, res) {
    try {
      const userId = req.user.id;
      const result = await this.tokenService.getUserApiKeys(userId);

      if (result.success) {
        res.status(200).json({
          success: true,
          data: result.data.map(key => ({
            id: key.id,
            name: key.name,
            permissions: key.permissions,
            isActive: key.is_active,
            lastUsed: key.last_used,
            expiresAt: key.expires_at,
            createdAt: key.created_at
          }))
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Get user API keys error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch API keys'
      });
    }
  }

  async deleteApiKey(req, res) {
    try {
      const userId = req.user.id;
      const { apiKeyId } = req.params;

      const result = await this.tokenService.deleteApiKey(userId, apiKeyId);

      if (result.success) {
        res.status(200).json({
          success: true,
          data: result.data
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Delete API key error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete API key'
      });
    }
  }

  async updateApiKeyStatus(req, res) {
    try {
      const userId = req.user.id;
      const { apiKeyId } = req.params;
      const { isActive } = req.body;

      if (typeof isActive !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: 'isActive must be a boolean value'
        });
      }

      const result = await this.tokenService.updateApiKeyStatus(userId, apiKeyId, isActive);

      if (result.success) {
        res.status(200).json({
          success: true,
          data: result.data
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Update API key status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update API key status'
      });
    }
  }

  async validateApiKey(req, res) {
    try {
      const { apiKey } = req.body;

      if (!apiKey) {
        return res.status(400).json({
          success: false,
          error: 'API key is required'
        });
      }

      const result = await this.tokenService.validateApiKey(apiKey);

      if (result.success) {
        res.status(200).json({
          success: true,
          data: {
            userId: result.data.userId,
            userName: result.data.userName,
            userRole: result.data.userRole,
            permissions: result.data.permissions,
            apiKeyName: result.data.apiKeyName
          }
        });
      } else {
        res.status(401).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Validate API key error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to validate API key'
      });
    }
  }

  async checkPermission(req, res) {
    try {
      const { apiKey, permission } = req.body;

      if (!apiKey || !permission) {
        return res.status(400).json({
          success: false,
          error: 'API key and permission are required'
        });
      }

      const result = await this.tokenService.checkPermission(apiKey, permission);

      if (result.success) {
        res.status(200).json({
          success: true,
          data: {
            hasPermission: result.data.hasPermission,
            userInfo: result.data.userInfo
          }
        });
      } else {
        res.status(401).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Check permission error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check permission'
      });
    }
  }

  async createSessionToken(req, res) {
    try {
      const userId = req.user.id;
      const deviceInfo = req.headers['user-agent'] || null;
      const ipAddress = req.ip || req.connection.remoteAddress;

      const result = await this.tokenService.createSessionToken(userId, deviceInfo, ipAddress);

      if (result.success) {
        res.status(201).json({
          success: true,
          data: {
            token: result.data.token,
            expiresAt: result.data.expiresAt
          }
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Create session token error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create session token'
      });
    }
  }

  async validateSessionToken(req, res) {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          error: 'Session token is required'
        });
      }

      const result = await this.tokenService.validateSessionToken(token);

      if (result.success) {
        res.status(200).json({
          success: true,
          data: result.data
        });
      } else {
        res.status(401).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Validate session token error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to validate session token'
      });
    }
  }

  async deleteSessionToken(req, res) {
    try {
      const userId = req.user.id;
      const { token } = req.params;

      const result = await this.tokenService.deleteSessionToken(token);

      if (result.success) {
        res.status(200).json({
          success: true,
          data: result.data
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Delete session token error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete session token'
      });
    }
  }
}

module.exports = TokenController;
