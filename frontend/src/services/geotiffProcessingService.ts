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

  isReadyForProcessing(uploadStatus: string): boolean {
    return uploadStatus === 'completed';
  }

  isProcessingCompleted(uploadStatus: string): boolean {
    return uploadStatus === 'processed';
  }

  isProcessingInProgress(uploadStatus: string): boolean {
    return uploadStatus === 'processing';
  }

  getProcessingStatusText(status: string): string {
    switch (status) {
      case 'not_started':
        return 'Not started';
      case 'in_progress':
        return 'Processing...';
      case 'completed':
        return 'Completed';
      default:
        return 'Unknown status';
    }
  }

  getUploadStatusText(status: string): string {
    switch (status) {
      case 'pending':
        return 'Pending upload';
      case 'uploading':
        return 'Uploading...';
      case 'processing':
        return 'Processing...';
      case 'completed':
        return 'Upload completed';
      case 'failed':
        return 'Failed';
      default:
        return 'Unknown status';
    }
  }

  async waitForProcessing(fileId: string, maxWaitTime: number = 300000): Promise<ProcessingStatus> {
    const startTime = Date.now();
    const pollInterval = 2000;

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const status = await this.getProcessingStatus(fileId);
        
        if (status.processingStatus === 'completed') {
          return status;
        }
        
        if (status.processingStatus === 'not_started') {
          throw new Error('Processing failed or was cancelled');
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        console.error('Error while waiting for processing:', error);
        throw error;
      }
    }

    throw new Error('Processing timeout - exceeded maximum wait time');
  }
}

const geotiffProcessingService = new GeoTIFFProcessingService();
export default geotiffProcessingService;
