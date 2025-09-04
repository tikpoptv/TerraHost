const express = require('express');
const cors = require('cors');
const ApiController = require('./controllers/ApiController');
const HealthController = require('./controllers/HealthController');
const AuthController = require('./controllers/AuthController');
const FileController = require('./controllers/FileController');
const TokenController = require('./controllers/TokenController');
const SpatialController = require('./controllers/SpatialController');

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
    const fileController = new FileController();
    const tokenController = new TokenController();
    const spatialController = new SpatialController();

    // Register routes
    this.app.use('/', apiController.getRouter());
    this.app.use('/health', healthController.getRouter());
    this.app.use('/auth', authController.getRouter());
    this.app.use('/files', fileController.getRouter());
    this.app.use('/tokens', tokenController.getRouter());
    this.app.use('/api/spatial', spatialController.getRouter());
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
      console.log(`📍 File upload: POST http://localhost:${this.port}/files/upload`);
      console.log(`📍 Get files: GET http://localhost:${this.port}/files/files`);
    });
  }

  getApp() {
    return this.app;
  }
}

module.exports = App;
