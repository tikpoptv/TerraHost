interface EnvironmentConfig {
  apiUrl: string;
  nodeEnv: string;
  isDevelopment: boolean;
  isProduction: boolean;
  telemetryDisabled: boolean;
}

class EnvironmentManager {
  private config: EnvironmentConfig;
  private initialized: boolean = false;

  constructor() {
    this.config = this.loadEnvironmentVariables();
    this.validateConfig();
    this.initialized = true;
    this.logConfiguration();
  }

  private loadEnvironmentVariables(): EnvironmentConfig {
    const nodeEnv = process.env.NODE_ENV || 'development';
    const isDevelopment = nodeEnv === 'development';
    const isProduction = nodeEnv === 'production';
    
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    
    // No fallback - environment variable is required in all modes
    if (!apiUrl) {
      throw new Error('NEXT_PUBLIC_API_URL environment variable is required. Please set this variable in your environment.');
    }
    
    return {
      apiUrl,
      nodeEnv,
      isDevelopment,
      isProduction,
      telemetryDisabled: process.env.NEXT_TELEMETRY_DISABLED === '1'
    };
  }

  private validateConfig(): void {
    const errors: string[] = [];

    if (!this.config.apiUrl) {
      errors.push('API URL is required');
    }

    if (!this.config.apiUrl.startsWith('http')) {
      errors.push('API URL must start with http or https');
    }

    // Strict validation for production
    if (this.config.isProduction) {
      if (this.config.apiUrl.includes('localhost')) {
        errors.push('Cannot use localhost API URL in production environment');
      }
      
      if (!this.config.apiUrl.startsWith('https')) {
        errors.push('Production API URL must use HTTPS');
      }
      
      if (!process.env.NEXT_PUBLIC_API_URL) {
        errors.push('NEXT_PUBLIC_API_URL environment variable must be explicitly set in production');
      }
    }

    if (errors.length > 0) {
      throw new Error(`Environment configuration errors: ${errors.join(', ')}`);
    }
  }

  private logConfiguration(): void {
    console.log('TerraHost Environment Configuration:', {
      apiUrl: this.config.apiUrl,
      nodeEnv: this.config.nodeEnv,
      isDevelopment: this.config.isDevelopment,
      isProduction: this.config.isProduction,
      timestamp: new Date().toISOString(),
      initialized: this.initialized,
      rawEnvVars: {
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
        NODE_ENV: process.env.NODE_ENV
      }
    });
  }

  public getApiUrl(): string {
    return this.config.apiUrl;
  }

  public getNodeEnv(): string {
    return this.config.nodeEnv;
  }

  public isDevelopment(): boolean {
    return this.config.isDevelopment;
  }

  public isProduction(): boolean {
    return this.config.isProduction;
  }

  public getConfig(): Readonly<EnvironmentConfig> {
    return { ...this.config };
  }

  public debugInfo(): Record<string, string | boolean | EnvironmentConfig | Record<string, string | undefined>> {
    return {
      config: this.config,
      processEnv: {
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
        NODE_ENV: process.env.NODE_ENV,
        NEXT_TELEMETRY_DISABLED: process.env.NEXT_TELEMETRY_DISABLED
      },
      initialized: this.initialized
    };
  }
}

export const envConfig = new EnvironmentManager();
export default envConfig;
