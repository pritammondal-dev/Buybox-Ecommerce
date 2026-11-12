const mongoose = require("mongoose");

// After each test suite finishes, ensure database connection is closed and garbage collected
afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (global.gc) {
    global.gc();
  }
});

