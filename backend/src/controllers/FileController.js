const BaseController = require('./BaseController');
const FileService = require('../services/FileService');
const DataVerificationService = require('../services/DataVerificationService');
const AuthMiddleware = require('../middleware/authMiddleware');
const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/tiff' || file.mimetype === 'image/geotiff' || 
        file.originalname.toLowerCase().endsWith('.tiff') || 
        file.originalname.toLowerCase().endsWith('.tif')) {
      cb(null, true);
    } else {
      cb(new Error('Only GeoTIFF files are allowed'), false);
    }
  }
});

class FileController extends BaseController {
  constructor() {
    super();
    this.fileService = new FileService();
    this.dataVerification = new DataVerificationService();
  }

  initializeRoutes() {
    this.router.post('/upload', 
      AuthMiddleware.verifyToken, 
      upload.single('geotiff'), 
      this.uploadGeoTIFF.bind(this)
    );
    
    this.router.get('/files', 
      AuthMiddleware.verifyToken, 
      this.getUserFiles.bind(this)
    );
    
    this.router.get('/files/:fileId', 
      AuthMiddleware.verifyToken, 
      this.getFileDetails.bind(this)
    );
    
    this.router.delete('/files/:fileId', 
      AuthMiddleware.verifyToken, 
      this.deleteFile.bind(this)
    );

    this.router.get('/nextcloud/test', 
      AuthMiddleware.verifyToken, 
      this.testNextcloudConnection.bind(this)
    );

    this.router.post('/:fileId/process', 
      AuthMiddleware.verifyToken, 
      this.processGeoTIFF.bind(this)
    );
    
    this.router.get('/:fileId/process/status', 
      AuthMiddleware.verifyToken, 
      this.getProcessingStatus.bind(this)
    );
    
    this.router.get('/:fileId/metadata', 
      AuthMiddleware.verifyToken, 
      this.getFileMetadata.bind(this)
    );
  }

