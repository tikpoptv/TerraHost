const express = require('express');

class BaseController {
  constructor() {
    this.router = express.Router();
    this.initializeRoutes();
  }

  initializeRoutes() {
    // Override in child classes
  }

  getRouter() {
    return this.router;
  }

  // Helper method for success responses
  sendSuccess(res, data, message = 'Success', statusCode = 200) {
    res.status(statusCode).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    });
  }

  // Helper method for error responses
  sendError(res, message = 'Internal Server Error', statusCode = 500, error = null) {
    res.status(statusCode).json({
      success: false,
      message,
      error: error?.message || null,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = BaseController;
