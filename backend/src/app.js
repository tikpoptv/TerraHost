const express = require('express');
const cors = require('cors');
const ApiController = require('./controllers/ApiController');
const HealthController = require('./controllers/HealthController');

class App {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 8000;
    
    this.initializeMiddlewares();
    this.initializeControllers();
  }

  initializeMiddlewares() {
    this.app.use(cors());
    this.app.use(express.json());
  }

  initializeControllers() {
    const apiController = new ApiController();
    const healthController = new HealthController();

    // Register routes
    this.app.use('/', apiController.getRouter());
    this.app.use('/health', healthController.getRouter());
  }

  listen() {
    this.app.listen(this.port, () => {
      console.log(`🚀 TerraHost Backend running on port ${this.port}`);
      console.log(`📍 Health check: http://localhost:${this.port}/health`);
      console.log(`📍 API info: http://localhost:${this.port}/api`);
    });
  }

  getApp() {
    return this.app;
  }
}

module.exports = App;
