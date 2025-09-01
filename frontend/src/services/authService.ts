import api from '@/lib/api';

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoginCredentials {
  email?: string;
  username?: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  message: string;
}

export interface AuthStatusResponse {
  active: boolean;
  authenticated: boolean;
  user: User;
  token_valid: boolean;
}

class AuthService {
  private static readonly TOKEN_KEY = 'auth_token';
  private static readonly USER_KEY = 'auth_user';
  private static readonly SESSION_KEY = 'auth_session';

  // Decode JWT token to extract session ID
  private decodeJWT(token: string): { sessionId?: string; userId?: string; exp?: number } | null {
    try {
      const payload = token.split('.')[1];
      const decoded = JSON.parse(atob(payload));
      return decoded;
    } catch (error) {
      console.error('❌ Failed to decode JWT:', error);
      return null;
    }
  }

  // Login with email or username
  async login(credentials: LoginCredentials): Promise<{ success: boolean; data?: AuthResponse; error?: string }> {
    try {
      const response = await api.post<AuthResponse>('/auth/login', credentials);

      if (response.success && response.data) {
        console.log('✅ Login response received:', { 
          user: response.data.user?.name, 
          hasToken: !!response.data.token 
        });
        
        // Store token and user data (now flattened by API client)
        this.setToken(response.data.token);
        this.setUser(response.data.user);
        
        // Extract and store session ID from JWT
        const decodedToken = this.decodeJWT(response.data.token);
        if (decodedToken?.sessionId) {
          this.setSessionId(decodedToken.sessionId);
          console.log('💾 Session ID stored:', decodedToken.sessionId);
        }
        
        return {
          success: true,
          data: response.data
        };
      } else {
        return {
          success: false,
          error: response.error || 'Login failed'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }

  // Register new user
  async register(userData: RegisterData): Promise<{ success: boolean; data?: { user: User; message: string }; error?: string }> {
    try {
      const response = await api.post<{ user: User; message: string }>('/auth/register', userData);

      if (response.success && response.data) {
        return {
          success: true,
          data: response.data
        };
      } else {
        return {
          success: false,
          error: response.error || 'Registration failed'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }

  // Logout user
  async logout(): Promise<{ success: boolean; error?: string }> {
    try {
      // Step 1: Call backend API to deactivate session
      const response = await api.post('/auth/logout');
      
      if (response.success) {
        // Step 2: Clear local storage
        this.removeToken();
        this.removeUser();
        
        // Step 3: Clear API client token
        api.removeToken();
        
        // Note: Redirect will be handled by AuthProvider when auth state changes
        return { success: true };
      } else {
        // Backend logout failed but still clear local data
        this.clearLocalAuth();
        return { success: false, error: response.error || 'Logout failed' };
      }
    } catch (error) {
      // Network error - clear local data anyway for security
      this.clearLocalAuth();
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Network error during logout' 
      };
    }
  }

  // Helper method to clear all local auth data
  private clearLocalAuth(): void {
    this.removeToken();
    this.removeUser();
    this.removeSessionId();
    api.removeToken();
    
    // Note: Redirect will be handled by AuthProvider when auth state changes
  }

  // Token management
  setToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(AuthService.TOKEN_KEY, token);
      console.log('💾 Token stored in localStorage');
    }
    // Also set in API client
    api.setToken(token);
    console.log('🔑 Token set in API client');
  }

  getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(AuthService.TOKEN_KEY);
    }
    return null;
  }

  removeToken(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(AuthService.TOKEN_KEY);
    }
    // Also remove from API client
    api.removeToken();
  }