  async uploadGeoTIFF(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file provided'
        });
      }

      const userId = req.user.id;
      const fileData = {
        originalname: req.file.originalname,
        buffer: req.file.buffer,
        size: req.file.size,
        mimetype: req.file.mimetype
      };

      const result = await this.fileService.uploadGeoTIFF(userId, fileData);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
          details: 'กรุณาตรวจสอบรูปแบบชื่อไฟล์ ต้องเป็น: NAME_YYYYMMDD.tif (เช่น MCD18A1_20250605.tif)'
        });
      }

      res.status(201).json({
        success: true,
        data: result.data
      });

    } catch (error) {
      console.error('File upload error:', error);
      res.status(500).json({
        success: false,
        error: 'File upload failed'
      });
    }
  }

  async getUserFiles(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20, status, search, session_status } = req.query;

      const result = await this.fileService.getUserFiles(userId, {
        page: parseInt(page),
        limit: parseInt(limit),
        status,
        search,
        session_status
      });

      res.status(200).json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('Get user files error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve files'
      });
    }
  }

  async getFileDetails(req, res) {
    try {
      const userId = req.user.id;
      const { fileId } = req.params;

      const result = await this.fileService.getFileDetails(userId, fileId);

      if (!result.success) {
        return res.status(404).json({
          success: false,
          error: result.error
        });
      }

      res.status(200).json({
        success: true,
        data: result.data
      });

    } catch (error) {
      console.error('Get file details error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve file details'
      });
    }
  }

  async deleteFile(req, res) {
    try {
      const userId = req.user.id;
      const { fileId } = req.params;

      const result = await this.fileService.deleteFile(userId, fileId);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }

      res.status(200).json({
        success: true,
        data: { message: 'File deleted successfully' }
      });

    } catch (error) {
      console.error('Delete file error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete file'
      });
    }
  }

  async testNextcloudConnection(req, res) {
    try {
      const result = await this.fileService.testNextcloudConnection();

      res.status(200).json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('Nextcloud connection test error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to test Nextcloud connection'
      });
    }
  }

  async processGeoTIFF(req, res) {
    try {
      const userId = req.user.id;
      const { fileId } = req.params;

      console.log(`🔄 Starting GeoTIFF processing for file: ${fileId}`);

      const result = await this.fileService.processGeoTIFF(userId, fileId);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }

      res.status(200).json({
        success: true,
        data: {
          message: 'GeoTIFF processing started successfully',
          fileId: fileId,
          status: 'processing',
          extractedData: result.data.extractedData
        }
      });

    } catch (error) {
      console.error('GeoTIFF processing error:', error);
      res.status(500).json({
        success: false,
        error: `Failed to process GeoTIFF: ${error.message}`
      });
    }
  }

  async getProcessingStatus(req, res) {
    try {
      const userId = req.user.id;
      const { fileId } = req.params;

      const result = await this.fileService.getFileDetails(userId, fileId);

      if (!result.success) {
        return res.status(404).json({
          success: false,
          error: result.error
        });
      }

      const file = result.data;
      
      const processingDataCheck = await this.fileService.checkProcessingDataExists(file.id);
      let sessionDetails = null;
      try {
        const sessionQuery = `
          SELECT status, progress_percentage, error_message, 
                 session_start_time, session_end_time, total_processing_time_ms
          FROM processing_sessions 
          WHERE file_id = $1 
          ORDER BY created_at DESC 
          LIMIT 1
        `;
        
        const sessionResult = await this.fileService.db.executeQuery(sessionQuery, [fileId]);
        if (sessionResult && sessionResult.data && sessionResult.data.length > 0) {
          sessionDetails = sessionResult.data[0];
        }
      } catch (error) {
        console.error('Error getting session details:', error);
      }

      let processingStatus = 'not_started';
      if (sessionDetails) {
        switch (sessionDetails.status) {
          case 'started':
            processingStatus = 'initializing';
            break;
          case 'processing':
            processingStatus = 'in_progress';
            break;
          case 'completed':
            processingStatus = 'completed';
            break;
          case 'failed':
            processingStatus = 'failed';
            break;
          default:
            processingStatus = 'unknown';
        }
      } else {
        processingStatus = 'unknown';
      }
      
      const status = {
        fileId: file.id,
        filename: file.filename,
        uploadStatus: file.upload_status,
        processingStatus: processingStatus,
        processedAt: file.processed_at,
        createdAt: file.created_at,
        updatedAt: file.updated_at,
        dataExists: processingDataCheck,
        sessionDetails: sessionDetails ? {
          status: sessionDetails.status,
          progress: sessionDetails.progress_percentage || 0,
          startTime: sessionDetails.session_start_time,
          endTime: sessionDetails.session_end_time,
          totalProcessingTime: sessionDetails.total_processing_time_ms,
          errorMessage: sessionDetails.error_message
        } : null
      };

      res.status(200).json({
        success: true,
        data: status
      });

    } catch (error) {
      console.error('Get processing status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get processing status'
      });
    }
  }

  async getFileMetadata(req, res) {
    try {
      const userId = req.user.id;
      const { fileId } = req.params;

      const fileResult = await this.fileService.getFileDetails(userId, fileId);
      if (!fileResult.success) {
        return res.status(404).json({
          success: false,
          error: fileResult.error
        });
      }

      const file = fileResult.data;

      if (file.upload_status !== 'processed') {
        return res.status(400).json({
          success: false,
          error: 'File is not processed yet. Please process the file first.',
          currentStatus: file.upload_status
        });
      }

      const metadataQuery = `
        SELECT 
          sm.*,
          gf.filename,
          gf.original_filename,
          gf.file_size,
          gf.checksum
        FROM spatial_metadata sm
        JOIN geotiff_files gf ON sm.file_id = gf.id
        WHERE sm.file_id = $1
      `;

      const metadataResult = await this.fileService.db.executeQuery(metadataQuery, [fileId]);

      if (metadataResult.data.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No metadata found for this file'
        });
      }

      const metadata = metadataResult.data[0];

      res.status(200).json({
        success: true,
        data: {
          fileInfo: {
            id: file.id,
            filename: file.filename,
            originalFilename: file.original_filename,
            fileSize: file.file_size,
            checksum: file.checksum,
            uploadStatus: file.upload_status,
            processedAt: file.processed_at
          },
          spatialMetadata: {
            dimensions: {
              width: metadata.width,
              height: metadata.height,
              bandsCount: metadata.bands_count,
              pixelType: metadata.pixel_type
            },
            spatial: {
              coordinateSystem: metadata.coordinate_system,
              geotransform: metadata.geotransform,
              extent: metadata.extent_geom,
              resolution: {
                x: metadata.resolution_x,
                y: metadata.resolution_y
              }
            },
            bandStatistics: metadata.band_statistics,
            nodataValue: metadata.nodata_value
          }
        }
      });

    } catch (error) {
      console.error('Get file metadata error:', error);
      res.status(500).json({
        success: false,
        error: `Failed to get file metadata: ${error.message}`
      });
    }
  }
}

module.exports = FileController;
