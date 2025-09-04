const BaseController = require('./BaseController');
const ApiKeyMiddleware = require('../middleware/apiKeyMiddleware');
const SpatialService = require('../services/SpatialService');

class SpatialController extends BaseController {
  constructor() {
    super();
    this.spatialService = new SpatialService();
  }

  initializeRoutes() {
    // Query ข้อมูลตามพิกัด (ต้องมี API key)
    this.router.get('/query', 
      ApiKeyMiddleware.verifyApiKey.bind(ApiKeyMiddleware),
      this.queryByCoordinates.bind(this)
    );

    // Query ข้อมูลทั้งหมดในพื้นที่ (ต้องมี API key)
    this.router.get('/query-all', 
      ApiKeyMiddleware.verifyApiKey.bind(ApiKeyMiddleware),
      this.queryAllDataInArea.bind(this)
    );

    // Query ข้อมูลในพื้นที่ (ต้องมี API key + permission)
    this.router.get('/area', 
      ApiKeyMiddleware.verifyApiKey.bind(ApiKeyMiddleware),
      ApiKeyMiddleware.requirePermission('query:spatial'),
      this.queryByArea.bind(this)
    );

    // Get spatial metadata ของไฟล์ (ต้องมี API key + permission)
    this.router.get('/files/:fileId/metadata', 
      ApiKeyMiddleware.verifyApiKey.bind(ApiKeyMiddleware),
      ApiKeyMiddleware.requirePermission('read:metadata'),
      this.getFileSpatialMetadata.bind(this)
    );

    // Search files ในพื้นที่ (ต้องมี API key + permission)
    this.router.get('/files/search', 
      ApiKeyMiddleware.verifyApiKey.bind(ApiKeyMiddleware),
      ApiKeyMiddleware.requirePermission('read:files'),
      this.searchFilesInArea.bind(this)
    );

    // Time series analysis (ต้องมี API key + permission)
    this.router.get('/timeseries', 
      ApiKeyMiddleware.verifyApiKey.bind(ApiKeyMiddleware),
      ApiKeyMiddleware.requirePermission('query:spatial'),
      this.getTimeSeriesData.bind(this)
    );

    // File overview - เช็คข้อมูลไฟล์ทั้งหมด (ต้องมี API key + permission)
    this.router.get('/overview', 
      ApiKeyMiddleware.verifyApiKey.bind(ApiKeyMiddleware),
      ApiKeyMiddleware.requirePermission('read:files'),
      this.getFileOverview.bind(this)
    );
  }

