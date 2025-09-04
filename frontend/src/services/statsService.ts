import api from '@/lib/api';

export interface DashboardStats {
  files: {
    totalGeoTiffFiles: number;
    uploadedFiles: number;
  };
  processing: {
    totalJobs: number;
    activeJobs: number;
  };
  storage: {
    storageUsed: number;
    totalSpace: number;
    storageUsedFormatted: string;
    totalSpaceFormatted: string;
  };
  extraction: {
    completed: number;
    dataExtracted: number;
    dataExtractedFormatted: string;
  };
}

export interface FileStats {
  totalGeoTiffFiles: number;
  uploadedFiles: number;
}

export interface ProcessingStats {
  totalJobs: number;
  activeJobs: number;
}

export interface StorageStats {
  storageUsed: number;
  totalSpace: number;
  storageUsedFormatted: string;
  totalSpaceFormatted: string;
}

export interface ExtractionStats {
  completed: number;
  dataExtracted: number;
  dataExtractedFormatted: string;
}

export interface DetailedFileStats {
  fileType: string;
  count: number;
  totalSize: number;
  totalSizeFormatted: string;
  avgSize: number;
  avgSizeFormatted: string;
  firstUpload: string;
  lastUpload: string;
}

export interface DetailedProcessingStats {
  status: string;
  count: number;
  avgProcessingTime: number;
  firstJob: string;
  lastJob: string;
}

export interface StorageUsageOverTime {
  date: string;
  filesUploaded: number;
  storageUsed: number;
  storageUsedFormatted: string;
}

class StatsService {
  /**
   * Get comprehensive dashboard statistics
   */
  async getDashboardStats(): Promise<{ success: boolean; data?: DashboardStats; error?: string }> {
    try {
      const response = await api.get<DashboardStats>('/stats/dashboard');
      return response;
    } catch (error) {
      console.error('Get dashboard stats error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch dashboard statistics'
      };
    }
  }

  /**
   * Get file statistics
   */
  async getFileStats(): Promise<{ success: boolean; data?: FileStats; error?: string }> {
    try {
      const response = await api.get<FileStats>('/stats/files');
      return response;
    } catch (error) {
      console.error('Get file stats error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch file statistics'
      };
    }
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats(): Promise<{ success: boolean; data?: ProcessingStats; error?: string }> {
    try {
      const response = await api.get<ProcessingStats>('/stats/processing');
      return response;
    } catch (error) {
      console.error('Get processing stats error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch processing statistics'
      };
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{ success: boolean; data?: StorageStats; error?: string }> {
    try {
      const response = await api.get<StorageStats>('/stats/storage');
      return response;
    } catch (error) {
      console.error('Get storage stats error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch storage statistics'
      };
    }
  }

  /**
   * Get data extraction statistics
   */
  async getExtractionStats(): Promise<{ success: boolean; data?: ExtractionStats; error?: string }> {
    try {
      const response = await api.get<ExtractionStats>('/stats/extraction');
      return response;
    } catch (error) {
      console.error('Get extraction stats error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch extraction statistics'
      };
    }
  }

  /**
   * Get detailed file statistics with breakdown
   */
  async getDetailedFileStats(): Promise<{ success: boolean; data?: DetailedFileStats[]; error?: string }> {
    try {
      const response = await api.get<DetailedFileStats[]>('/stats/files/detailed');
      return response;
    } catch (error) {
      console.error('Get detailed file stats error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch detailed file statistics'
      };
    }
  }

  /**
   * Get detailed processing statistics with status breakdown
   */
  async getDetailedProcessingStats(): Promise<{ success: boolean; data?: DetailedProcessingStats[]; error?: string }> {
    try {
      const response = await api.get<DetailedProcessingStats[]>('/stats/processing/detailed');
      return response;
    } catch (error) {
      console.error('Get detailed processing stats error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch detailed processing statistics'
      };
    }
  }

  /**
   * Get storage usage over time
   */
  async getStorageUsageOverTime(days: number = 30): Promise<{ success: boolean; data?: StorageUsageOverTime[]; error?: string }> {
    try {
      const response = await api.get<StorageUsageOverTime[]>(`/stats/storage/usage-over-time?days=${days}`);
      return response;
    } catch (error) {
      console.error('Get storage usage over time error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch storage usage over time'
      };
    }
  }

  /**
   * Format bytes to human readable format (client-side fallback)
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get status color for processing jobs
   */
  getStatusColor(status: string): string {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'text-green-600 bg-green-100';
      case 'processing':
        return 'text-blue-600 bg-blue-100';
      case 'pending':
        return 'text-yellow-600 bg-yellow-100';
      case 'failed':
        return 'text-red-600 bg-red-100';
      case 'cancelled':
        return 'text-gray-600 bg-gray-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  }

  /**
   * Get status label for processing jobs
   */
  getStatusLabel(status: string): string {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'Completed';
      case 'processing':
        return 'Processing';
      case 'pending':
        return 'Pending';
      case 'failed':
        return 'Failed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status;
    }
  }
}

// Export singleton instance
const statsService = new StatsService();
export default statsService;
