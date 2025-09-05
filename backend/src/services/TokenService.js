const crypto = require('crypto');
const DatabaseService = require('./DatabaseService');

class TokenService {
  constructor() {
    this.db = DatabaseService;
  }

  async createApiKey(userId, name, permissions = [], expiresAt = null) {
    try {
      console.log('🔑 Creating API key with params:', { userId, name, permissions, expiresAt });
      
      const apiKey = this.generateApiKey();
      const keyHash = this.hashApiKey(apiKey);
      
      console.log('🔑 Generated API key hash:', keyHash.substring(0, 20) + '...');

      const query = `
        INSERT INTO api_keys (user_id, name, key_hash, permissions, expires_at)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, name, permissions, is_active, expires_at, created_at
      `;

      const expiresAtValue = expiresAt && expiresAt.trim() !== '' ? expiresAt : null;
      
      console.log('🔑 Executing query with params:', [userId, name, keyHash.substring(0, 20) + '...', permissions, expiresAtValue]);

      const result = await this.db.executeQuery(query, [
        userId, name, keyHash, permissions, expiresAtValue
      ]);

      console.log('🔑 Database result:', result);

      if (result.success && result.data.length > 0) {
        return {
          success: true,
          data: {
            ...result.data[0],
            apiKey: apiKey
          }
        };
      }

      console.error('🔑 Database operation failed:', result);
      throw new Error(`Database operation failed: ${result.error || 'Unknown error'}`);
    } catch (error) {
      console.error('🔑 Create API key error:', error);
      console.error('🔑 Error stack:', error.stack);
      return {
        success: false,
        error: `Failed to create API key: ${error.message}`
      };
    }
  }

  async validateApiKey(apiKey) {
    try {
      const keyHash = this.hashApiKey(apiKey);

      const query = `
        SELECT 
          ak.id, ak.name, ak.permissions, ak.is_active, ak.expires_at,
          u.id as user_id, u.name as user_name, u.role, u.is_active as user_active
        FROM api_keys ak
        JOIN users u ON ak.user_id = u.id
        WHERE ak.key_hash = $1
      `;

      const result = await this.db.executeQuery(query, [keyHash]);

      if (!result.success || result.data.length === 0) {
        return {
          success: false,
          error: 'Invalid API key'
        };
      }

      const apiKeyData = result.data[0];

      if (!apiKeyData.is_active || !apiKeyData.user_active) {
        return {
          success: false,
          error: 'API key is inactive or user is disabled'
        };
      }

      if (apiKeyData.expires_at && new Date(apiKeyData.expires_at) < new Date()) {
        return {
          success: false,
          error: 'API key has expired'
        };
      }

      await this.updateLastUsed(apiKeyData.id);

      return {
        success: true,
        data: {
          userId: apiKeyData.user_id,
          userName: apiKeyData.user_name,
          userRole: apiKeyData.user_role,
          permissions: apiKeyData.permissions,
          apiKeyName: apiKeyData.name
        }
      };
    } catch (error) {
      console.error('Validate API key error:', error);
      return {
        success: false,
        error: `Failed to validate API key: ${error.message}`
      };
    }
  }

  async checkPermission(apiKey, requiredPermission) {
    try {
      const validation = await this.validateApiKey(apiKey);
      
      if (!validation.success) {
        return {
          success: false,
          error: validation.error
        };
      }

      const hasPermission = validation.data.permissions.includes(requiredPermission);
      
      return {
        success: true,
        data: {
          hasPermission,
          userInfo: validation.data
        }
      };
    } catch (error) {
      console.error('Check permission error:', error);
      return {
        success: false,
        error: `Failed to check permission: ${error.message}`
      };
    }
  }

  async getUserApiKeys(userId) {
    try {
      const query = `
        SELECT 
          id, name, permissions, is_active, last_used, expires_at, created_at
        FROM api_keys
        WHERE user_id = $1
        ORDER BY created_at DESC
      `;

      const result = await this.db.executeQuery(query, [userId]);

      if (result.success) {
        return {
          success: true,
          data: result.data
        };
      }

      throw new Error('Failed to fetch API keys');
    } catch (error) {
      console.error('Get user API keys error:', error);
      return {
        success: false,
        error: `Failed to fetch API keys: ${error.message}`
      };
    }
  }

