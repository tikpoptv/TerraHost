'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import authService, { User, LoginCredentials, AuthResponse } from '@/services/authService';

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; data?: AuthResponse; error?: string }>;
  logout: () => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const updateAuthState = () => {
    const authenticated = authService.isAuthenticated();
    const currentUser = authService.getCurrentUser();
    
    console.log('🔄 Updating auth state - Authenticated:', authenticated, 'User:', currentUser?.name);
    setIsAuthenticated(authenticated);
    setUser(currentUser);
  };

  const login = async (credentials: LoginCredentials) => {
    const result = await authService.login(credentials);
    if (result.success) {
      updateAuthState();
      console.log('🔄 Auth state updated after login');
    }
    return result;
  };

  const logout = async () => {
    const result = await authService.logout();
    setIsAuthenticated(false);
    setUser(null);
    return result;
  };

  useEffect(() => {
    const initializeAuth = () => {
      try {
        updateAuthState();
        
        const hasToken = authService.hasToken();
        if (hasToken) {
          console.log('ℹ️ Token found in localStorage');
        } else {
          console.log('ℹ️ No token found');
        }
      } catch (error) {
        console.error('❌ Auth initialization error:', error);
        updateAuthState();
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    const handleStorageChange = () => {
      console.log('🔄 Storage changed, updating auth state');
      updateAuthState();
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const value: AuthContextType = {
    isAuthenticated,
    user,
    isLoading,
    login,
    logout,
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 flex items-center space-x-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
          <span className="text-gray-700">Checking authentication...</span>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
