const BaseController = require('./BaseController');

class HealthController extends BaseController {
  initializeRoutes() {
    this.router.get('/', this.getHealth.bind(this));
  }

  getHealth(req, res) {
    res.json({ status: 'OK' });
  }
}

module.exports = HealthController;
