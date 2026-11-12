const mongoose = require("mongoose");

// After each test suite finishes, ensure database connection is closed, model cache cleared, and garbage collected
afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  // Clear registered models to release schema ASTs and compiled models from memory
  if (mongoose.models) {
    for (const key of Object.keys(mongoose.models)) {
      delete mongoose.models[key];
    }
  }
  if (mongoose.modelSchemas) {
    for (const key of Object.keys(mongoose.modelSchemas)) {
      delete mongoose.modelSchemas[key];
    }
  }
  if (global.gc) {
    global.gc();
  }
});

