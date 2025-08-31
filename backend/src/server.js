require('dotenv').config();
const App = require('./app');

// Create and start the application
const app = new App();
app.listen();

// Export for testing
module.exports = app.getApp();
