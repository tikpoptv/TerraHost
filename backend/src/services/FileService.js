const crypto = require('crypto');
const path = require('path');
const DatabaseService = require('./DatabaseService');
const NextcloudService = require('./NextcloudService');

class FileService {
  constructor() {
    this.db = DatabaseService;
    this.nextcloud = new NextcloudService();
  }

  // Generate unique filename
  generateFilename(originalname) {
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    const extension = path.extname(originalname);
    return `${timestamp}_${randomString}${extension}`;
  }

  // Calculate file checksum
  calculateChecksum(buffer) {
    return crypto.createHash('md5').update(buffer).digest('hex');
  }

  // Upload GeoTIFF file
  async uploadGeoTIFF(userId, fileData) {
    try {
      const { originalname, buffer, size, mimetype } = fileData;
      
      // ตรวจสอบรูปแบบชื่อไฟล์และแตกวันที่
      const validationResult = this.validateFilenameAndExtractDate(originalname);
      
      if (!validationResult.isValid) {
        return {
          success: false,
          error: `ชื่อไฟล์ไม่ถูกต้อง: ${validationResult.error}`
        };
      }

      // Generate unique filename
      const filename = this.generateFilename(originalname);
      
      // Calculate checksum
      const checksum = this.calculateChecksum(buffer);
      
      // Upload to Nextcloud
      const nextcloudResult = await this.nextcloud.uploadFile(buffer, filename, '/GeoTIFF');
      
      if (!nextcloudResult.success) {
        return {
          success: false,
          error: `Failed to upload to Nextcloud: ${nextcloudResult.error}`
        };
      }
      
      // Get Nextcloud storage config
      const storageConfig = await this.getNextcloudStorageConfig();
      
      // Save file info to database with full Nextcloud path and acquisition date
      const fileRecord = await this.saveFileToDatabase({
        userId,
        storageId: storageConfig.id,
        filename,
        originalFilename: originalname,
        filePath: nextcloudResult.data.remotePath, // This will be the full Nextcloud path
        fileSize: size,
        checksum,
        mimeType: mimetype,
        acquisitionDate: validationResult.acquisitionDate
      });

      return {
        success: true,
        data: {
          fileId: fileRecord.id,
          filename,
          originalFilename: originalname,
          fileSize: size,
          uploadStatus: 'completed',
          nextcloudPath: nextcloudResult.data.remotePath,
          acquisitionDate: validationResult.acquisitionDate,
          message: 'File uploaded to Nextcloud successfully'
        }
      };

    } catch (error) {
      console.error('File upload error:', error);
      return {
        success: false,
        error: 'Failed to upload file'
      };
    }
  }

