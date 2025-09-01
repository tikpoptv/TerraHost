const express = require('express');
const cors = require('cors');
const ApiController = require('./controllers/ApiController');
const HealthController = require('./controllers/HealthController');
const AuthController = require('./controllers/AuthController');

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
    const authController = new AuthController();

    // Register routes
    this.app.use('/', apiController.getRouter());
    this.app.use('/health', healthController.getRouter());
    this.app.use('/auth', authController.getRouter());
  }

  listen() {
    this.app.listen(this.port, () => {
      console.log(`🚀 TerraHost Backend running on port ${this.port}`);
              console.log(`📍 Health check: http://localhost:${this.port}/health`);
        console.log(`📍 API info: http://localhost:${this.port}/api`);
        console.log(`📍 Register: POST http://localhost:${this.port}/auth/register`);
        console.log(`📍 Login: POST http://localhost:${this.port}/auth/login`);
        console.log(`📍 Auth Status: GET http://localhost:${this.port}/auth/status`);
        console.log(`📍 Logout: POST http://localhost:${this.port}/auth/logout`);
    });
  }

  getApp() {
    return this.app;
  }
}

module.exports = App;
