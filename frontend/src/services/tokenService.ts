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
  apiKey: string; // แสดงครั้งเดียว
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
   * สร้าง API key ใหม่
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
   * ดึงรายการ API key ของผู้ใช้
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
   * ลบ API key
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
   * อัปเดตสถานะ API key
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
   * ตรวจสอบ API key (สำหรับ external API)
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
   * ตรวจสอบสิทธิ์
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
   * สร้าง session token
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
   * ตรวจสอบ session token
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
   * ลบ session token
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
   * สิทธิ์ที่สามารถเลือกได้
   */
  getAvailablePermissions() {
    return [
      { value: 'read:files', label: 'อ่านรายการไฟล์', description: 'ดูรายการไฟล์ GeoTIFF' },
      { value: 'read:metadata', label: 'อ่าน Metadata', description: 'ดูข้อมูล metadata ของไฟล์' },
      { value: 'query:spatial', label: 'ค้นหาข้อมูลเชิงพื้นที่', description: 'ค้นหาด้วยพิกัดและขอบเขต' },
      { value: 'write:files', label: 'อัปโหลดไฟล์', description: 'อัปโหลดไฟล์ GeoTIFF ใหม่' },
      { value: 'process:files', label: 'ประมวลผลไฟล์', description: 'เริ่มการประมวลผลไฟล์' },
      { value: 'delete:files', label: 'ลบไฟล์', description: 'ลบไฟล์จากระบบ' },
      { value: 'admin:users', label: 'จัดการผู้ใช้', description: 'จัดการผู้ใช้และสิทธิ์ (Admin only)' }
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
        name: 'การอ่านข้อมูล',
        permissions: ['read:files', 'read:metadata', 'query:spatial']
      },
      {
        name: 'การจัดการไฟล์',
        permissions: ['write:files', 'process:files', 'delete:files']
      },
      {
        name: 'การจัดการระบบ',
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
      return { isValid: false, error: 'ชื่อ API key ไม่สามารถเป็นค่าว่างได้' };
    }
    
    if (name.length > 255) {
      return { isValid: false, error: 'ชื่อ API key ต้องไม่เกิน 255 ตัวอักษร' };
    }

    if (name.trim().length < 3) {
      return { isValid: false, error: 'ชื่อ API key ต้องมีอย่างน้อย 3 ตัวอักษร' };
    }

    return { isValid: true };
  }

  /**
   * ตรวจสอบความถูกต้องของสิทธิ์
   */
  validatePermissions(permissions: string[]): { isValid: boolean; error?: string } {
    if (!permissions || permissions.length === 0) {
      return { isValid: false, error: 'ต้องเลือกสิทธิ์อย่างน้อย 1 สิทธิ์' };
    }

    const availablePermissions = this.getAvailablePermissions().map(p => p.value);
    const invalidPermissions = permissions.filter(p => !availablePermissions.includes(p));

    if (invalidPermissions.length > 0) {
      return { 
        isValid: false, 
        error: `สิทธิ์ที่ไม่ถูกต้อง: ${invalidPermissions.join(', ')}` 
      };
    }

    return { isValid: true };
  }
}

// Export singleton instance
const tokenService = new TokenService();
export default tokenService;
