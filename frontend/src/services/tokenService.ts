import api from '@/lib/api';

export interface ApiKey {
  id: string;
  name: string;
  permissions: string[];
  isActive: boolean;
  lastUsed?: string;
  expiresAt?: string;
  createdAt: string;
}

export interface CreateApiKeyRequest {
  name: string;
  permissions: string[];
  expiresAt?: string;
}

export interface CreateApiKeyResponse {
  id: string;
  name: string;
  permissions: string[];
  isActive: boolean;
  expiresAt?: string;
  createdAt: string;
  apiKey: string; // Show once only
}

export interface PermissionCheckResponse {
  hasPermission: boolean;
  userInfo: {
    userId: string;
    userName: string;
    userRole: string;
    permissions: string[];
    apiKeyName: string;
  };
}

class TokenService {
  /**
   * Create new API key
   */
  async createApiKey(data: CreateApiKeyRequest): Promise<{ success: boolean; data?: CreateApiKeyResponse; error?: string }> {
    try {
      const response = await api.post<CreateApiKeyResponse>('/tokens/create', data);
      return response;
    } catch (error) {
      console.error('Create API key error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create API key'
      };
    }
  }

  /**
   * Get user API keys list
   */
  async getUserApiKeys(): Promise<{ success: boolean; data?: ApiKey[]; error?: string }> {
    try {
      const response = await api.get<ApiKey[]>('/tokens/list');
      return response;
    } catch (error) {
      console.error('Get user API keys error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch API keys'
      };
    }
  }

  /**
   * Delete API key
   */
  async deleteApiKey(apiKeyId: string): Promise<{ success: boolean; data?: { message: string }; error?: string }> {
    try {
      const response = await api.delete<{ message: string }>(`/tokens/${apiKeyId}`);
      return response;
    } catch (error) {
      console.error('Delete API key error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete API key'
      };
    }
  }

  /**
   * Update API key status
   */
  async updateApiKeyStatus(apiKeyId: string, isActive: boolean): Promise<{ success: boolean; data?: { id: string; isActive: boolean }; error?: string }> {
    try {
      const response = await api.patch<{ id: string; isActive: boolean }>(`/tokens/${apiKeyId}/status`, { isActive });
      return response;
    } catch (error) {
      console.error('Update API key status error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update API key status'
      };
    }
  }

  /**
   * Validate API key (for external API)
   */
  async validateApiKey(apiKey: string): Promise<{ success: boolean; data?: { userId: string; userName: string; userRole: string; permissions: string[]; apiKeyName: string }; error?: string }> {
    try {
      const response = await api.post<{ userId: string; userName: string; userRole: string; permissions: string[]; apiKeyName: string }>('/tokens/validate', { apiKey });
      return response;
    } catch (error) {
      console.error('Validate API key error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to validate API key'
      };
    }
  }

  /**
   * Check permissions
   */
  async checkPermission(apiKey: string, permission: string): Promise<{ success: boolean; data?: PermissionCheckResponse; error?: string }> {
    try {
      const response = await api.post<PermissionCheckResponse>('/tokens/check-permission', { apiKey, permission });
      return response;
    } catch (error) {
      console.error('Check permission error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check permission'
      };
    }
  }

  /**
   * Create session token
   */
  async createSessionToken(): Promise<{ success: boolean; data?: { token: string; expiresAt: string }; error?: string }> {
    try {
      const response = await api.post<{ token: string; expiresAt: string }>('/tokens/session/create');
      return response;
    } catch (error) {
      console.error('Create session token error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create session token'
      };
    }
  }

  /**
   * Validate session token
   */
  async validateSessionToken(token: string): Promise<{ success: boolean; data?: { userId: string; userName: string; userRole: string }; error?: string }> {
    try {
      const response = await api.post<{ userId: string; userName: string; userRole: string }>('/tokens/session/validate', { token });
      return response;
    } catch (error) {
      console.error('Validate session token error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to validate session token'
      };
    }
  }

  /**
   * Delete session token
   */
  async deleteSessionToken(token: string): Promise<{ success: boolean; data?: { message: string }; error?: string }> {
    try {
      const response = await api.delete<{ message: string }>(`/tokens/session/${token}`);
      return response;
    } catch (error) {
      console.error('Delete session token error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete session token'
      };
    }
  }

  /**
   * Available permissions
   */
  getAvailablePermissions() {
    return [
      { value: 'read:files', label: 'Read File List', description: 'View GeoTIFF file list' },
      { value: 'read:metadata', label: 'Read Metadata', description: 'View file metadata information' },
      { value: 'query:spatial', label: 'Spatial Data Query', description: 'Search by coordinates and boundaries' },
      { value: 'write:files', label: 'Upload Files', description: 'Upload new GeoTIFF files' },
      { value: 'process:files', label: 'Process Files', description: 'Start file processing' },
      { value: 'delete:files', label: 'Delete Files', description: 'Delete files from system' },
      { value: 'admin:users', label: 'Manage Users', description: 'Manage users and permissions (Admin only)' }
    ];
  }

  /**
   * แปลงสิทธิ์เป็นข้อความภาษาไทย
   */
  getPermissionLabel(permission: string): string {
    const permissions = this.getAvailablePermissions();
    const found = permissions.find(p => p.value === permission);
    return found ? found.label : permission;
  }

  /**
   * แปลงสิทธิ์เป็นคำอธิบาย
   */
  getPermissionDescription(permission: string): string {
    const permissions = this.getAvailablePermissions();
    const found = permissions.find(p => p.value === permission);
    return found ? found.description : '';
  }

  /**
   * จัดกลุ่มสิทธิ์ตามประเภท
   */
  getPermissionGroups() {
    return [
      {
        name: 'Data Reading',
        permissions: ['read:files', 'read:metadata', 'query:spatial']
      },
      {
        name: 'File Management',
        permissions: ['write:files', 'process:files', 'delete:files']
      },
      {
        name: 'System Management',
        permissions: ['admin:users']
      }
    ];
  }

  /**
   * ตรวจสอบว่าสิทธิ์เป็น admin หรือไม่
   */
  isAdminPermission(permission: string): boolean {
    return permission.startsWith('admin:');
  }

  /**
   * สร้าง API key name แบบแนะนำ
   */
  generateSuggestedName(): string {
    const timestamp = new Date().toISOString().slice(0, 10);
    return `API Key ${timestamp}`;
  }

  /**
   * ตรวจสอบความถูกต้องของ API key name
   */
  validateApiKeyName(name: string): { isValid: boolean; error?: string } {
    if (!name || name.trim().length === 0) {
      return { isValid: false, error: 'API key name cannot be empty' };
    }
    
    if (name.length > 255) {
      return { isValid: false, error: 'API key name must not exceed 255 characters' };
    }

    if (name.trim().length < 3) {
      return { isValid: false, error: 'API key name must be at least 3 characters' };
    }

    return { isValid: true };
  }

  /**
   * ตรวจสอบความถูกต้องของสิทธิ์
   */
  validatePermissions(permissions: string[]): { isValid: boolean; error?: string } {
    if (!permissions || permissions.length === 0) {
      return { isValid: false, error: 'Must select at least 1 permission' };
    }

    const availablePermissions = this.getAvailablePermissions().map(p => p.value);
    const invalidPermissions = permissions.filter(p => !availablePermissions.includes(p));

    if (invalidPermissions.length > 0) {
      return { 
        isValid: false, 
        error: `Invalid permissions: ${invalidPermissions.join(', ')}` 
      };
    }

    return { isValid: true };
  }
}

// Export singleton instance
const tokenService = new TokenService();
export default tokenService;
