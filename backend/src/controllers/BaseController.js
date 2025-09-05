const express = require('express');

class BaseController {
  constructor() {
    this.router = express.Router();
    this.initializeRoutes();
  }

  initializeRoutes() {}

  getRouter() {
    return this.router;
  }

  sendSuccess(res, data, message = 'Success', statusCode = 200) {
    res.status(statusCode).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    });
  }

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
