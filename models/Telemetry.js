const mongoose = require('mongoose');

const telemetrySchema = mongoose.Schema({
  sensor_id: String,
  soil_moisture_percent: Number,
  temperature_celsius: Number,
  is_sprinkler_active: Boolean,
  source: { 
    type: String, 
    default: 'auto_generated' 
  },
  timestamp: { type: Date, default: Date.now }
});

const Telemetry = mongoose.model('Telemetry', telemetrySchema);
module.exports = Telemetry;