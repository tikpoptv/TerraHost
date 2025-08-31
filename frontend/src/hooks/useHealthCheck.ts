'use client';

import { useState, useEffect } from 'react';
import { healthService } from '@/services/healthService';

interface HealthCheckState {
  isHealthy: boolean;
  isLoading: boolean;
  error: string | null;
  lastChecked: Date | null;
}



export function useHealthCheck(autoStart: boolean = true, interval: number = 30000) {
  const [state, setState] = useState<HealthCheckState>({
    isHealthy: false,
    isLoading: false,
    error: null,
    lastChecked: null,
  });

  const checkHealth = async (): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await healthService.checkHealth();
      
      if (result.success && result.data && typeof result.data === 'object' && 'status' in result.data && result.data.status === 'OK') {
        setState({
          isHealthy: true,
          isLoading: false,
          error: null,
          lastChecked: new Date(),
        });
        return true;
      } else {
        const statusValue = result.data && typeof result.data === 'object' && 'status' in result.data 
          ? result.data.status 
          : 'Unknown response';
        setState({
          isHealthy: false,
          isLoading: false,
          error: `API returned: ${statusValue}`,
          lastChecked: new Date(),
        });
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Network error';
      setState({
        isHealthy: false,
        isLoading: false,
        error: errorMessage,
        lastChecked: new Date(),
      });
      return false;
    }
  };

  // Auto check on mount
  useEffect(() => {
    if (autoStart) {
      checkHealth();
    }
  }, [autoStart]);

  // Periodic health check
  useEffect(() => {
    if (!autoStart || interval <= 0) return;

    const intervalId = setInterval(checkHealth, interval);
    return () => clearInterval(intervalId);
  }, [autoStart, interval]);

  return {
    ...state,
    checkHealth,
    retry: checkHealth,
  };
}
