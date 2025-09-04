import api from '@/lib/api';

export interface ProcessingStatus {
  fileId: string;
  filename: string;
  uploadStatus: string;
  processingStatus: 'not_started' | 'in_progress' | 'completed';
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FileMetadata {
  fileInfo: {
    id: string;
    filename: string;
    originalFilename: string;
    fileSize: number;
    checksum: string;
    uploadStatus: string;
    processedAt: string | null;
  };
  spatialMetadata: {
    dimensions: {
      width: number;
      height: number;
      bandsCount: number;
      pixelType: string;
    };
    spatial: {
      coordinateSystem: string;
      geotransform: number[];
      extent: string;
      resolution: {
        x: number;
        y: number;
      };
    };
    bandStatistics: unknown;
    nodataValue: number | null;
  };
}

export interface ProcessingResult {
  message: string;
  fileId: string;
  status: string;
  extractedData: unknown;
}

class GeoTIFFProcessingService {
  /**
   * เริ่มประมวลผลไฟล์ GeoTIFF
   */
  async processGeoTIFF(fileId: string): Promise<ProcessingResult> {
    try {
      const response = await api.post<ProcessingResult>(`/files/${fileId}/process`);
      if (!response.data) {
        throw new Error('No response data received');
      }
      return response.data;
    } catch (error) {
      console.error('Error processing GeoTIFF:', error);
      throw new Error('Failed to process GeoTIFF file');
    }
  }

  /**
   * ดูสถานะการประมวลผล
   */
  async getProcessingStatus(fileId: string): Promise<ProcessingStatus> {
    try {
      const response = await api.get<ProcessingStatus>(`/files/${fileId}/process/status`);
      if (!response.data) {
        throw new Error('No response data received');
      }
      return response.data;
    } catch (error) {
      console.error('Error getting processing status:', error);
      throw new Error('Failed to get processing status');
    }
  }

  /**
   * ดึงข้อมูลที่แกะออกมาจาก GeoTIFF
   */
  async getFileMetadata(fileId: string): Promise<FileMetadata> {
    try {
      const response = await api.get<FileMetadata>(`/files/${fileId}/metadata`);
      if (!response.data) {
        throw new Error('No response data received');
      }
      return response.data;
    } catch (error) {
      console.error('Error getting file metadata:', error);
      throw new Error('Failed to get file metadata');
    }
  }

  /**
   * ตรวจสอบว่าไฟล์พร้อมประมวลผลหรือไม่
   */
  isReadyForProcessing(uploadStatus: string): boolean {
    return uploadStatus === 'completed';
  }

  /**
   * ตรวจสอบว่าไฟล์ประมวลผลเสร็จแล้วหรือไม่
   */
  isProcessingCompleted(uploadStatus: string): boolean {
    return uploadStatus === 'processed';
  }

  /**
   * ตรวจสอบว่าไฟล์กำลังประมวลผลอยู่หรือไม่
   */
  isProcessingInProgress(uploadStatus: string): boolean {
    return uploadStatus === 'processing';
  }

  /**
   * แปลงสถานะเป็นข้อความภาษาไทย
   */
  getProcessingStatusText(status: string): string {
    switch (status) {
      case 'not_started':
        return 'ยังไม่ได้ประมวลผล';
      case 'in_progress':
        return 'กำลังประมวลผล...';
      case 'completed':
        return 'ประมวลผลเสร็จแล้ว';
      default:
        return 'ไม่ทราบสถานะ';
    }
  }

  /**
   * แปลงสถานะ upload เป็นข้อความภาษาไทย
   */
  getUploadStatusText(status: string): string {
    switch (status) {
      case 'pending':
        return 'รอการอัพโหลด';
      case 'uploading':
        return 'กำลังอัพโหลด...';
      case 'processing':
        return 'กำลังประมวลผล...';
      case 'completed':
        return 'อัพโหลดเสร็จแล้ว';
      case 'failed':
        return 'เกิดข้อผิดพลาด';
      default:
        return 'ไม่ทราบสถานะ';
    }
  }

  /**
   * รอจนกว่าการประมวลผลจะเสร็จ (polling)
   */
  async waitForProcessing(fileId: string, maxWaitTime: number = 300000): Promise<ProcessingStatus> {
    const startTime = Date.now();
    const pollInterval = 2000; // 2 วินาที

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const status = await this.getProcessingStatus(fileId);
        
        if (status.processingStatus === 'completed') {
          return status;
        }
        
        if (status.processingStatus === 'not_started') {
          throw new Error('Processing failed or was cancelled');
        }

        // รอแล้วลองใหม่
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        console.error('Error while waiting for processing:', error);
        throw error;
      }
    }

    throw new Error('Processing timeout - exceeded maximum wait time');
  }
}

// Export singleton instance
const geotiffProcessingService = new GeoTIFFProcessingService();
export default geotiffProcessingService;