  async deleteApiKey(userId, apiKeyId) {
    try {
      const query = `
        DELETE FROM api_keys
        WHERE id = $1 AND user_id = $2
        RETURNING id
      `;

      const result = await this.db.executeQuery(query, [apiKeyId, userId]);

      if (result.success && result.data.length > 0) {
        return {
          success: true,
          data: { message: 'API key deleted successfully' }
        };
      }

      return {
        success: false,
        error: 'API key not found or access denied'
      };
    } catch (error) {
      console.error('Delete API key error:', error);
      return {
        success: false,
        error: `Failed to delete API key: ${error.message}`
      };
    }
  }

  async updateApiKeyStatus(userId, apiKeyId, isActive) {
    try {
      const query = `
        UPDATE api_keys
        SET is_active = $3
        WHERE id = $1 AND user_id = $2
        RETURNING id, is_active
      `;

      const result = await this.db.executeQuery(query, [apiKeyId, userId, isActive]);

      if (result.success && result.data.length > 0) {
        return {
          success: true,
          data: result.data[0]
        };
      }

      return {
        success: false,
        error: 'API key not found or access denied'
      };
    } catch (error) {
      console.error('Update API key status error:', error);
      return {
        success: false,
        error: `Failed to update API key status: ${error.message}`
      };
    }
  }

  async updateLastUsed(apiKeyId) {
    try {
      const query = `
        UPDATE api_keys
        SET last_used = NOW()
        WHERE id = $1
      `;

      await this.db.executeQuery(query, [apiKeyId]);
    } catch (error) {
      console.error('Update last used error:', error);
    }
  }

  generateApiKey() {
    const prefix = 'th_';
    const randomBytes = crypto.randomBytes(32).toString('hex');
    const timestamp = Date.now().toString(36);
    return `${prefix}${randomBytes}${timestamp}`;
  }

  hashApiKey(apiKey) {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  async createSessionToken(userId, deviceInfo = null, ipAddress = null) {
    try {
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = this.hashApiKey(token);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const query = `
        INSERT INTO user_sessions (user_id, token_hash, device_info, ip_address, expires_at)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, expires_at
      `;

      const result = await this.db.executeQuery(query, [
        userId, tokenHash, deviceInfo, ipAddress, expiresAt
      ]);

      if (result.success && result.data.length > 0) {
        return {
          success: true,
          data: {
            token,
            expiresAt: result.data[0].expires_at
          }
        };
      }

      throw new Error('Failed to create session token');
    } catch (error) {
      console.error('Create session token error:', error);
      return {
        success: false,
        error: `Failed to create session token: ${error.message}`
      };
    }
  }

  async validateSessionToken(token) {
    try {
      const tokenHash = this.hashApiKey(token);

      const query = `
        SELECT 
          us.id, us.user_id, us.expires_at,
          u.name, u.role, u.is_active
        FROM user_sessions us
        JOIN users u ON us.user_id = u.id
        WHERE us.token_hash = $1 AND us.is_active = true
      `;

      const result = await this.db.executeQuery(query, [tokenHash]);

      if (!result.success || result.data.length === 0) {
        return {
          success: false,
          error: 'Invalid session token'
        };
      }

      const sessionData = result.data[0];

      if (new Date(sessionData.expires_at) < new Date()) {
        return {
          success: false,
          error: 'Session token has expired'
        };
      }

      if (!sessionData.is_active) {
        return {
          success: false,
          error: 'User account is disabled'
        };
      }

      await this.updateSessionLastUsed(sessionData.id);

      return {
        success: true,
        data: {
          userId: sessionData.user_id,
          userName: sessionData.user_name,
          userRole: sessionData.user_role
        }
      };
    } catch (error) {
      console.error('Validate session token error:', error);
      return {
        success: false,
        error: `Failed to validate session token: ${error.message}`
      };
    }
  }

  async updateSessionLastUsed(sessionId) {
    try {
      const query = `
        UPDATE user_sessions
        SET last_used = NOW()
        WHERE id = $1
      `;

      await this.db.executeQuery(query, [sessionId]);
    } catch (error) {
      console.error('Update session last used error:', error);
    }
  }

  async deleteSessionToken(token) {
    try {
      const tokenHash = this.hashApiKey(token);

      const query = `
        UPDATE user_sessions
        SET is_active = false
        WHERE token_hash = $1
      `;

      const result = await this.db.executeQuery(query, [tokenHash]);

      return {
        success: true,
        data: { message: 'Session token deleted successfully' }
      };
    } catch (error) {
      console.error('Delete session token error:', error);
      return {
        success: false,
        error: `Failed to delete session token: ${error.message}`
      };
    }
  }
}

module.exports = TokenService;
