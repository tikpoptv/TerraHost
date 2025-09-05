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

  async login(credentials: LoginCredentials): Promise<{ success: boolean; data?: AuthResponse; error?: string }> {
    try {
      const response = await api.post<AuthResponse>('/auth/login', credentials);

      if (response.success && response.data) {
        console.log('✅ Login response received:', { 
          user: response.data.user?.name, 
          hasToken: !!response.data.token 
        });
        
        this.setToken(response.data.token);
        this.setUser(response.data.user);
        
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

  async logout(): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await api.post('/auth/logout');
      
      if (response.success) {
        this.removeToken();
        this.removeUser();
        
        api.removeToken();
        
        return { success: true };
      } else {
        this.clearLocalAuth();
        return { success: false, error: response.error || 'Logout failed' };
      }
    } catch (error) {
      this.clearLocalAuth();
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Network error during logout' 
      };
    }
  }

  private clearLocalAuth(): void {
    this.removeToken();
    this.removeUser();
    this.removeSessionId();
    api.removeToken();
    
  }

  setToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(AuthService.TOKEN_KEY, token);
      console.log('💾 Token stored in localStorage');
    }
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
    api.removeToken();
  }

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

  isAuthenticated(): boolean {
    const token = this.getToken();
    const user = this.getUser();
    const sessionId = this.getSessionId();
    const authenticated = !!(token && user && sessionId);
    console.log('🔍 Auth check - Token:', !!token, 'User:', !!user, 'Session:', !!sessionId, 'Authenticated:', authenticated);
    return authenticated;
  }

  getCurrentUser(): User | null {
    return this.getUser();
  }

  hasToken(): boolean {
    return !!this.getToken();
  }

  hasRole(role: string): boolean {
    const user = this.getUser();
    return user?.role === role;
  }

  isAdmin(): boolean {
    return this.hasRole('admin');
  }

  quickLogout(): void {
    this.clearLocalAuth();
  }

  async checkAuthStatus(): Promise<{ success: boolean; data?: AuthStatusResponse; error?: string }> {
    try {
      const response = await api.get<AuthStatusResponse>('/auth/status');
      
      if (response.success && response.data?.active) {
        return {
          success: true,
          data: response.data
        };
      } else {
        this.clearLocalAuth();
        return {
          success: false,
          error: 'Authentication status invalid'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check auth status'
      };
    }
  }

  async initializeAuth(): Promise<{ success: boolean; authenticated: boolean }> {
    const token = this.getToken();
    
    if (!token) {
      return { success: true, authenticated: false };
    }

    api.setToken(token);

    try {
      const statusResult = await this.checkAuthStatus();
      
      if (statusResult.success) {
        return { success: true, authenticated: true };
      } else {
        return { success: true, authenticated: false };
      }
    } catch (error) {
      console.warn('Auth check failed:', error);
      return { success: false, authenticated: false };
    }
  }

  validateLoginForm(credentials: LoginCredentials): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!credentials.email && !credentials.username) {
      errors.push('Email or username is required');
    }

    if (credentials.email) {
      if (credentials.email.trim().length === 0) {
        errors.push('Email cannot be empty');
      } else {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(credentials.email)) {
          errors.push('Invalid email format');
        }
      }
    }

    if (credentials.username) {
      if (credentials.username.trim().length === 0) {
        errors.push('Username cannot be empty');
      } else if (credentials.username.length < 3) {
        errors.push('Username must be at least 3 characters');
      } else if (!/^[a-zA-Z0-9_]+$/.test(credentials.username)) {
        errors.push('Username can only contain a-z, A-Z, 0-9, and _');
      }
    }

    if (!credentials.password) {
      errors.push('Password is required');
    } else if (credentials.password.length < 6) {
      errors.push('Password must be at least 6 characters');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  validateRegisterForm(userData: RegisterData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!userData.name || userData.name.trim().length < 2) {
      errors.push('Name must be at least 2 characters');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!userData.email || !emailRegex.test(userData.email)) {
      errors.push('Valid email is required');
    }

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