  // User data management
  setUser(user: User): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(AuthService.USER_KEY, JSON.stringify(user));
      console.log('👤 User stored in localStorage:', user.name);
    }
  }

  getUser(): User | null {
    if (typeof window !== 'undefined') {
      const userData = localStorage.getItem(AuthService.USER_KEY);
      console.log('👤 Getting user from localStorage:', !!userData);
      if (userData) {
        try {
          const user = JSON.parse(userData);
          console.log('👤 User parsed successfully:', user.name);
          return user;
        } catch (error) {
          console.error('❌ Failed to parse user data:', error);
          return null;
        }
      }
    }
    return null;
  }

  removeUser(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(AuthService.USER_KEY);
    }
  }

  // Session ID management
  setSessionId(sessionId: string): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(AuthService.SESSION_KEY, sessionId);
        console.log('💾 Session ID stored in localStorage');
      } catch (error) {
        console.error('❌ Failed to store session ID:', error);
      }
    }
  }

  getSessionId(): string | null {
    if (typeof window !== 'undefined') {
      const sessionId = localStorage.getItem(AuthService.SESSION_KEY);
      console.log('🔍 Getting session ID from localStorage:', !!sessionId);
      return sessionId;
    }
    return null;
  }

  removeSessionId(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(AuthService.SESSION_KEY);
      console.log('🗑️ Session ID removed from localStorage');
    }
  }

  // Check if user is authenticated (local check only)
  isAuthenticated(): boolean {
    const token = this.getToken();
    const user = this.getUser();
    const sessionId = this.getSessionId();
    const authenticated = !!(token && user && sessionId);
    console.log('🔍 Auth check - Token:', !!token, 'User:', !!user, 'Session:', !!sessionId, 'Authenticated:', authenticated);
    return authenticated;
  }

  // Get current user data
  getCurrentUser(): User | null {
    return this.getUser();
  }

  // Check if token exists (doesn't verify with backend)
  hasToken(): boolean {
    return !!this.getToken();
  }

  // Check if user has specific role
  hasRole(role: string): boolean {
    const user = this.getUser();
    return user?.role === role;
  }

  // Check if user is admin
  isAdmin(): boolean {
    return this.hasRole('admin');
  }

  // Quick logout method for emergency cases (no API call)
  quickLogout(): void {
    this.clearLocalAuth();
  }

  // Check auth status with backend
  async checkAuthStatus(): Promise<{ success: boolean; data?: AuthStatusResponse; error?: string }> {
    try {
      const response = await api.get<AuthStatusResponse>('/auth/status');
      
      if (response.success && response.data?.active) {
        return {
          success: true,
          data: response.data
        };
      } else {
        // Invalid or expired token
        this.clearLocalAuth();
        return {
          success: false,
          error: 'Authentication status invalid'
        };
      }
    } catch (error) {
      // Network error or server error
      // Don't clear auth data on network errors, might be temporary
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check auth status'
      };
    }
  }

  // Initialize auth state (call on app startup)
  async initializeAuth(): Promise<{ success: boolean; authenticated: boolean }> {
    const token = this.getToken();
    
    if (!token) {
      // No token stored
      return { success: true, authenticated: false };
    }

    // Set token in API client for the status check
    api.setToken(token);

    try {
      // Verify token with backend
      const statusResult = await this.checkAuthStatus();
      
      if (statusResult.success) {
        // Token is valid and user is authenticated
        return { success: true, authenticated: true };
      } else {
        // Token is invalid or expired, already cleared by checkAuthStatus
        return { success: true, authenticated: false };
      }
    } catch (error) {
      // Network error - keep token for now, user can try later
      console.warn('Auth check failed:', error);
      return { success: false, authenticated: false };
    }
  }

  // Validate login form
  validateLoginForm(credentials: LoginCredentials): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check email or username (at least one must be provided)
    if (!credentials.email && !credentials.username) {
      errors.push('Email หรือชื่อผู้ใช้จำเป็นต้องระบุ');
    }

    // Validate email format if email is provided
    if (credentials.email) {
      if (credentials.email.trim().length === 0) {
        errors.push('อีเมลไม่สามารถเป็นค่าว่างได้');
      } else {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(credentials.email)) {
          errors.push('รูปแบบอีเมลไม่ถูกต้อง');
        }
      }
    }

    // Validate username format if username is provided
    if (credentials.username) {
      if (credentials.username.trim().length === 0) {
        errors.push('ชื่อผู้ใช้ไม่สามารถเป็นค่าว่างได้');
      } else if (credentials.username.length < 3) {
        errors.push('ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร');
      } else if (!/^[a-zA-Z0-9_]+$/.test(credentials.username)) {
        errors.push('ชื่อผู้ใช้สามารถใช้ได้เฉพาะ a-z, A-Z, 0-9, และ _');
      }
    }

    // Check password
    if (!credentials.password) {
      errors.push('รหัสผ่านจำเป็นต้องระบุ');
    } else if (credentials.password.length < 6) {
      errors.push('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Validate registration form
  validateRegisterForm(userData: RegisterData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check name
    if (!userData.name || userData.name.trim().length < 2) {
      errors.push('Name must be at least 2 characters');
    }

    // Check email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!userData.email || !emailRegex.test(userData.email)) {
      errors.push('Valid email is required');
    }

    // Check password
    if (!userData.password || userData.password.length < 6) {
      errors.push('Password must be at least 6 characters');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

const authService = new AuthService();
export default authService;
