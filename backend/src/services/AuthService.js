const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const DatabaseService = require('./DatabaseService');

class AuthService {
  
  // Register new user
  async register(userData) {
    try {
      const { name, email, password } = userData;

      // Check if user already exists
      const existingUser = await DatabaseService.findAll('users', { email });
      if (existingUser.success && existingUser.data.length > 0) {
        return {
          success: false,
          error: 'Email already registered'
        };
      }

      // Hash password
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Create user
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

      // Remove password_hash from response
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

  // Login user
  async login(emailOrUsername, password) {
    try {
      // Find user by email or username (using email field for both)
      let userResult;
      
      // Check if input looks like email
      const isEmail = emailOrUsername.includes('@');
      
      if (isEmail) {
        // Search by email
        userResult = await DatabaseService.findAll('users', { email: emailOrUsername });
      } else {
        // Search by username (stored in name field for now)
        userResult = await DatabaseService.findAll('users', { name: emailOrUsername });
      }
      
      if (!userResult.success || userResult.data.length === 0) {
        return {
          success: false,
          error: 'Invalid email/username or password'
        };
      }

      const user = userResult.data[0];

      // Check if user is active
      if (!user.is_active) {
        return {
          success: false,
          error: 'Account is not activated'
        };
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        return {
          success: false,
          error: 'Invalid email/username or password'
        };
      }

      // Step 1: Create session record first (with placeholder token hash)
      const sessionData = {
        user_id: user.id,
        token_hash: 'placeholder_hash', // Temporary placeholder
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

      // Step 2: Generate JWT token with session ID
      const token = this.generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
        sessionId: sessionId  // แนบ session ID ไปใน JWT
      });

      console.log('🔑 JWT token generated with session ID:', sessionId);

      // Step 3: Update session with token hash
      const updateResult = await DatabaseService.updateById('user_sessions', sessionId, {
        token_hash: this.hashToken(token)
      });

      if (!updateResult.success) {
        console.error('❌ Failed to update session with token hash:', updateResult.error);
        // Clean up the session if token hash update fails
        await DatabaseService.deleteById('user_sessions', sessionId);
        return {
          success: false,
          error: 'Failed to finalize session'
        };
      }

      console.log('✅ Session updated with token hash successfully');

      // Remove password_hash from response
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

  // Logout user (deactivate session by session ID)
  async logout(sessionId) {
    try {
      // Deactivate session by ID (much more efficient)
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

  // Generate JWT token
  generateToken(payload) {
    const secret = process.env.JWT_SECRET || 'your-default-secret-key';
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
    
    return jwt.sign(payload, secret, { expiresIn });
  }

  // Hash token for storage
  hashToken(token) {
    return bcrypt.hashSync(token.substring(0, 20), 10); // Hash first 20 chars
  }

  // Get token expiry date
  getTokenExpiry() {
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
    const days = parseInt(expiresIn.replace('d', '')) || 7;
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + days);
    return expiry;
  }

  // Validate login data
  validateLoginData(data) {
    const errors = [];

    // Email or username validation
    if (!data.email && !data.username) {
      errors.push('Email or username is required');
    }

    // Password validation
    if (!data.password) {
      errors.push('Password is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Validate registration data
  validateRegistrationData(data) {
    const errors = [];

    // Name validation
    if (!data.name || data.name.trim().length < 2) {
      errors.push('Name must be at least 2 characters');
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!data.email || !emailRegex.test(data.email)) {
      errors.push('Valid email is required');
    }

    // Password validation
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