  /**
   * Query ข้อมูลตามพิกัด (lat, lng)
   */
  async queryByCoordinates(req, res) {
    try {
      const { lat, lng } = req.query;
      const apiUser = req.apiUser;

      // ตรวจสอบ parameters
      if (!lat || !lng) {
        return res.status(400).json({
          success: false,
          error: 'Latitude (lat) and longitude (lng) are required'
        });
      }

      // แปลงเป็นตัวเลข
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);

      if (isNaN(latitude) || isNaN(longitude)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid latitude or longitude values'
        });
      }

      // ตรวจสอบพิกัด
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return res.status(400).json({
          success: false,
          error: 'Latitude must be between -90 and 90, longitude must be between -180 and 180'
        });
      }

      console.log(`🗺️ Spatial query for coordinates: ${latitude}, ${longitude} by user: ${apiUser.userName}`);

      // Query ข้อมูลจาก database
      const result = await this.spatialService.queryByCoordinates(latitude, longitude);

      if (result.success) {
        // ใช้ response format ใหม่จาก SpatialService
        const responseData = {
          success: true,
          ...result, // รวม message, coordinates, suggestion จาก service
          queryTime: new Date().toISOString(),
          userInfo: {
            userId: apiUser.userId,
            userName: apiUser.userName,
            permissions: apiUser.permissions
          }
        };
        
        res.status(200).json(responseData);
      } else {
        res.status(500).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Spatial query error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to query spatial data'
      });
    }
  }

  /**
   * Query ข้อมูลทั้งหมดในพื้นที่ (ระบุพิกัดแล้วได้ข้อมูลทั้งหมด)
   * รองรับการฟิลเตอร์ตามวันที่สำหรับ time series analysis
   */
  async queryAllDataInArea(req, res) {
    try {
      const { lat, lng, radius = 5, startDate, endDate } = req.query; // default radius 5km
      const apiUser = req.apiUser;

      // ตรวจสอบ parameters
      if (!lat || !lng) {
        return res.status(400).json({
          success: false,
          error: 'Latitude (lat) and longitude (lng) are required'
        });
      }

      // แปลงเป็นตัวเลข
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);
      const radiusKm = parseFloat(radius);

      if (isNaN(latitude) || isNaN(longitude) || isNaN(radiusKm)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid latitude, longitude, or radius values'
        });
      }

      // ตรวจสอบพิกัด
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return res.status(400).json({
          success: false,
          error: 'Latitude must be between -90 and 90, longitude must be between -180 and 180'
        });
      }

      console.log(`🗺️ Querying ALL data in area: center(${latitude}, ${longitude}), radius: ${radiusKm}km by user: ${apiUser.userName}`);

      // สร้าง date filter ถ้ามี
      let dateFilter = null;
      if (startDate || endDate) {
        dateFilter = {};
        if (startDate) dateFilter.startDate = startDate;
        if (endDate) dateFilter.endDate = endDate;
        console.log(`📅 Date filter: ${startDate || 'no start'} to ${endDate || 'no end'}`);
      }

      // Query ข้อมูลทั้งหมดในพื้นที่
      const result = await this.spatialService.queryAllDataInArea(latitude, longitude, radiusKm, dateFilter);

      if (result.success) {
        res.status(200).json({
          success: true,
          ...result, // รวม message, data, summary จาก service
          queryTime: new Date().toISOString(),
          queryParams: {
            center: { lat: latitude, lng: longitude },
            radius: radiusKm
          },
          userInfo: {
            userId: apiUser.userId,
            userName: apiUser.userName,
            permissions: apiUser.permissions
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Query all data error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to query all data in area'
      });
    }
  }

  /**
   * Query ข้อมูลในพื้นที่ (polygon หรือ radius)
   */
  async queryByArea(req, res) {
    try {
      const { polygon, centerLat, centerLng, radius } = req.query;
      const apiUser = req.apiUser;

      console.log(`🗺️ Area query by user: ${apiUser.userName}`);

      let result;
      if (polygon) {
        // Query ด้วย polygon
        result = await this.spatialService.queryByPolygon(polygon);
      } else if (centerLat && centerLng && radius) {
        // Query ด้วย circle (center + radius)
        const centerLatNum = parseFloat(centerLat);
        const centerLngNum = parseFloat(centerLng);
        const radiusNum = parseFloat(radius);
        
        result = await this.spatialService.queryByCircle(centerLatNum, centerLngNum, radiusNum);
      } else {
        return res.status(400).json({
          success: false,
          error: 'Either polygon or centerLat+centerLng+radius are required'
        });
      }

      if (result.success) {
        // ใช้ response format ใหม่จาก SpatialService
        const responseData = {
          success: true,
          ...result, // รวม message, area, suggestion จาก service
          queryTime: new Date().toISOString()
        };
        
        res.status(200).json(responseData);
      } else {
        res.status(500).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Area query error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to query area data'
      });
    }
  }

  /**
   * Get spatial metadata ของไฟล์
   */
  async getFileSpatialMetadata(req, res) {
    try {
      const { fileId } = req.params;
      const apiUser = req.apiUser;

      console.log(`🗺️ Getting spatial metadata for file: ${fileId} by user: ${apiUser.userName}`);

      const result = await this.spatialService.getFileSpatialMetadata(fileId);

      if (result.success) {
        res.status(200).json({
          success: true,
          data: result.data
        });
      } else {
        res.status(404).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Get file metadata error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get file metadata'
      });
    }
  }

  /**
   * Search files ในพื้นที่
   */
  async searchFilesInArea(req, res) {
    try {
      const { bbox, timeRange, fileTypes } = req.query;
      const apiUser = req.apiUser;

      console.log(`🗺️ Searching files in area by user: ${apiUser.userName}`);

      const result = await this.spatialService.searchFilesInArea({
        bbox,
        timeRange,
        fileTypes,
        userId: apiUser.userId
      });

      if (result.success) {
        // ใช้ response format ใหม่จาก SpatialService
        const responseData = {
          success: true,
          ...result, // รวม message, filters, suggestion จาก service
          queryTime: new Date().toISOString()
        };
        
        res.status(200).json(responseData);
      } else {
        res.status(500).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Search files error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to search files'
      });
    }
  }

  /**
   * Time series analysis - วิเคราะห์ข้อมูลตามเวลา
   */
  async getTimeSeriesData(req, res) {
    try {
      const { lat, lng, radius = 5, startDate, endDate, analysisType = 'all' } = req.query;
      const apiUser = req.apiUser;

      // ตรวจสอบ parameters
      if (!lat || !lng) {
        return res.status(400).json({
          success: false,
          error: 'Latitude (lat) and longitude (lng) are required'
        });
      }

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'Start date (startDate) and end date (endDate) are required for time series analysis'
        });
      }

      // แปลงเป็นตัวเลข
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);
      const radiusKm = parseFloat(radius);

      if (isNaN(latitude) || isNaN(longitude) || isNaN(radiusKm)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid latitude, longitude, or radius values'
        });
      }

      // ตรวจสอบพิกัด
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return res.status(400).json({
          success: false,
          error: 'Latitude must be between -90 and 90, longitude must be between -180 and 180'
        });
      }

      // ตรวจสอบวันที่
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date format. Use YYYY-MM-DD format'
        });
      }

      if (start > end) {
        return res.status(400).json({
          success: false,
          error: 'Start date must be before end date'
        });
      }

      console.log(`📊 Time series analysis: center(${latitude}, ${longitude}), radius: ${radiusKm}km, period: ${startDate} to ${endDate} by user: ${apiUser.userName}`);

      // สร้าง date filter
      const dateFilter = {
        startDate: startDate,
        endDate: endDate
      };

      // Query ข้อมูลทั้งหมดในพื้นที่และช่วงเวลา
      const result = await this.spatialService.queryAllDataInArea(latitude, longitude, radiusKm, dateFilter);

      if (result.success) {
        // สร้าง time series analysis
        const timeSeriesAnalysis = this.createTimeSeriesAnalysis(result.data, analysisType);

        res.status(200).json({
          success: true,
          ...result, // รวม message, data, summary, timeSeriesSummary จาก service
          analysis: {
            type: analysisType,
            timeSeriesAnalysis: timeSeriesAnalysis
          },
          queryTime: new Date().toISOString(),
          queryParams: {
            center: { lat: latitude, lng: longitude },
            radius: radiusKm,
            dateRange: { startDate, endDate }
          },
          userInfo: {
            userId: apiUser.userId,
            userName: apiUser.userName,
            permissions: apiUser.permissions
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Time series analysis error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to perform time series analysis'
      });
    }
  }

  /**
   * สร้าง time series analysis
   */
  createTimeSeriesAnalysis(files, analysisType) {
    const analysis = {
      type: analysisType,
      temporalTrends: {
        fileCountByDate: {},
        averageFileSizeByDate: {},
        processingTimeByDate: {}
      },
      spatialTrends: {
        coverageByDate: {},
        resolutionByDate: {}
      },
      qualityTrends: {
        qualityScoreByDate: {},
        completenessByDate: {}
      },
      recommendations: []
    };

    // จัดกลุ่มข้อมูลตามวันที่
    files.forEach(file => {
      if (file.acquisitionDate) {
        const dateStr = file.acquisitionDate;
        
        // File count by date
        if (!analysis.temporalTrends.fileCountByDate[dateStr]) {
          analysis.temporalTrends.fileCountByDate[dateStr] = 0;
        }
        analysis.temporalTrends.fileCountByDate[dateStr]++;

        // Average file size by date
        if (!analysis.temporalTrends.averageFileSizeByDate[dateStr]) {
          analysis.temporalTrends.averageFileSizeByDate[dateStr] = {
            totalSize: 0,
            count: 0
          };
        }
        analysis.temporalTrends.averageFileSizeByDate[dateStr].totalSize += file.fileSize;
        analysis.temporalTrends.averageFileSizeByDate[dateStr].count++;

        // Processing time by date
        if (file.processing && file.processing.processingTime) {
          if (!analysis.temporalTrends.processingTimeByDate[dateStr]) {
            analysis.temporalTrends.processingTimeByDate[dateStr] = {
              totalTime: 0,
              count: 0
            };
          }
          analysis.temporalTrends.processingTimeByDate[dateStr].totalTime += file.processing.processingTime;
          analysis.temporalTrends.processingTimeByDate[dateStr].count++;
        }
      }
    });

    // คำนวณค่าเฉลี่ย
    Object.keys(analysis.temporalTrends.averageFileSizeByDate).forEach(date => {
      const data = analysis.temporalTrends.averageFileSizeByDate[date];
      analysis.temporalTrends.averageFileSizeByDate[date] = Math.round(data.totalSize / data.count);
    });

    Object.keys(analysis.temporalTrends.processingTimeByDate).forEach(date => {
      const data = analysis.temporalTrends.processingTimeByDate[date];
      analysis.temporalTrends.processingTimeByDate[date] = Math.round(data.totalTime / data.count);
    });

    // สร้างคำแนะนำ
    const totalFiles = files.length;
    const uniqueDates = Object.keys(analysis.temporalTrends.fileCountByDate).length;
    
    if (totalFiles > 0 && uniqueDates > 0) {
      const avgFilesPerDate = totalFiles / uniqueDates;
      
      if (avgFilesPerDate < 1) {
        analysis.recommendations.push('Consider collecting more data for better temporal coverage');
      }
      
      if (uniqueDates < 10) {
        analysis.recommendations.push('Limited temporal coverage - consider extending date range');
      }
      
      analysis.recommendations.push(`Good temporal coverage: ${avgFilesPerDate.toFixed(1)} files per date on average`);
    }

    return analysis;
  }

  /**
   * File overview - เช็คข้อมูลไฟล์ทั้งหมด
   */
  async getFileOverview(req, res) {
    try {
      const apiUser = req.apiUser;
      
      console.log(`📊 File overview request by user: ${apiUser.userName}`);

      // เรียกใช้ service เพื่อดึงข้อมูล overview
      const result = await this.spatialService.getFileOverview();

      if (result.success) {
        res.status(200).json({
          success: true,
          ...result,
          queryTime: new Date().toISOString(),
          userInfo: {
            userId: apiUser.userId,
            userName: apiUser.userName,
            permissions: apiUser.permissions
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('File overview error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get file overview'
      });
    }
  }
}

module.exports = SpatialController;
