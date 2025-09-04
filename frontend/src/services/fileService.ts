import api from '@/lib/api';
import { formatRelativeThailandTime, formatThailandDateTime } from '@/utils/dateUtils';
import geotiffProcessingService from './geotiffProcessingService';

export interface GeoTIFFFile {
  id: string;
  filename: string;
  original_filename: string;
  file_size: number;
  upload_status: string;
  upload_progress: number;
  created_at: string;
  storage_name?: string;
  processing_sessions: ProcessingSession[];
}

export interface FileListResponse {
  files: GeoTIFFFile[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface FileDetails {
  id: string;
  filename: string;
  original_filename: string;
  file_path: string;
  file_size: number;
  checksum: string;
  mime_type: string;
  upload_status: string;
  upload_progress: number;
  created_at: string;
  updated_at: string;
  storage_name?: string;
  storage_type?: string;
}

export interface UploadResponse {
  fileId: string;
  filename: string;
  originalFilename: string;
  fileSize: number;
  uploadStatus: string;
  nextcloudPath: string;
  message: string;
  acquisitionDate?: string;
}

export interface ProcessingStep {
  step_order: number;
  step_name: string;
  step_status: string;
  step_duration_ms?: number;
  step_description?: string;
}

export interface ProcessingSession {
  session_id: string;
  session_uuid: string;
  processing_status: string;
  session_start_time: string;
  session_end_time?: string;
  total_processing_time_ms?: number;
  progress_percentage: number;
  processing_method?: string;
  python_script_version?: string;
  extraction_steps?: ProcessingStep[];
}

class FileService {
  // Upload GeoTIFF file
  async uploadFile(file: File): Promise<{ success: boolean; data?: UploadResponse; error?: string; details?: string }> {
    try {
      const response = await api.upload<UploadResponse>('/files/upload', file, 'geotiff');
      return response;
    } catch (error) {
      console.error('File upload error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upload file'
      };
    }
  }

  // Get user's files
  async getUserFiles(options: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  } = {}): Promise<{ success: boolean; data?: FileListResponse; error?: string }> {
    try {
      const params = new URLSearchParams();
      if (options.page) params.append('page', options.page.toString());
      if (options.limit) params.append('limit', options.limit.toString());
      if (options.status) params.append('status', options.status);
      if (options.search) params.append('search', options.search);

      const response = await api.get<FileListResponse>(`/files/files?${params.toString()}`);
      return response;
    } catch (error) {
      console.error('Get user files error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve files'
      };
    }
  }

  // Get specific file details
  async getFileDetails(fileId: string): Promise<{ success: boolean; data?: FileDetails; error?: string }> {
    try {
      const response = await api.get<FileDetails>(`/files/${fileId}`);
      return response;
    } catch (error) {
      console.error('Get file details error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve file details'
      };
    }
  }

  // Delete file
  async deleteFile(fileId: string): Promise<{ success: boolean; data?: { message: string }; error?: string }> {
    try {
      const response = await api.delete<{ message: string }>(`/files/${fileId}`);
      return response;
    } catch (error) {
      console.error('Delete file error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete file'
      };
    }
  }

  // GeoTIFF Processing methods (delegated to processing service)
  async processGeoTIFF(fileId: string) {
    return geotiffProcessingService.processGeoTIFF(fileId);
  }

  async getProcessingStatus(fileId: string) {
    return geotiffProcessingService.getProcessingStatus(fileId);
  }

  async getFileMetadata(fileId: string) {
    return geotiffProcessingService.getFileMetadata(fileId);
  }

  // Helper methods for processing status
  isReadyForProcessing(uploadStatus: string): boolean {
    return geotiffProcessingService.isReadyForProcessing(uploadStatus);
  }

  isProcessingCompleted(uploadStatus: string): boolean {
    return geotiffProcessingService.isProcessingCompleted(uploadStatus);
  }

  isProcessingInProgress(uploadStatus: string): boolean {
    return geotiffProcessingService.isProcessingInProgress(uploadStatus);
  }

  getProcessingStatusText(status: string): string {
    return geotiffProcessingService.getProcessingStatusText(status);
  }

  getUploadStatusText(status: string): string {
    return geotiffProcessingService.getUploadStatusText(status);
  }

  // Test Nextcloud connection
  async testNextcloudConnection(): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
      const response = await api.get('/files/nextcloud/test');
      return response;
    } catch (error) {
      console.error('Nextcloud connection test error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to test Nextcloud connection'
      };
    }
  }

  // Format file size
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Format upload status
  formatUploadStatus(status: string): { text: string; color: string; bgColor: string } {
    switch (status) {
      case 'completed':
        return {
          text: 'พร้อมใช้งาน',
          color: 'text-green-800',
          bgColor: 'bg-green-100'
        };
      case 'processing':
        return {
          text: 'กำลังประมวลผล',
          color: 'text-yellow-800',
          bgColor: 'bg-yellow-100'
        };
      case 'failed':
        return {
          text: 'ล้มเหลว',
          color: 'text-red-800',
          bgColor: 'bg-red-100'
        };
      case 'pending':
        return {
          text: 'รอดำเนินการ',
          color: 'text-gray-800',
          bgColor: 'bg-gray-100'
        };
      default:
        return {
          text: status,
          color: 'text-gray-800',
          bgColor: 'bg-gray-100'
        };
    }
  }

  // Format date using Thailand timezone
  formatDate(dateString: string): string {
    return formatRelativeThailandTime(dateString);
  }

  // Format full date and time using Thailand timezone
  formatDateTime(dateString: string): string {
    return formatThailandDateTime(dateString);
  }
}

const fileService = new FileService();
export default fileService;
