// Debug utility for environment variables in production
// Only use this temporarily to debug env issues

export async function debugEnvironmentVariables() {
  if (typeof window !== 'undefined') {
    console.group('Environment Variables Debug');
    console.log('Current location:', window.location.href);
    console.log('User agent:', navigator.userAgent);
    console.log('Process env variables:', {
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
      NODE_ENV: process.env.NODE_ENV,
      NEXT_TELEMETRY_DISABLED: process.env.NEXT_TELEMETRY_DISABLED
    });
    
    // Test if we can access the config
    try {
      const { default: envConfig } = await import('@/config/env');
      console.log('Environment config loaded:', envConfig.debugInfo());
      console.log('API URL from config:', envConfig.getApiUrl());
    } catch (error) {
      console.error('Failed to load environment config:', error);
    }
    
    console.groupEnd();
  }
}

// Auto-run in browser console for easy debugging
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).debugTerraHostEnv = debugEnvironmentVariables;
}
