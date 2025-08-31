const BaseController = require('./BaseController');

class ApiController extends BaseController {
  initializeRoutes() {
    this.router.get('/', this.getWelcome.bind(this));
    this.router.get('/api', this.getApiInfo.bind(this));
  }

  getWelcome(req, res) {
    res.json({
      message: 'Welcome to TerraHost API',
      version: '1.0.0'
    });
  }

  getApiInfo(req, res) {
    res.json({
      name: 'TerraHost API',
      version: '1.0.0',
      description: 'Geospatial data processing and management',
      endpoints: {
        health: '/health',
        api: '/api'
      }
    });
  }
}

module.exports = ApiController;
