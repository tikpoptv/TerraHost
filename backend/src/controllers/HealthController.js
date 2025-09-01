const BaseController = require('./BaseController');
const DatabaseService = require('../services/DatabaseService');

class HealthController extends BaseController {
  initializeRoutes() {
    this.router.get('/', this.getHealth.bind(this));
    this.router.get('/database', this.getDatabaseHealth.bind(this));
  }

  getHealth(req, res) {
    res.json({ status: 'OK' });
  }

  async getDatabaseHealth(req, res) {
    try {
      const connectionTest = await DatabaseService.testConnection();

      if (!connectionTest.success) {
        return res.status(503).json({
          status: 'ERROR',
          database: 'disconnected'
        });
      }

      res.json({
        status: 'OK',
        database: 'connected'
      });
    } catch (error) {
      res.status(500).json({
        status: 'ERROR',
        database: 'error'
      });
    }
  }
}

module.exports = HealthController;
