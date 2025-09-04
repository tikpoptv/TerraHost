const DatabaseService = require('./DatabaseService');

class StatsService {
  constructor() {
    this.db = DatabaseService;
  }

  /**
   * Get comprehensive dashboard statistics
   */
  async getDashboardStats(userId) {
    try {
      const [
        fileStats,
        processingStats,
        storageStats,
        extractionStats
      ] = await Promise.all([
        this.getFileStats(userId),
        this.getProcessingStats(userId),
        this.getStorageStats(userId),
        this.getExtractionStats(userId)
      ]);

      return {
        files: fileStats,
        processing: processingStats,
        storage: storageStats,
        extraction: extractionStats
      };
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      throw error;
    }
  }

  /**
   * Get file statistics
   */
  async getFileStats(userId) {
    try {
      // Get total GeoTIFF files count (shared across users)
      const totalFilesQuery = `
        SELECT COUNT(*) as total_files
        FROM geotiff_files 
        WHERE deleted_at IS NULL
      `;
      
      // Get uploaded files count (all file types, shared across users)
      const uploadedFilesQuery = `
        SELECT COUNT(*) as uploaded_files
        FROM geotiff_files 
        WHERE deleted_at IS NULL
      `;

      const [totalFilesResult, uploadedFilesResult] = await Promise.all([
        this.db.executeQuery(totalFilesQuery, []),
        this.db.executeQuery(uploadedFilesQuery, [])
      ]);

      return {
        totalGeoTiffFiles: totalFilesResult.data?.[0]?.total_files || 0,
        uploadedFiles: uploadedFilesResult.data?.[0]?.uploaded_files || 0
      };
    } catch (error) {
      console.error('Error getting file stats:', error);
      throw error;
    }
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats(userId) {
    try {
      // Get total processing jobs count (shared across users)
      const totalJobsQuery = `
        SELECT COUNT(*) as total_jobs
        FROM processing_jobs 
      `;
      
      // Get active processing jobs count (shared across users)
      const activeJobsQuery = `
        SELECT COUNT(*) as active_jobs
        FROM processing_jobs 
        WHERE status IN ('queued', 'processing')
      `;

      const [totalJobsResult, activeJobsResult] = await Promise.all([
        this.db.executeQuery(totalJobsQuery, []),
        this.db.executeQuery(activeJobsQuery, [])
      ]);

      return {
        totalJobs: totalJobsResult.data?.[0]?.total_jobs || 0,
        activeJobs: activeJobsResult.data?.[0]?.active_jobs || 0
      };
    } catch (error) {
      console.error('Error getting processing stats:', error);
      throw error;
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(userId) {
    try {
      // Get total storage used (shared across users)
      const storageUsedQuery = `
        SELECT COALESCE(SUM(file_size), 0) as storage_used
        FROM geotiff_files 
        WHERE deleted_at IS NULL
      `;
      
      // Get total space available (this could be from user plan or system limit)
      const totalSpaceQuery = `
        SELECT COALESCE(SUM(file_size), 0) as total_space
        FROM geotiff_files
        WHERE deleted_at IS NULL
      `;

      const [storageUsedResult, totalSpaceResult] = await Promise.all([
        this.db.executeQuery(storageUsedQuery, []),
        this.db.executeQuery(totalSpaceQuery, [])
      ]);

      const storageUsed = storageUsedResult.data?.[0]?.storage_used || 0;
      const totalSpace = totalSpaceResult.data?.[0]?.total_space || 0;

      return {
        storageUsed: storageUsed,
        totalSpace: totalSpace,
        storageUsedFormatted: this.formatBytes(storageUsed),
        totalSpaceFormatted: this.formatBytes(totalSpace)
      };
    } catch (error) {
      console.error('Error getting storage stats:', error);
      throw error;
    }
  }

  /**
   * Get data extraction statistics
   */
  async getExtractionStats(userId) {
    try {
      // Get completed extractions count from processing_sessions (shared across users)
      const completedExtractionsQuery = `
        SELECT COUNT(*) as completed_extractions
        FROM processing_sessions 
        WHERE status = 'completed'
      `;
      
      // Get total data extracted (sum of file sizes from completed processing sessions, shared across users)
      const dataExtractedQuery = `
        SELECT COALESCE(SUM(ps.original_file_size), 0) as data_extracted
        FROM processing_sessions ps
        WHERE ps.status = 'completed'
      `;

      const [completedResult, dataExtractedResult] = await Promise.all([
        this.db.executeQuery(completedExtractionsQuery, []),
        this.db.executeQuery(dataExtractedQuery, [])
      ]);

      const dataExtracted = dataExtractedResult.data?.[0]?.data_extracted || 0;

      return {
        completed: completedResult.data?.[0]?.completed_extractions || 0,
        dataExtracted: dataExtracted,
        dataExtractedFormatted: this.formatBytes(dataExtracted)
      };
    } catch (error) {
      console.error('Error getting extraction stats:', error);
      throw error;
    }
  }

  /**
   * Format bytes to human readable format
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get detailed file statistics with breakdown
   */
  async getDetailedFileStats(userId) {
    try {
      const query = `
        SELECT 
          'geotiff' as file_type,
          COUNT(*) as count,
          COALESCE(SUM(file_size), 0) as total_size,
          COALESCE(AVG(file_size), 0) as avg_size,
          MIN(created_at) as first_upload,
          MAX(created_at) as last_upload
        FROM geotiff_files 
        WHERE user_id = $1
        GROUP BY file_type
        ORDER BY count DESC
      `;

      const results = await this.db.executeQuery(query, [userId]);
      
      return results.data.map(row => ({
        fileType: row.file_type,
        count: row.count,
        totalSize: row.total_size,
        totalSizeFormatted: this.formatBytes(row.total_size),
        avgSize: row.avg_size,
        avgSizeFormatted: this.formatBytes(row.avg_size),
        firstUpload: row.first_upload,
        lastUpload: row.last_upload
      }));
    } catch (error) {
      console.error('Error getting detailed file stats:', error);
      throw error;
    }
  }

  /**
   * Get processing job statistics with status breakdown
   */
  async getDetailedProcessingStats(userId) {
    try {
      const query = `
        SELECT 
          status,
          COUNT(*) as count,
          COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - started_at))), 0) as avg_processing_time,
          MIN(created_at) as first_job,
          MAX(created_at) as last_job
        FROM processing_jobs 
        WHERE user_id = $1
        GROUP BY status
        ORDER BY count DESC
      `;

      const results = await this.db.executeQuery(query, [userId]);
      
      return results.data.map(row => ({
        status: row.status,
        count: row.count,
        avgProcessingTime: row.avg_processing_time,
        firstJob: row.first_job,
        lastJob: row.last_job
      }));
    } catch (error) {
      console.error('Error getting detailed processing stats:', error);
      throw error;
    }
  }

  /**
   * Get storage usage over time (for charts)
   */
  async getStorageUsageOverTime(userId, days = 30) {
    try {
      const query = `
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as files_uploaded,
          COALESCE(SUM(file_size), 0) as storage_used
        FROM geotiff_files 
        WHERE user_id = $1 
          AND created_at >= CURRENT_DATE - INTERVAL '${days} days'
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `;

      const results = await this.db.executeQuery(query, [userId]);
      
      return results.data.map(row => ({
        date: row.date,
        filesUploaded: row.files_uploaded,
        storageUsed: row.storage_used,
        storageUsedFormatted: this.formatBytes(row.storage_used)
      }));
    } catch (error) {
      console.error('Error getting storage usage over time:', error);
      throw error;
    }
  }
}

module.exports = StatsService;
