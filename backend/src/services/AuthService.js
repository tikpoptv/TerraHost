const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const DatabaseService = require('./DatabaseService');

class AuthService {
  
  async register(userData) {
    try {
      const { name, email, password } = userData;

      const existingUser = await DatabaseService.findAll('users', { email });
      if (existingUser.success && existingUser.data.length > 0) {
        return {
          success: false,
          error: 'Email already registered'
        };
      }

      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      const newUser = await DatabaseService.create('users', {
        name,
        email,
        password_hash: passwordHash,
        role: 'user',
        is_active: false,
        email_verified: false
      });

      if (!newUser.success) {
        return {
          success: false,
          error: newUser.error
        };
      }

      const { password_hash, ...userWithoutPassword } = newUser.data;

      return {
        success: true,
        data: {
          user: userWithoutPassword,
          message: 'User registered successfully'
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async login(emailOrUsername, password) {
    try {
      let userResult;
      
      const isEmail = emailOrUsername.includes('@');
      
      if (isEmail) {
        userResult = await DatabaseService.findAll('users', { email: emailOrUsername });
      } else {
        userResult = await DatabaseService.findAll('users', { name: emailOrUsername });
      }
      
      if (!userResult.success || userResult.data.length === 0) {
        return {
          success: false,
          error: 'Invalid email/username or password'
        };
      }

      const user = userResult.data[0];

      if (!user.is_active) {
        return {
          success: false,
          error: 'Account is not activated'
        };
      }

      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        return {
          success: false,
          error: 'Invalid email/username or password'
        };
      }

      const sessionData = {
        user_id: user.id,
        token_hash: 'placeholder_hash',
        expires_at: this.getTokenExpiry(),
        created_at: new Date(),
        last_used: new Date(),
        is_active: true
      };

      console.log('💾 Creating session with data:', sessionData);
      const sessionResult = await DatabaseService.create('user_sessions', sessionData);
      
      console.log('💾 Session creation result:', {
        success: sessionResult.success,
        error: sessionResult.error,
        sessionId: sessionResult.data?.id
      });
      
      if (!sessionResult.success) {
        console.error('❌ Session creation failed:', sessionResult.error);
        return {
          success: false,
          error: `Failed to create session: ${sessionResult.error}`
        };
      }

      const sessionId = sessionResult.data.id;
      console.log('✅ Session created successfully with ID:', sessionId);

      const token = this.generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        sessionId: sessionId
      });

      console.log('🔑 JWT token generated with session ID:', sessionId);

      const updateResult = await DatabaseService.updateById('user_sessions', sessionId, {
        token_hash: this.hashToken(token)
      });

      if (!updateResult.success) {
        console.error('❌ Failed to update session with token hash:', updateResult.error);
        await DatabaseService.deleteById('user_sessions', sessionId);
        return {
          success: false,
          error: 'Failed to finalize session'
        };
      }

      console.log('✅ Session updated with token hash successfully');

      const { password_hash, ...userWithoutPassword } = user;

      return {
        success: true,
        data: {
          user: userWithoutPassword,
          token,
          message: 'Login successful'
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async logout(sessionId) {
    try {
      const updateResult = await DatabaseService.updateById('user_sessions', sessionId, {
        is_active: false,
        deleted_at: new Date()
      });

      if (updateResult.success) {
        return {
          success: true,
          data: { message: 'Session deactivated successfully' }
        };
      } else {
        return {
          success: false,
          error: 'Failed to deactivate session'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  generateToken(payload) {
    const secret = process.env.JWT_SECRET || 'your-default-secret-key';
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
    
    return jwt.sign(payload, secret, { expiresIn });
  }

  hashToken(token) {
    return bcrypt.hashSync(token.substring(0, 20), 10);
  }

  getTokenExpiry() {
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
    const days = parseInt(expiresIn.replace('d', '')) || 7;
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + days);
    return expiry;
  }

  validateLoginData(data) {
    const errors = [];

    if (!data.email && !data.username) {
      errors.push('Email or username is required');
    }

    if (!data.password) {
      errors.push('Password is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  validateRegistrationData(data) {
    const errors = [];

    if (!data.name || data.name.trim().length < 2) {
      errors.push('Name must be at least 2 characters');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!data.email || !emailRegex.test(data.email)) {
      errors.push('Valid email is required');
    }

    if (!data.password || data.password.length < 6) {
      errors.push('Password must be at least 6 characters');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = new AuthService();
