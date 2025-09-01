const BaseController = require('./BaseController');
const AuthService = require('../services/AuthService');
const AuthMiddleware = require('../middleware/authMiddleware');

class AuthController extends BaseController {
  initializeRoutes() {
    this.router.post('/register', this.register.bind(this));
    this.router.post('/login', this.login.bind(this));
    this.router.get('/status', AuthMiddleware.verifyToken, this.getAuthStatus.bind(this));
    this.router.post('/logout', AuthMiddleware.verifyToken, this.logout.bind(this));
  }

  async register(req, res) {
    try {
      // Validate input data
      const validation = AuthService.validateRegistrationData(req.body);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.errors
        });
      }

      // Register user
      const result = await AuthService.register(req.body);

      if (!result.success) {
        const statusCode = result.error === 'Email already registered' ? 409 : 400;
        return res.status(statusCode).json({
          success: false,
          error: result.error
        });
      }

      res.status(201).json({
        success: true,
        data: result.data
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async login(req, res) {
    try {
      // Validate input data
      const validation = AuthService.validateLoginData(req.body);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validation.errors
        });
      }

      // Login user
      const { email, username, password } = req.body;
      const emailOrUsername = email || username;
      const result = await AuthService.login(emailOrUsername, password);

      if (!result.success) {
        const statusCode = result.error.includes('Account is not activated') ? 403 : 401;
        return res.status(statusCode).json({
          success: false,
          error: result.error
        });
      }

      res.status(200).json({
        success: true,
        data: result.data
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Get current auth status
  async getAuthStatus(req, res) {
    try {
      // User info and session ID are already validated by middleware
      const user = req.user;
      const sessionId = req.sessionId;
      
      res.status(200).json({
        success: true,
        data: {
          active: true,
          authenticated: true,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            is_active: user.is_active
          },
          session: {
            id: sessionId,
            active: true
          },
          token_valid: true
        }
      });
    } catch (error) {
      console.error('Auth status error:', error);
      res.status(500).json({ 
        success: false, 
        data: { active: false, authenticated: false },
        error: 'Internal server error' 
      });
    }
  }

  // Logout user (deactivate session)
  async logout(req, res) {
    try {
      const sessionId = req.sessionId; // มาจาก JWT ที่ decode ใน middleware

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          error: 'Session ID not found in token'
        });
      }

      // Deactivate current session
      const result = await AuthService.logout(sessionId);
      
      if (result.success) {
        res.status(200).json({
          success: true,
          data: { message: 'Logged out successfully' }
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error || 'Logout failed'
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
}

module.exports = AuthController;