  // Save file info to database
  async saveFileToDatabase(fileData) {
    const query = `
      INSERT INTO geotiff_files (
        user_id, storage_id, filename, original_filename, 
        file_path, file_size, checksum, mime_type, 
        upload_status, upload_progress, acquisition_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    
    const values = [
      fileData.userId,
      fileData.storageId,
      fileData.filename,
      fileData.originalFilename,
      fileData.filePath,
      fileData.fileSize,
      fileData.checksum,
      fileData.mimeType,
      'completed',
      100,
      fileData.acquisitionDate || null
    ];

    const result = await this.db.executeQuery(query, values);
    return result.data[0];
  }

  // Get Nextcloud storage configuration
  async getNextcloudStorageConfig() {
    try {
      // Check if Nextcloud storage config exists
      let query = 'SELECT * FROM file_storage WHERE storage_type = $1 AND is_active = true LIMIT 1';
      let result = await this.db.executeQuery(query, ['nextcloud']);
      
      if (result.data.length > 0) {
        return result.data[0];
      }

      // Create Nextcloud storage config if none exists
      const nextcloudConfig = {
        name: 'Nextcloud Storage',
        storageType: 'nextcloud',
        config: {
          url: process.env.NEXTCLOUD_URL || 'http://localhost:8080',
          username: process.env.NEXTCLOUD_USERNAME || 'admin',
          uploadPath: '/remote.php/dav/files',
          maxFileSize: '500MB'
        }
      };

      query = `
        INSERT INTO file_storage (name, storage_type, config, is_default, is_active)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;
      
      const values = [
        nextcloudConfig.name,
        nextcloudConfig.storageType,
        JSON.stringify(nextcloudConfig.config),
        true,
        true
      ];

      result = await this.db.executeQuery(query, values);
      return result.data[0];

    } catch (error) {
      console.error('Error getting Nextcloud storage config:', error);
      // Return fallback config
      return {
        id: '00000000-0000-0000-0000-000000000000',
        name: 'Nextcloud Storage',
        storageType: 'nextcloud'
      };
    }
  }

  // Get user's files
  async getUserFiles(userId, options = {}) {
    try {
      const { page = 1, limit = 20, status, search } = options;
      const offset = (page - 1) * limit;

      let query = `
        SELECT 
          gf.id, gf.filename, gf.original_filename, gf.file_size, 
          gf.upload_status, gf.upload_progress, gf.created_at,
          fs.name as storage_name
        FROM geotiff_files gf
        LEFT JOIN file_storage fs ON gf.storage_id = fs.id
        WHERE gf.user_id = $1
      `;
      
      const queryParams = [userId];
      let paramIndex = 2;

      if (status) {
        query += ` AND gf.upload_status = $${paramIndex}`;
        queryParams.push(status);
        paramIndex++;
      }

      if (search) {
        query += ` AND (gf.filename ILIKE $${paramIndex} OR gf.original_filename ILIKE $${paramIndex})`;
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      query += ` ORDER BY gf.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      queryParams.push(limit, offset);

      const result = await this.db.executeQuery(query, queryParams);

      // Get processing sessions for each file
      const filesWithProcessing = await Promise.all(
        result.data.map(async (file) => {
          const processingQuery = `
            SELECT 
              ps.id as session_id,
              ps.session_uuid,
              ps.status as processing_status,
              ps.session_start_time,
              ps.session_end_time,
              ps.total_processing_time_ms,
              ps.progress_percentage,
              ps.processing_method,
              ps.python_script_version,
              ps.extraction_steps
            FROM processing_sessions ps
            WHERE ps.file_id = $1
            ORDER BY ps.session_start_time DESC
          `;
          
          const processingResult = await this.db.executeQuery(processingQuery, [file.id]);
          
          return {
            ...file,
            processing_sessions: processingResult.data || []
          };
        })
      );

      // Get total count for pagination
      let countQuery = `
        SELECT COUNT(*) as total
        FROM geotiff_files gf
        WHERE gf.user_id = $1
      `;
      
      const countParams = [userId];
      let countParamIndex = 2;

      if (status) {
        countQuery += ` AND gf.upload_status = $${countParamIndex}`;
        countParams.push(status);
        countParamIndex++;
      }

      if (search) {
        countQuery += ` AND (gf.filename ILIKE $${countParamIndex} OR gf.original_filename ILIKE $${countParamIndex})`;
        countParams.push(`%${search}%`);
        countParamIndex++;
      }

      const countResult = await this.db.executeQuery(countQuery, countParams);
      const total = parseInt(countResult.data[0].total);

      return {
        files: filesWithProcessing,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };

    } catch (error) {
      console.error('Error getting user files:', error);
      throw new Error('Failed to retrieve user files');
    }
  }

  // Get specific file details
  async getFileDetails(userId, fileId) {
    try {
      const query = `
        SELECT 
          gf.id, gf.filename, gf.original_filename, gf.file_path, 
          gf.file_size, gf.checksum, gf.mime_type, gf.upload_status,
          gf.upload_progress, gf.processed_at, gf.created_at, gf.updated_at,
          fs.name as storage_name, fs.storage_type
        FROM geotiff_files gf
        LEFT JOIN file_storage fs ON gf.storage_id = fs.id
        WHERE gf.id = $1 AND gf.user_id = $2
      `;
      
      const result = await this.db.executeQuery(query, [fileId, userId]);

      if (result.data.length === 0) {
        return {
          success: false,
          error: 'File not found'
        };
      }

      return {
        success: true,
        data: result.data[0]
      };

    } catch (error) {
      console.error('Error getting file details:', error);
      return {
        success: false,
        error: 'Failed to retrieve file details'
      };
    }
  }

  // Check if processing data exists in database tables
  async checkProcessingDataExists(fileId) {
    try {
      const queries = {
        spatial_metadata: `SELECT id FROM spatial_metadata WHERE file_id = $1`,
        raw_file_metadata: `SELECT id FROM raw_file_metadata WHERE file_id = $1`,
        raw_band_data: `SELECT COUNT(*) as count FROM raw_band_data WHERE file_id = $1`,
        complete_analysis_results: `SELECT id FROM complete_analysis_results WHERE file_id = $1`,
        extraction_summary: `SELECT id FROM extraction_summary WHERE file_id = $1`
      };

      const results = {};
      
      for (const [table, query] of Object.entries(queries)) {
        try {
          const result = await this.db.executeQuery(query, [fileId]);
          if (table === 'raw_band_data') {
            results[table] = parseInt(result.data[0]?.count || 0) > 0;
          } else {
            results[table] = result.data.length > 0;
          }
        } catch (error) {
          console.log(`Error checking ${table}:`, error.message);
          results[table] = false;
        }
      }

      // Determine overall data existence
      const hasAnyData = Object.values(results).some(exists => exists);
      const hasMainData = results.spatial_metadata;
      const hasRawData = results.raw_file_metadata && results.raw_band_data;
      const hasAnalysisData = results.complete_analysis_results;

      return {
        hasAnyData,
        hasMainData,
        hasRawData,
        hasAnalysisData,
        details: results,
        completeness: {
          spatial: results.spatial_metadata,
          rawMetadata: results.raw_file_metadata,
          bandData: results.raw_band_data,
          analysis: results.complete_analysis_results,
          summary: results.extraction_summary
        }
      };

    } catch (error) {
      console.error('Error checking processing data existence:', error);
      return {
        hasAnyData: false,
        hasMainData: false,
        hasRawData: false,
        hasAnalysisData: false,
        details: {},
        error: error.message
      };
    }
  }

  // Delete file
  async deleteFile(userId, fileId) {
    try {
      // Get file details first
      const fileDetails = await this.getFileDetails(userId, fileId);
      if (!fileDetails.success) {
        return fileDetails;
      }

      const file = fileDetails.data;

      // Delete file from Nextcloud
      if (file.storage_type === 'nextcloud') {
        try {
          // Extract relative path from full Nextcloud path
          // file.file_path contains: /remote.php/dav/files/username/TerraHost/GeoTIFF/filename.tiff
          // We need: /GeoTIFF/filename.tiff
          const fullPath = file.file_path;
          const terrahostIndex = fullPath.indexOf('/TerraHost');
          if (terrahostIndex !== -1) {
            const relativePath = fullPath.substring(terrahostIndex + 10); // +10 for '/TerraHost'
            const deleteResult = await this.nextcloud.deleteFile(relativePath);
            
            if (!deleteResult.success) {
              console.warn('Failed to delete from Nextcloud, continuing with database deletion:', deleteResult.error);
            }
          }
        } catch (error) {
          console.warn('Error deleting from Nextcloud, continuing with database deletion:', error);
        }
      }

      // Delete from database
      const query = 'DELETE FROM geotiff_files WHERE id = $1 AND user_id = $2';
      await this.db.query(query, [fileId, userId]);

      return {
        success: true,
        data: { message: 'File deleted successfully' }
      };

    } catch (error) {
      console.error('Error deleting file:', error);
      return {
        success: false,
        error: 'Failed to delete file'
      };
    }
  }

  // Test Nextcloud connection
  async testNextcloudConnection() {
    try {
      const result = await this.nextcloud.testConnection();
      return result;
    } catch (error) {
      console.error('Error testing Nextcloud connection:', error);
      return {
        success: false,
        error: `Failed to test Nextcloud connection: ${error.message}`
      };
    }
  }

  // Process GeoTIFF file using Python script
  async processGeoTIFF(userId, fileId) {
    let localFilePath = null;
    let processingSessionId = null;
    const startTime = Date.now();
    
    try {
      console.log(`🔄 Starting GeoTIFF processing for file ID: ${fileId}`);
      
      // Get file details first
      const fileDetails = await this.getFileDetails(userId, fileId);
      if (!fileDetails.success) {
        console.log(`❌ File not found: ${fileId}`);
        return fileDetails;
      }

      const file = fileDetails.data;
      console.log(`📁 File found: ${file.filename}, Status: ${file.upload_status}`);

      // Create processing session for complete traceability
      processingSessionId = await this.createProcessingSession(userId, fileId, file);
      console.log(`📝 Created processing session: ${processingSessionId}`);
      
      // Update session status to processing and progress to 10%
      await this.updateProcessingSession(processingSessionId, 'processing', null, null, 10, 'Session created, starting processing...');
      console.log(`🔄 Session status updated to processing (10%)`);
      
      // Check if file is ready for processing (uploaded but not yet processed)
      if (file.upload_status !== 'completed') {
        console.log(`⚠️ File not ready for processing. Current status: ${file.upload_status}`);
        await this.updateProcessingSession(processingSessionId, 'failed', `File not ready for processing. Current status: ${file.upload_status}`, null, null, null);
        return {
          success: false,
          error: `File is not ready for processing. Current status: ${file.upload_status}. Expected: completed.`
        };
      }

      // Check if already processed
      if (file.upload_status === 'processed') {
        console.log(`✅ File already processed: ${fileId}`);
        await this.updateProcessingSession(processingSessionId, 'completed', null, Date.now() - startTime, 100, 'File already processed');
        return {
          success: true,
          data: {
            message: 'File already processed',
            status: 'processed'
          }
        };
      }
      
      // Update status to processing
      console.log(`🔄 Updating status to processing...`);
      const statusUpdate = await this.updateFileStatus(fileId, 'processing');
      if (!statusUpdate.success) {
        console.log(`❌ Failed to update status: ${statusUpdate.error}`);
        await this.updateProcessingSession(processingSessionId, 'failed', `Failed to update file status: ${statusUpdate.error}`, null, null, null);
        return statusUpdate;
      }
      
      // Update session progress to 20%
      await this.updateProcessingSession(processingSessionId, 'processing', null, null, 20, 'File status updated to processing...');
      
      try {
        // Download file from Nextcloud first
        console.log(`📥 Downloading file from Nextcloud...`);
        await this.updateProcessingSession(processingSessionId, 'processing', null, null, 25, 'Downloading file from Nextcloud...');
        
        localFilePath = await this.downloadFileFromNextcloud(file.file_path, file.filename);
        
        if (!localFilePath) {
          console.log(`❌ Failed to download file from Nextcloud`);
          await this.updateProcessingSession(processingSessionId, 'failed', 'Failed to download file from Nextcloud', null, null, null);
          await this.updateFileStatus(fileId, 'completed');
          return {
            success: false,
            error: 'Failed to download file from Nextcloud'
          };
        }
        
        console.log(`✅ File downloaded to: ${localFilePath}`);
        
        // Update session progress to 40%
        await this.updateProcessingSession(processingSessionId, 'processing', null, null, 40, 'File downloaded successfully, starting Python extraction...');
        
        // Call Python script to extract data
        console.log(`🐍 Calling Python extractor...`);
        await this.updateProcessingSession(processingSessionId, 'processing', null, null, 50, 'Running Python GeoTIFF extractor...');
        
        const extractedData = await this.callPythonExtractor(localFilePath);
        
        if (extractedData.success) {
          console.log(`✅ Data extraction successful`);
          
          // Update session progress to 70%
          await this.updateProcessingSession(processingSessionId, 'processing', null, null, 70, 'Python extraction completed, saving data to database...');
          
          // Log processing step
          await this.logProcessingStep(processingSessionId, 3, 'data_extraction_completed', 'Python extraction completed successfully', 'completed', {
            extractedDataSize: JSON.stringify(extractedData.data).length,
            hasRawStorage: !!extractedData.data.raw_storage
          });

          // Save extracted data to database
          console.log(`💾 Saving extracted data to database...`);
          await this.updateProcessingSession(processingSessionId, 'processing', null, null, 80, 'Saving extracted data to database...');
          
          const saveResult = await this.saveExtractedData(fileId, extractedData.data, processingSessionId);
          
          // Save raw data for permanent storage (เก็บข้อมูลดิบถาวร)
          console.log(`🗄️ Saving raw data for permanent storage...`);
          await this.updateProcessingSession(processingSessionId, 'processing', null, null, 90, 'Saving raw data for permanent storage...');
          
          const rawDataResult = await this.saveRawDataForPermanentStorage(fileId, extractedData.data, processingSessionId);
          
          if (saveResult.success && rawDataResult.success) {
            // Update file status to processed
            console.log(`🔄 Updating status to processed...`);
            await this.updateFileStatus(fileId, 'processed');
            
            // Update processing session status to completed
            const totalProcessingTime = Date.now() - startTime;
            await this.updateProcessingSession(processingSessionId, 'completed', null, totalProcessingTime, 100, 'File processing completed successfully');
            await this.logProcessingStep(processingSessionId, 5, 'processing_completed', 'File processing completed successfully', 'completed');
            
            console.log(`🎉 GeoTIFF processing completed successfully for file: ${fileId}`);
            
            return {
              success: true,
              data: {
                message: 'GeoTIFF processed successfully',
                extractedData: extractedData.data,
                processingDetails: {
                  fileId,
                  filename: file.filename,
                  extractionSummary: this._countExtractedDataPoints(extractedData.data),
                  processingTime: new Date().toISOString(),
                  dataQuality: this._validateExtractedData(extractedData.data),
                  rawDataStorage: {
                    status: 'stored',
                    message: 'All raw data permanently stored in database',
                    canReconstructFile: true,
                    storageDetails: rawDataResult.details
                  }
                }
              }
            };
          } else {
            console.log(`❌ Failed to save extracted data: ${saveResult.error}`);
            // Rollback status since save failed
            await this.updateProcessingSession(processingSessionId, 'failed', `Failed to save extracted data: ${saveResult.error}`, null, null, null);
            await this.updateFileStatus(fileId, 'completed');
            return {
              success: false,
              error: `Failed to save extracted data: ${saveResult.error}`
            };
          }
        } else {
          console.log(`❌ Data extraction failed: ${extractedData.error}`);
          
          // Update processing session to failed
          if (processingSessionId) {
            await this.updateProcessingSession(processingSessionId, 'failed', extractedData.error, null, null, null);
            await this.logProcessingStep(processingSessionId, 3, 'data_extraction_failed', 'Python extraction failed', 'failed');
          }
          
          // Update status back to completed if processing failed
          await this.updateFileStatus(fileId, 'completed');
          return {
            success: false,
            error: `Data extraction failed: ${extractedData.error}`
          };
        }
        
      } catch (processingError) {
        console.error(`❌ Processing error: ${processingError.message}`);
        // Rollback status
        await this.updateProcessingSession(processingSessionId, 'failed', `Processing error: ${processingError.message}`, null, null, null);
        await this.updateFileStatus(fileId, 'completed');
        throw processingError;
      }

    } catch (error) {
      console.error(`❌ Error processing GeoTIFF: ${error.message}`);
      
      // Try to rollback status if we can
      try {
        if (processingSessionId) {
          await this.updateProcessingSession(processingSessionId, 'failed', `Error processing GeoTIFF: ${error.message}`, null, null, null);
        }
        await this.updateFileStatus(fileId, 'completed');
      } catch (rollbackError) {
        console.error(`❌ Failed to rollback status: ${rollbackError.message}`);
      }
      
      return {
        success: false,
        error: `Failed to process GeoTIFF: ${error.message}`
      };
    } finally {
      // Always cleanup temporary file
      if (localFilePath) {
        console.log(`🧹 Cleaning up temporary file: ${localFilePath}`);
        this.cleanupTempFile(localFilePath);
      }
    }
  }

  // Download file from Nextcloud to local temp directory
  async downloadFileFromNextcloud(nextcloudPath, filename) {
    try {
      const fs = require('fs');
      const path = require('path');
      
      // Create temp directory if not exists
      const tempDir = path.join(__dirname, '..', '..', 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Generate local file path
      const localFilePath = path.join(tempDir, filename);
      
      console.log('📥 Downloading file from Nextcloud:');
      console.log('  - Nextcloud Path:', nextcloudPath);
      console.log('  - Local Path:', localFilePath);
      
      // Download file using Nextcloud service
      const downloadResult = await this.nextcloud.downloadFile(nextcloudPath, localFilePath);
      
      if (downloadResult.success) {
        console.log('✅ File downloaded successfully');
        return localFilePath;
      } else {
        console.log('❌ File download failed:', downloadResult.error);
        return null;
      }
      
    } catch (error) {
      console.error('Error downloading file:', error);
      return null;
    }
  }

  // Call Python script to extract GeoTIFF data
  async callPythonExtractor(filePath) {
    return new Promise((resolve, reject) => {
      const { spawn } = require('child_process');
      
      // Path to Python script
     const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'geotiff_extractor.py');
      
      // Spawn Python process using virtual environment
      const pythonPath = path.join(__dirname, '..', '..', 'venv', 'bin', 'python');
      
      // Debug logging
      console.log('🔍 Debug Python Process:');
      console.log('  - Python Path:', pythonPath);
      console.log('  - Script Path:', scriptPath);
      console.log('  - File Path:', filePath);
      console.log('  - File Exists:', require('fs').existsSync(filePath));
      console.log('  - Script Exists:', require('fs').existsSync(scriptPath));
      console.log('  - Python Exists:', require('fs').existsSync(pythonPath));
      console.log('  - Environment:', process.env.NODE_ENV || 'development');
      console.log('  - Working Directory:', process.cwd());
      
      // Additional debugging
      const fs = require('fs');
      try {
        const scriptStats = fs.statSync(scriptPath);
        console.log('  - Script Stats:', {
          size: scriptStats.size,
          isFile: scriptStats.isFile(),
          mode: scriptStats.mode.toString(8)
        });
      } catch (err) {
        console.log('  - Script Stats Error:', err.message);
      }
      
      // List scripts directory
      try {
        const scriptsDir = path.join(__dirname, '..', '..', 'scripts');
        const files = fs.readdirSync(scriptsDir);
        console.log('  - Scripts Directory Contents:', files);
      } catch (err) {
        console.log('  - Scripts Directory Error:', err.message);
      }
      
      // Check Python dependencies
      try {
        const venvLibPath = path.join(__dirname, '..', '..', 'venv', 'lib', 'python3.13', 'site-packages');
        const gdalExists = fs.existsSync(path.join(venvLibPath, 'osgeo'));
        const rasterioExists = fs.existsSync(path.join(venvLibPath, 'rasterio'));
        const numpyExists = fs.existsSync(path.join(venvLibPath, 'numpy'));
        
        console.log('  - Python Dependencies Check:');
        console.log('    - GDAL (osgeo):', gdalExists ? '✅' : '❌');
        console.log('    - Rasterio:', rasterioExists ? '✅' : '❌');
        console.log('    - NumPy:', numpyExists ? '✅' : '❌');
      } catch (err) {
        console.log('  - Dependencies Check Error:', err.message);
      }
      
      const pythonProcess = spawn(pythonPath, [scriptPath, filePath]);
      
      let output = '';
      let errorOutput = '';
      
      // Collect stdout data
      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      // Collect stderr data
      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      // Handle process completion
      pythonProcess.on('close', (code) => {
        console.log('🐍 Python Process Completed:');
        console.log('  - Exit Code:', code);
        console.log('  - Standard Output Length:', output.length);
        console.log('  - Error Output Length:', errorOutput.length);
        console.log('  - Raw Output Preview:', output.substring(0, 500));
        
        if (code === 0) {
          try {
            // Parse JSON output from Python
            const result = JSON.parse(output);
            console.log('✅ Python JSON Parsed Successfully:');
            console.log('  - Has spatial_info:', !!result.spatial_info);
            console.log('  - Has raster_info:', !!result.raster_info);
            console.log('  - Has error:', !!result.error);
            console.log('  - Keys:', Object.keys(result));
            
            resolve({
              success: true,
              data: result
            });
          } catch (parseError) {
            console.log('❌ JSON Parse Error:');
            console.log('  - Parse Error:', parseError.message);
            console.log('  - Raw Output:', output);
            
            resolve({
              success: false,
              error: `Invalid JSON output from Python: ${parseError.message}`,
              rawOutput: output
            });
          }
        } else {
          console.log('❌ Python Process Failed:');
          console.log('  - Exit Code:', code);
          console.log('  - Error Output:', errorOutput);
          console.log('  - Standard Output:', output);
          
          resolve({
            success: false,
            error: `Python process failed with code ${code}: ${errorOutput}`,
            rawOutput: output
          });
        }
      });
      
      // Handle process errors
      pythonProcess.on('error', (error) => {
        resolve({
          success: false,
          error: `Failed to start Python process: ${error.message}`
        });
      });
      
      // Set timeout (5 minutes)
      setTimeout(() => {
        pythonProcess.kill();
        resolve({
          success: false,
          error: 'Python process timeout after 5 minutes'
        });
      }, 5 * 60 * 1000);
    });
  }

  // Save extracted data to database
  async saveExtractedData(fileId, extractedData, processingSessionId = null) {
    try {
      console.log('💾 Saving extracted data to database...');
      console.log('  - File ID:', fileId);
      console.log('  - Extracted Data Keys:', Object.keys(extractedData || {}));
      console.log('  - Spatial Data:', extractedData?.spatial_info ? 'Present' : 'MISSING');
      console.log('  - Raster Data:', extractedData?.raster_info ? 'Present' : 'MISSING');
      
      // Validate required data structure
      if (!extractedData) {
        throw new Error('Extracted data is null or undefined');
      }
      
      if (!extractedData.spatial_info) {
        throw new Error('Spatial info is missing from extracted data');
      }
      
      if (!extractedData.raster_info) {
        throw new Error('Raster info is missing from extracted data');
      }
      
      if (!extractedData.spatial_info.bounding_box) {
        throw new Error('Bounding box is missing from spatial info');
      }
      
      console.log('  - Spatial Data Details:', JSON.stringify(extractedData.spatial_info, null, 2));
      console.log('  - Raster Data Details:', JSON.stringify(extractedData.raster_info, null, 2));
      
      // Start transaction
      await this.db.executeQuery('BEGIN');
      console.log('🔄 Transaction started');
      
      // Save to spatial_metadata table
      const spatialMetadataQuery = `
        INSERT INTO spatial_metadata (
          file_id, width, height, bands_count, pixel_type,
          coordinate_system, geotransform, extent_geom,
          resolution_x, resolution_y, nodata_value, band_statistics,
          processing_session_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `;

      const spatialData = extractedData.spatial_info;
      const rasterData = extractedData.raster_info;
      
      // Create PostGIS geometry from bounding box
      const extentGeom = `POLYGON((
        ${spatialData.bounding_box.x_min} ${spatialData.bounding_box.y_min},
        ${spatialData.bounding_box.x_max} ${spatialData.bounding_box.y_min},
        ${spatialData.bounding_box.x_max} ${spatialData.bounding_box.y_max},
        ${spatialData.bounding_box.x_min} ${spatialData.bounding_box.y_max},
        ${spatialData.bounding_box.x_min} ${spatialData.bounding_box.y_min}
      ))`;

      // Convert geotransform object to PostgreSQL array format
      const geotransformArray = [
        spatialData.geotransform.x0,
        spatialData.geotransform.y0,
        spatialData.geotransform.pixel_width,
        spatialData.geotransform.pixel_height,
        spatialData.geotransform.skew_x,
        spatialData.geotransform.skew_y
      ];

      const spatialValues = [
        fileId,
        rasterData.width,
        rasterData.height,
        rasterData.bands_count,
        'uint16', // Default, will be updated from band data
        spatialData.projection.epsg_code || spatialData.projection.wkt,
        geotransformArray, // PostgreSQL array format
        extentGeom,
        spatialData.resolution.x_meters,
        spatialData.resolution.y_meters,
        null, // nodata_value will be updated from band data
        JSON.stringify(extractedData.band_data), // JSONB type - convert to JSON string
        processingSessionId
      ];

      // Debug: Log the values being sent to database
      console.log('🔍 Debug Database Values:');
      console.log('  - File ID:', fileId);
      console.log('  - Geotransform Array:', geotransformArray);
      console.log('  - Band Data Type:', typeof extractedData.band_data);
      console.log('  - Band Data:', JSON.stringify(extractedData.band_data, null, 2).substring(0, 200) + '...');
      
      // Debug: Log SQL query and parameters
      console.log('🔍 Debug SQL Query:');
      console.log('  - Query:', spatialMetadataQuery);
      console.log('  - Parameters:', JSON.stringify(spatialValues, null, 2));

      const result = await this.db.executeQuery(spatialMetadataQuery, spatialValues);
      console.log('💾 Spatial metadata saved:', result);

      // Create data relationship for traceability
      if (processingSessionId && result.data && result.data[0]) {
        await this.createDataRelationship(
          processingSessionId,
          'geotiff_files', fileId,
          'spatial_metadata', result.data[0].id,
          'derived_from',
          'Spatial metadata derived from original GeoTIFF file'
        );
      }

      // Commit transaction
      await this.db.executeQuery('COMMIT');
      console.log('✅ Transaction committed');

      return {
        success: true,
        data: { message: 'Extracted data saved successfully' }
      };

    } catch (error) {
      console.error('❌ Error saving extracted data:', error);
      
      // Rollback transaction
      try {
        await this.db.executeQuery('ROLLBACK');
        console.log('🔄 Transaction rolled back');
      } catch (rollbackError) {
        console.error('❌ Rollback failed:', rollbackError);
      }
      
      return {
        success: false,
        error: `Failed to save extracted data: ${error.message}`
      };
    }
  }

  // Update file status
  async updateFileStatus(fileId, status) {
    try {
      console.log('🔄 Updating file status:', fileId, '→', status);
      
      const query = `
        UPDATE geotiff_files 
        SET upload_status = $1, 
            updated_at = CURRENT_TIMESTAMP,
            processed_at = CASE WHEN $1 = 'processed' THEN CURRENT_TIMESTAMP ELSE processed_at END
        WHERE id = $2
      `;
      
      await this.db.executeQuery(query, [status, fileId]);
      
      return {
        success: true,
        data: { message: `File status updated to ${status}` }
      };
    } catch (error) {
      console.error('Error updating file status:', error);
      return {
        success: false,
        error: `Failed to update file status: ${error.message}`
      };
    }
  }

  // Cleanup temporary file
  cleanupTempFile(filePath) {
    try {
      const fs = require('fs');
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('🧹 Cleaned up temporary file:', filePath);
      }
    } catch (error) {
      console.error('Error cleaning up temp file:', error);
    }
  }

  // Count extracted data points for reporting (อัปเดตให้รองรับข้อมูลใหม่)
  _countExtractedDataPoints(extractedData) {
    if (!extractedData) return 0;
    
    let count = 0;
    let validDataCount = 0;
    
    // Count basic data
    if (extractedData.file_info) count++;
    if (extractedData.raster_info) count++;
    if (extractedData.spatial_info) count++;
    
    // Count band data และตรวจสอบ valid statistics
    if (extractedData.band_data && Array.isArray(extractedData.band_data)) {
      count += extractedData.band_data.length;
      
      // นับ valid statistics ใน band data
      extractedData.band_data.forEach(band => {
        if (band.statistics) {
          if (band.statistics.min !== null && band.statistics.max !== null) {
            validDataCount++;
          }
        }
      });
    }
    
    // Count metadata domains
    if (extractedData.metadata) {
      count += Object.keys(extractedData.metadata).length;
    }
    
    // Count computed indices และตรวจสอบ DYNAMIC ANALYSIS
    if (extractedData.computed_indices) {
      const indicesKeys = Object.keys(extractedData.computed_indices);
      count += indicesKeys.length;
      
      // ตรวจสอบ Band Detection
      if (extractedData.computed_indices.band_detection) {
        const detectedBands = Object.keys(extractedData.computed_indices.band_detection);
        validDataCount += detectedBands.length;
      }
      
      // ตรวจสอบ RGB Analysis
      if (extractedData.computed_indices.rgb && extractedData.computed_indices.rgb.brightness) {
        const brightness = extractedData.computed_indices.rgb.brightness;
        if (brightness.mean !== null && brightness.std !== null) {
          validDataCount++;
        }
      }
      
      // ตรวจสอบ Vegetation Indices
      if (extractedData.computed_indices.vegetation) {
        const vegIndices = Object.keys(extractedData.computed_indices.vegetation);
        validDataCount += vegIndices.length;
      }
      
      // ตรวจสอบ Water Indices
      if (extractedData.computed_indices.water) {
        const waterIndices = Object.keys(extractedData.computed_indices.water);
        validDataCount += waterIndices.length;
      }
      
      // ตรวจสอบ Soil/Urban Indices
      if (extractedData.computed_indices.soil) {
        const soilIndices = Object.keys(extractedData.computed_indices.soil);
        validDataCount += soilIndices.length;
      }
      
      // ตรวจสอบ Thermal Analysis
      if (extractedData.computed_indices.thermal) {
        const thermalIndices = Object.keys(extractedData.computed_indices.thermal);
        validDataCount += thermalIndices.length;
      }
      
      // ตรวจสอบ Spectral Analysis
      if (extractedData.computed_indices.spectral_analysis) {
        const spectralKeys = Object.keys(extractedData.computed_indices.spectral_analysis);
        validDataCount += spectralKeys.length;
        
        // Count correlations
        if (extractedData.computed_indices.spectral_analysis.band_correlations) {
          const correlations = Object.keys(extractedData.computed_indices.spectral_analysis.band_correlations);
          validDataCount += correlations.length;
        }
      }
      
      // ตรวจสอบ Custom Indices
      if (extractedData.computed_indices.custom) {
        const customIndices = Object.keys(extractedData.computed_indices.custom);
        validDataCount += customIndices.length;
      }
    }
    
    // Count spatial features
    if (extractedData.spatial_features) {
      count += Object.keys(extractedData.spatial_features).length;
      
      // นับ geometry shapes ถ้ามี
      if (extractedData.spatial_features.geometry_shapes && 
          extractedData.spatial_features.geometry_shapes.shapes) {
        validDataCount += extractedData.spatial_features.geometry_shapes.shapes.length;
      }
    }
    
    // Count statistics summary
    if (extractedData.statistics) {
      count += Object.keys(extractedData.statistics).length;
    }
    
    return {
      totalSections: count,
      validDataPoints: validDataCount,
      extractionQuality: validDataCount > 0 ? 'good' : 'limited'
    };
  }

  // Validate extracted data quality (ตรวจสอบคุณภาพข้อมูลที่สกัดได้)
  _validateExtractedData(extractedData) {
    if (!extractedData) {
      return {
        status: 'failed',
        message: 'No data extracted',
        issues: ['Missing extracted data']
      };
    }

    const issues = [];
    const warnings = [];

    // ตรวจสอบ Band Statistics
    if (extractedData.band_data && Array.isArray(extractedData.band_data)) {
      let validBands = 0;
      extractedData.band_data.forEach((band, index) => {
        if (!band.statistics) {
          issues.push(`Band ${index + 1}: Missing statistics`);
        } else if (band.statistics.min === null || band.statistics.max === null) {
          warnings.push(`Band ${index + 1}: Incomplete statistics (min/max is null)`);
        } else {
          validBands++;
        }
        
        // ตรวจสอบ valid pixels ratio
        if (band.statistics && band.statistics.total_pixels > 0) {
          const validRatio = band.statistics.valid_pixels / band.statistics.total_pixels;
          if (validRatio < 0.01) { // น้อยกว่า 1%
            warnings.push(`Band ${index + 1}: Very low valid pixel ratio (${(validRatio * 100).toFixed(2)}%)`);
          }
        }
      });

      if (validBands === 0) {
        issues.push('No valid band statistics found');
      }
    } else {
      issues.push('Missing band data');
    }

    // ตรวจสอบ DYNAMIC ANALYSIS RESULTS
    if (extractedData.computed_indices) {
      // ตรวจสอบ Band Detection
      if (!extractedData.computed_indices.band_detection) {
        warnings.push('Band type detection not performed');
      }
      
      // ตรวจสอบ RGB Analysis
      if (extractedData.computed_indices.rgb) {
        const brightness = extractedData.computed_indices.rgb.brightness;
        if (!brightness || brightness.mean === null) {
          warnings.push('RGB brightness calculation incomplete');
        }
      }
      
      // ตรวจสอบ Sensor Detection
      if (extractedData.metadata && extractedData.metadata.parsed_info) {
        const sensorInfo = extractedData.metadata.parsed_info.sensor_info;
        if (!sensorInfo || !sensorInfo.detected_sensor) {
          warnings.push('Sensor type not detected');
        }
      }
      
      // ตรวจสอบ Spectral Analysis
      if (extractedData.computed_indices.spectral_analysis) {
        const spectral = extractedData.computed_indices.spectral_analysis;
        if (!spectral.band_correlations || Object.keys(spectral.band_correlations).length === 0) {
          warnings.push('Band correlation analysis incomplete');
        }
        if (!spectral.surface_material_hints || spectral.surface_material_hints.length === 0) {
          warnings.push('Surface material classification not available');
        }
      } else {
        warnings.push('Advanced spectral analysis not performed');
      }
    }

    // ตรวจสอบ Spatial Information
    if (!extractedData.spatial_info) {
      issues.push('Missing spatial information');
    } else {
      if (!extractedData.spatial_info.projection) {
        issues.push('Missing projection information');
      }
      if (!extractedData.spatial_info.bounding_box) {
        issues.push('Missing bounding box information');
      }
    }

    // ตรวจสอบ File Information
    if (!extractedData.file_info) {
      issues.push('Missing file information');
    }

    // กำหนดสถานะโดยรวม
    let status = 'excellent';
    if (issues.length > 0) {
      status = 'failed';
    } else if (warnings.length > 2) {
      status = 'poor';
    } else if (warnings.length > 0) {
      status = 'good';
    }

    return {
      status,
      message: this._getQualityMessage(status, issues.length, warnings.length),
      issues,
      warnings,
      summary: {
        totalIssues: issues.length,
        totalWarnings: warnings.length,
        completenessScore: this._calculateCompletenessScore(extractedData)
      }
    };
  }

  _getQualityMessage(status, issueCount, warningCount) {
    switch (status) {
      case 'excellent':
        return 'Data extraction completed successfully with high quality';
      case 'good':
        return `Data extraction completed with ${warningCount} minor warning(s)`;
      case 'poor':
        return `Data extraction completed but with ${warningCount} quality issue(s)`;
      case 'failed':
        return `Data extraction incomplete: ${issueCount} critical issue(s) found`;
      default:
        return 'Data extraction completed';
    }
  }

  _calculateCompletenessScore(extractedData) {
    let score = 0;
    const maxScore = 100;

    // File info (20 points)
    if (extractedData.file_info) score += 20;

    // Raster info (20 points)
    if (extractedData.raster_info) score += 20;

    // Spatial info (25 points)
    if (extractedData.spatial_info) {
      score += 15;
      if (extractedData.spatial_info.projection) score += 5;
      if (extractedData.spatial_info.bounding_box) score += 5;
    }

    // Band data (25 points)
    if (extractedData.band_data && Array.isArray(extractedData.band_data)) {
      const validBands = extractedData.band_data.filter(band => 
        band.statistics && band.statistics.min !== null && band.statistics.max !== null
      ).length;
      const totalBands = extractedData.band_data.length;
      score += Math.round((validBands / totalBands) * 25);
    }

    // Advanced Analysis (30 points total)
    if (extractedData.computed_indices) {
      let analysisScore = 0;
      
      // Band Detection (5 points)
      if (extractedData.computed_indices.band_detection) analysisScore += 5;
      
      // RGB Analysis (5 points)
      if (extractedData.computed_indices.rgb && extractedData.computed_indices.rgb.brightness) {
        const brightness = extractedData.computed_indices.rgb.brightness;
        if (brightness && brightness.mean !== null) analysisScore += 5;
      }
      
      // Vegetation Indices (5 points)
      if (extractedData.computed_indices.vegetation) analysisScore += 5;
      
      // Water Indices (3 points)
      if (extractedData.computed_indices.water) analysisScore += 3;
      
      // Soil/Urban Indices (3 points)
      if (extractedData.computed_indices.soil) analysisScore += 3;
      
      // Thermal Analysis (2 points)
      if (extractedData.computed_indices.thermal) analysisScore += 2;
      
      // Spectral Analysis (5 points)
      if (extractedData.computed_indices.spectral_analysis) {
        const spectral = extractedData.computed_indices.spectral_analysis;
        if (spectral.band_correlations && Object.keys(spectral.band_correlations).length > 0) {
          analysisScore += 2;
        }
        if (spectral.surface_material_hints && spectral.surface_material_hints.length > 0) {
          analysisScore += 3;
        }
      }
      
      // Custom Indices (2 points)
      if (extractedData.computed_indices.custom) analysisScore += 2;
      
      score += Math.min(analysisScore, 30); // Cap at 30 points
    }
    
    // Sensor Detection Bonus (5 points)
    if (extractedData.metadata && extractedData.metadata.parsed_info) {
      const sensorInfo = extractedData.metadata.parsed_info.sensor_info;
      if (sensorInfo && sensorInfo.detected_sensor) {
        score += 5;
      }
    }

    return Math.min(score, 110); // Updated max score to include new analyses
  }

  // Save raw data for permanent storage before file deletion
  async saveRawDataForPermanentStorage(fileId, extractedData, processingSessionId = null) {
    try {
      console.log('🗄️ Saving raw data for permanent storage...');
      
      if (!extractedData.raw_storage) {
        return {
          success: false,
          error: 'No raw storage data found in extracted data'
        };
      }

      // Start transaction
      await this.db.executeQuery('BEGIN');
      console.log('🔄 Raw data storage transaction started');

      const rawStorage = extractedData.raw_storage;
      
      // 1. Save complete metadata
      const metadataQuery = `
        INSERT INTO raw_file_metadata (
          file_id, gdal_metadata, band_metadata, sensor_info, 
          acquisition_info, processing_info, coordinate_info, quality_info,
          file_format_info, geotransform, projection_wkt, processing_session_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id
      `;
      
      const completeMetadata = rawStorage.complete_metadata;
      const metadataResult = await this.db.executeQuery(metadataQuery, [
        fileId,
        JSON.stringify(completeMetadata.gdal_metadata || {}),
        JSON.stringify(completeMetadata.band_metadata || {}),
        JSON.stringify(extractedData.metadata?.parsed_info?.sensor_info || {}),
        JSON.stringify(extractedData.metadata?.parsed_info?.acquisition_info || {}),
        JSON.stringify(extractedData.metadata?.parsed_info?.processing_info || {}),
        JSON.stringify(extractedData.metadata?.parsed_info?.coordinate_info || {}),
        JSON.stringify(extractedData.metadata?.parsed_info?.quality_info || {}),
        JSON.stringify(completeMetadata.driver_info || {}),
        completeMetadata.geotransform || null,
        completeMetadata.projection?.wkt || null,
        processingSessionId
      ]);

      // 2. Save band data with pixel samples
      if (extractedData.band_data && Array.isArray(extractedData.band_data)) {
        for (const band of extractedData.band_data) {
          const bandQuery = `
            INSERT INTO raw_band_data (
              file_id, band_number, band_description, band_type, data_type,
              statistics, histogram, sample_pixels, wavelength, 
              color_interpretation, nodata_value, scale_factor, band_offset, unit_type,
              processing_session_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          `;
          
          // Get samples for this band
          const bandSamples = rawStorage.pixel_samples?.[`band_${band.band_number}`] || {};
          
          await this.db.executeQuery(bandQuery, [
            fileId,
            band.band_number,
            band.description || null,
            band.detected_type || 'unknown',
            band.data_type,
            JSON.stringify(band.statistics),
            JSON.stringify(band.histogram || {}),
            JSON.stringify(bandSamples),
            band.wavelength || null,
            band.color_interpretation || null,
            band.nodata_value || null,
            band.scale || null,
            band.offset || null,
            band.unit_type || null,
            processingSessionId
          ]);
        }
      }

      // 3. Save complete analysis results
      const analysisQuery = `
        INSERT INTO complete_analysis_results (
          file_id, vegetation_indices, water_indices, soil_urban_indices,
          thermal_indices, custom_indices, band_correlations, spectral_signatures,
          surface_material_hints, atmospheric_analysis, rgb_analysis, spatial_features,
          processing_session_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id
      `;
      
      const indices = extractedData.computed_indices || {};
      await this.db.executeQuery(analysisQuery, [
        fileId,
        JSON.stringify(indices.vegetation || {}),
        JSON.stringify(indices.water || {}),
        JSON.stringify(indices.soil || {}),
        JSON.stringify(indices.thermal || {}),
        JSON.stringify(indices.custom || {}),
        JSON.stringify(indices.spectral_analysis?.band_correlations || {}),
        JSON.stringify(indices.spectral_analysis?.spectral_curve || {}),
        JSON.stringify(indices.spectral_analysis?.surface_material_hints || []),
        JSON.stringify(indices.spectral_analysis?.atmospheric_analysis || {}),
        JSON.stringify(indices.rgb || {}),
        JSON.stringify(extractedData.spatial_features || {}),
        processingSessionId
      ]);

      // 4. Save extraction summary
      const summaryQuery = `
        INSERT INTO extraction_summary (
          file_id, extraction_timestamp, extractor_version, extraction_method,
          total_bands_extracted, total_indices_calculated, total_pixels_processed,
          valid_pixel_ratio, extraction_quality_score, data_completeness_percentage,
          has_sensor_detection, has_spectral_analysis, original_filename,
          original_file_size, original_checksum, raw_metadata_size, 
          raw_band_data_size, compressed_pixel_data_size, total_storage_size,
          processing_session_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        RETURNING id
      `;
      
      const reconstructionInfo = rawStorage.reconstruction_info || {};
      const qualityInfo = this._validateExtractedData(extractedData);
      
      // Calculate storage sizes
      const metadataSize = JSON.stringify(completeMetadata).length;
      const bandDataSize = extractedData.band_data ? JSON.stringify(extractedData.band_data).length : 0;
      const analysisSize = JSON.stringify(indices).length;
      const totalSize = metadataSize + bandDataSize + analysisSize;

      await this.db.executeQuery(summaryQuery, [
        fileId,
        extractedData.extraction_timestamp,
        extractedData.extractor_version || '1.0.1',
        'dynamic_comprehensive_with_raw_storage',
        extractedData.band_data?.length || 0,
        Object.keys(indices).length,
        reconstructionInfo.dimensions?.width * reconstructionInfo.dimensions?.height || 0,
        this._calculateValidPixelRatio(extractedData),
        qualityInfo.summary?.completenessScore || 0,
        (qualityInfo.summary?.completenessScore || 0) / 110 * 100,
        !!extractedData.metadata?.parsed_info?.sensor_info?.detected_sensor,
        !!indices.spectral_analysis,
        reconstructionInfo.original_filename || 'unknown.tif',
        reconstructionInfo.original_size_bytes || 0,
        this._calculateDataChecksum(extractedData),
        metadataSize,
        bandDataSize,
        0, // compressed_pixel_data_size (not implemented yet)
        totalSize,
        processingSessionId
      ]);

      // Commit transaction
      await this.db.executeQuery('COMMIT');
      console.log('✅ Raw data storage transaction committed');

      // Calculate storage statistics
      const storageStats = await this._calculateStorageStatistics(fileId);

      return {
        success: true,
        details: {
          metadata_stored: true,
          band_data_stored: extractedData.band_data?.length || 0,
          analysis_results_stored: Object.keys(indices).length,
          pixel_samples_stored: this._countPixelSamples(rawStorage.pixel_samples),
          total_storage_size: storageStats.total_size,
          reconstruction_feasible: reconstructionInfo.reconstruction_feasible || false,
          storage_timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      // Rollback on error
      await this.db.executeQuery('ROLLBACK');
      console.error('Raw data storage error:', error);
      return {
        success: false,
        error: `Failed to store raw data: ${error.message}`
      };
    }
  }

  _calculateValidPixelRatio(extractedData) {
    if (!extractedData.band_data || !Array.isArray(extractedData.band_data)) return 0;
    
    let totalPixels = 0;
    let validPixels = 0;
    
    extractedData.band_data.forEach(band => {
      if (band.statistics) {
        totalPixels += band.statistics.total_pixels || 0;
        validPixels += band.statistics.valid_pixels || 0;
      }
    });
    
    return totalPixels > 0 ? validPixels / totalPixels : 0;
  }

  _calculateDataChecksum(extractedData) {
    const crypto = require('crypto');
    const dataString = JSON.stringify(extractedData);
    return crypto.createHash('md5').update(dataString).digest('hex');
  }

  _countPixelSamples(pixelSamples) {
    if (!pixelSamples) return 0;
    
    let total = 0;
    Object.values(pixelSamples).forEach(bandSamples => {
      if (bandSamples.samples) {
        total += bandSamples.samples.length;
      }
    });
    
    return total;
  }

  async _calculateStorageStatistics(fileId) {
    try {
      const query = `
        SELECT 
          pg_total_relation_size('raw_file_metadata') + 
          pg_total_relation_size('raw_band_data') + 
          pg_total_relation_size('complete_analysis_results') + 
          pg_total_relation_size('extraction_summary') as total_size
      `;
      const result = await this.db.executeQuery(query);
      return {
        total_size: result.rows[0]?.total_size || 0
      };
    } catch (error) {
      return { total_size: 0 };
    }
  }

  // Create processing session for complete traceability
  async createProcessingSession(userId, fileId, fileInfo) {
    try {
      const sessionQuery = `
        INSERT INTO processing_sessions (
          file_id, user_id, original_filename, original_file_path,
          original_file_size, processing_trigger, status,
          python_script_version, processing_method
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, session_uuid
      `;

      const result = await this.db.executeQuery(sessionQuery, [
        fileId,
        userId,
        fileInfo.original_filename || fileInfo.filename,
        fileInfo.file_path,
        fileInfo.file_size,
        'user_request',
        'started',
        '1.0.1-with-raw-storage',
        'dynamic_comprehensive_with_raw_storage'
      ]);

      const sessionId = result.data[0].id;
      
      // Log initial processing step
      await this.logProcessingStep(sessionId, 1, 'session_created', 'Processing session initiated', 'completed');
      
      return sessionId;

    } catch (error) {
      console.error('Error creating processing session:', error);
      throw error;
    }
  }

  // Log processing step for detailed traceability
  async logProcessingStep(sessionId, stepOrder, stepName, stepDescription, stepStatus = 'started', stepOutput = null) {
    try {
      const stepQuery = `
        INSERT INTO processing_steps_log (
          processing_session_id, step_order, step_name, step_description,
          step_status, step_output, step_end_time, step_duration_ms
        ) VALUES ($1, $2, $3, $4, $5::varchar, $6, 
          CASE WHEN $5::varchar IN ('completed', 'failed', 'skipped') THEN CURRENT_TIMESTAMP ELSE NULL END,
          CASE WHEN $5::varchar IN ('completed', 'failed', 'skipped') THEN 
            0 ELSE NULL END
        )
        RETURNING id
      `;

      const result = await this.db.executeQuery(stepQuery, [
        sessionId, stepOrder, stepName, stepDescription, stepStatus, 
        stepOutput ? JSON.stringify(stepOutput) : null
      ]);

      // Check if query was successful and returned data
      if (result.success && result.data && result.data.length > 0) {
        return result.data[0].id;
      } else {
        console.error('Processing step query did not return expected data:', result);
        return null;
      }

    } catch (error) {
      console.error('Error logging processing step:', error);
      // Don't throw error here to avoid breaking main processing
      return null;
    }
  }

  // Update processing session status
  async updateProcessingSession(sessionId, status, errorMessage = null, processingTimeMs = null, progress = null, stepDescription = null) {
    try {
      console.log(`🔄 Updating processing session ${sessionId} to status: ${status}, progress: ${progress}`);
      
      const updateQuery = `
        UPDATE processing_sessions 
        SET status = $1::varchar, 
            session_end_time = CASE WHEN $1::varchar IN ('completed', 'failed') THEN CURRENT_TIMESTAMP ELSE session_end_time END,
            error_message = $2,
            total_processing_time_ms = $3,
            progress_percentage = COALESCE($4, progress_percentage),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
      `;

      const params = [status, errorMessage, processingTimeMs, progress, sessionId];
      console.log(`📝 Update query:`, updateQuery);
      console.log(`📝 Parameters:`, params);

      const result = await this.db.executeQuery(updateQuery, params);
      
      if (result.success) {
        console.log(`✅ Successfully updated processing session ${sessionId} to ${status}`);
      } else {
        console.error(`❌ Failed to update processing session ${sessionId}:`, result.error);
      }

    } catch (error) {
      console.error('Error updating processing session:', error);
      // Don't throw error here to avoid breaking main processing
    }
  }

  // Create data relationship for traceability
  async createDataRelationship(sessionId, sourceTable, sourceId, targetTable, targetId, relationshipType, description = null) {
    try {
      const relationQuery = `
        INSERT INTO data_relationships (
          processing_session_id, source_table, source_record_id,
          target_table, target_record_id, relationship_type, relationship_description
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `;

      const result = await this.db.executeQuery(relationQuery, [
        sessionId, sourceTable, sourceId, targetTable, targetId, relationshipType, description
      ]);

      return result.data[0].id;

    } catch (error) {
      console.error('Error creating data relationship:', error);
      return null;
    }
  }

  // Get real-time processing status from processing sessions
  async getRealTimeProcessingStatus(fileId) {
    try {
      const query = `
        SELECT 
          ps.id as session_id,
          ps.session_uuid,
          ps.status as processing_status,
          ps.progress_percentage,
          ps.step_description,
          ps.session_start_time,
          ps.session_end_time,
          ps.total_processing_time_ms,
          ps.error_message,
          ps.python_script_version,
          ps.processing_method,
          ps.created_at,
          ps.updated_at
        FROM processing_sessions ps
        WHERE ps.file_id = $1
        ORDER BY ps.created_at DESC
        LIMIT 1
      `;
      
      const result = await this.db.executeQuery(query, [fileId]);
      
      if (result.data.length === 0) {
        return {
          success: true,
          data: {
            hasSession: false,
            status: 'no_session',
            message: 'No processing session found for this file'
          }
        };
      }
      
      const session = result.data[0];
      
      // Determine detailed status
      let detailedStatus = 'unknown';
      let statusMessage = '';
      
      switch (session.processing_status) {
        case 'started':
          detailedStatus = 'initializing';
          statusMessage = 'Processing session started, preparing to process...';
          break;
        case 'processing':
          detailedStatus = 'in_progress';
          statusMessage = session.step_description || 'Processing in progress...';
          break;
        case 'completed':
          detailedStatus = 'completed';
          statusMessage = 'Processing completed successfully';
          break;
        case 'failed':
          detailedStatus = 'failed';
          statusMessage = session.error_message || 'Processing failed';
          break;
        default:
          detailedStatus = 'unknown';
          statusMessage = 'Unknown processing status';
      }
      
      return {
        success: true,
        data: {
          hasSession: true,
          sessionId: session.session_id,
          sessionUuid: session.session_uuid,
          status: detailedStatus,
          processingStatus: session.processing_status,
          progress: session.progress_percentage || 0,
          stepDescription: session.step_description,
          statusMessage: statusMessage,
          startTime: session.session_start_time,
          endTime: session.session_end_time,
          totalProcessingTime: session.total_processing_time_ms,
          errorMessage: session.error_message,
          pythonVersion: session.python_script_version,
          processingMethod: session.processing_method,
          createdAt: session.created_at,
          updatedAt: session.updated_at
        }
      };
      
    } catch (error) {
      console.error('Error getting real-time processing status:', error);
      return {
        success: false,
        error: `Failed to get processing status: ${error.message}`
      };
    }
  }

  // Get processing steps log for detailed progress tracking
  async getProcessingStepsLog(sessionId) {
    try {
      const query = `
        SELECT 
          step_order,
          step_name,
          step_description,
          step_status,
          step_output,
          step_start_time,
          step_end_time,
          step_duration_ms,
          created_at
        FROM processing_steps_log
        WHERE processing_session_id = $1
        ORDER BY step_order ASC
      `;
      
      const result = await this.db.executeQuery(query, [sessionId]);
      
      return {
        success: true,
        data: {
          steps: result.data,
          totalSteps: result.data.length,
          completedSteps: result.data.filter(step => step.step_status === 'completed').length,
          failedSteps: result.data.filter(step => step.step_status === 'failed').length
        }
      };
      
    } catch (error) {
      console.error('Error getting processing steps log:', error);
      return {
        success: false,
        error: `Failed to get processing steps: ${error.message}`
      };
    }
  }

  // Validate filename format and extract acquisition date
  validateFilenameAndExtractDate(filename) {
    try {
      // รูปแบบที่ต้องการ: NAME_YYYYMMDD.tif หรือ NAME_YYYYMMDD.tiff
      // ตัวอย่าง: MCD18A1_20250605.tif
      
      // ตรวจสอบนามสกุลไฟล์
      const validExtensions = ['.tif', '.tiff'];
      const fileExtension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
      
      if (!validExtensions.includes(fileExtension)) {
        return {
          isValid: false,
          error: 'นามสกุลไฟล์ไม่ถูกต้อง ต้องเป็น .tif หรือ .tiff เท่านั้น'
        };
      }

      // ตัดนามสกุลไฟล์ออก
      const filenameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));
      
      // ตรวจสอบว่ามี _ หรือไม่
      if (!filenameWithoutExt.includes('_')) {
        return {
          isValid: false,
          error: 'ชื่อไฟล์ต้องมี _ คั่นระหว่างชื่อไฟล์และวันที่'
        };
      }

      // แยกชื่อไฟล์และวันที่
      const parts = filenameWithoutExt.split('_');
      if (parts.length !== 2) {
        return {
          isValid: false,
          error: 'ชื่อไฟล์ต้องมีรูปแบบ: NAME_YYYYMMDD'
        };
      }

      const [fileName, dateString] = parts;
      
      // ตรวจสอบว่าชื่อไฟล์ไม่ว่าง
      if (!fileName || fileName.trim() === '') {
        return {
          isValid: false,
          error: 'ชื่อไฟล์ไม่สามารถว่างได้'
        };
      }

      // ตรวจสอบรูปแบบวันที่ (YYYYMMDD)
      if (!/^\d{8}$/.test(dateString)) {
        return {
          isValid: false,
          error: 'รูปแบบวันที่ไม่ถูกต้อง ต้องเป็น YYYYMMDD (เช่น 20250605)'
        };
      }

      // แยกวันที่
      const year = parseInt(dateString.substring(0, 4));
      const month = parseInt(dateString.substring(4, 6));
      const day = parseInt(dateString.substring(6, 8));

      // ตรวจสอบความถูกต้องของวันที่
      const date = new Date(year, month - 1, day); // month - 1 เพราะ Date constructor ใช้ 0-based month
      
      if (date.getFullYear() !== year || 
          date.getMonth() !== month - 1 || 
          date.getDate() !== day) {
        return {
          isValid: false,
          error: 'วันที่ไม่ถูกต้อง (เช่น วันที่ 32 หรือเดือน 13)'
        };
      }

      // ตรวจสอบว่าวันที่ไม่เกินวันปัจจุบัน
      const today = new Date();
      if (date > today) {
        return {
          isValid: false,
          error: 'วันที่ไม่สามารถเป็นอนาคตได้'
        };
      }

      // สร้าง Date object สำหรับ database
      const acquisitionDate = new Date(year, month - 1, day);
      
      return {
        isValid: true,
        fileName: fileName,
        acquisitionDate: acquisitionDate,
        dateString: dateString,
        year: year,
        month: month,
        day: day
      };

    } catch (error) {
      console.error('Error validating filename:', error);
      return {
        isValid: false,
        error: 'เกิดข้อผิดพลาดในการตรวจสอบชื่อไฟล์'
      };
    }
  }
}

module.exports = FileService;
