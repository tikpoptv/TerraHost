const BaseController = require('./BaseController');
const StatsService = require('../services/StatsService');
const AuthMiddleware = require('../middleware/authMiddleware');

class StatsController extends BaseController {
  constructor() {
    super();
    this.statsService = new StatsService();
    this.initializeRoutes();
  }

  initializeRoutes() {
    this.router.get('/dashboard', AuthMiddleware.verifyToken, this.getDashboardStats.bind(this));
    
    this.router.get('/files', AuthMiddleware.verifyToken, this.getFileStats.bind(this));
    
    this.router.get('/processing', AuthMiddleware.verifyToken, this.getProcessingStats.bind(this));
    
    this.router.get('/storage', AuthMiddleware.verifyToken, this.getStorageStats.bind(this));
    
    this.router.get('/extraction', AuthMiddleware.verifyToken, this.getExtractionStats.bind(this));
    
    this.router.get('/files/detailed', AuthMiddleware.verifyToken, this.getDetailedFileStats.bind(this));
    
    this.router.get('/processing/detailed', AuthMiddleware.verifyToken, this.getDetailedProcessingStats.bind(this));
    
    this.router.get('/storage/usage-over-time', AuthMiddleware.verifyToken, this.getStorageUsageOverTime.bind(this));
  }

  async getDashboardStats(req, res) {
    try {
      const userId = req.user.id;
      const stats = await this.statsService.getDashboardStats(userId);
      
      this.sendSuccess(res, stats, 'Dashboard statistics retrieved successfully');
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      this.sendError(res, 'Failed to retrieve dashboard statistics', 500);
    }
  }

  async getFileStats(req, res) {
    try {
      const userId = req.user.id;
      const stats = await this.statsService.getFileStats(userId);
      
      this.sendSuccess(res, stats, 'File statistics retrieved successfully');
    } catch (error) {
      console.error('Error getting file stats:', error);
      this.sendError(res, 'Failed to retrieve file statistics', 500);
    }
  }

  async getProcessingStats(req, res) {
    try {
      const userId = req.user.id;
      const stats = await this.statsService.getProcessingStats(userId);
      
      this.sendSuccess(res, stats, 'Processing statistics retrieved successfully');
    } catch (error) {
      console.error('Error getting processing stats:', error);
      this.sendError(res, 'Failed to retrieve processing statistics', 500);
    }
  }

  async getStorageStats(req, res) {
    try {
      const userId = req.user.id;
      const stats = await this.statsService.getStorageStats(userId);
      
      this.sendSuccess(res, stats, 'Storage statistics retrieved successfully');
    } catch (error) {
      console.error('Error getting storage stats:', error);
      this.sendError(res, 'Failed to retrieve storage statistics', 500);
    }
  }

  async getExtractionStats(req, res) {
    try {
      const userId = req.user.id;
      const stats = await this.statsService.getExtractionStats(userId);
      
      this.sendSuccess(res, stats, 'Extraction statistics retrieved successfully');
    } catch (error) {
      console.error('Error getting extraction stats:', error);
      this.sendError(res, 'Failed to retrieve extraction statistics', 500);
    }
  }

  async getDetailedFileStats(req, res) {
    try {
      const userId = req.user.id;
      const stats = await this.statsService.getDetailedFileStats(userId);
      
      this.sendSuccess(res, stats, 'Detailed file statistics retrieved successfully');
    } catch (error) {
      console.error('Error getting detailed file stats:', error);
      this.sendError(res, 'Failed to retrieve detailed file statistics', 500);
    }
  }

  async getDetailedProcessingStats(req, res) {
    try {
      const userId = req.user.id;
      const stats = await this.statsService.getDetailedProcessingStats(userId);
      
      this.sendSuccess(res, stats, 'Detailed processing statistics retrieved successfully');
    } catch (error) {
      console.error('Error getting detailed processing stats:', error);
      this.sendError(res, 'Failed to retrieve detailed processing statistics', 500);
    }
  }

  async getStorageUsageOverTime(req, res) {
    try {
      const userId = req.user.id;
      const days = parseInt(req.query.days) || 30;
      
      const stats = await this.statsService.getStorageUsageOverTime(userId, days);
      
      this.sendSuccess(res, stats, 'Storage usage over time retrieved successfully');
    } catch (error) {
      console.error('Error getting storage usage over time:', error);
      this.sendError(res, 'Failed to retrieve storage usage over time', 500);
    }
  }
}

module.exports = StatsController;
