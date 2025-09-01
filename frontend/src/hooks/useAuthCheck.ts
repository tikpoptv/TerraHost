'use client';

import { useState } from 'react';
import authService from '@/services/authService';

interface AuthCheckState {
  isChecking: boolean;
  lastChecked: Date | null;
  checkAuth: () => Promise<{ success: boolean; authenticated: boolean }>;
}

export function useAuthCheck(): AuthCheckState {
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkAuth = async (): Promise<{ success: boolean; authenticated: boolean }> => {
    if (isChecking) {
      return { success: false, authenticated: false };
    }

    setIsChecking(true);
    
    try {
      const result = await authService.checkAuthStatus();
      
      if (result.success) {
        setLastChecked(new Date());
        return { success: true, authenticated: true };
      } else {
        // Auth check failed - token invalid/expired
        setLastChecked(new Date());
        return { success: true, authenticated: false };
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      return { success: false, authenticated: false };
    } finally {
      setIsChecking(false);
    }
  };

  return {
    isChecking,
    lastChecked,
    checkAuth,
  };
}
