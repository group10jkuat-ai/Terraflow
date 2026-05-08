require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const cors = require('cors');
const Telemetry = require('./models/Telemetry');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));


app.use(cors());
app.use(express.json());
const zones = ["zone_1", "zone_2"]; 

let systemWeather = {
  location: "Juja",
  rain_probability: 0 
};


mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB Atlas!');
    startDataGenerator ();
  })
  .catch((err) => console.error('Database connection error:', err));


  function startDataGenerator () {

const interval = setInterval(async () => {
  for (const zone of zones) {
    const randomMoisture = Math.floor(Math.random() * (90 - 10 + 1)) + 10;
    const randomTemp = Math.floor(Math.random() * (35 - 20 + 1)) + 20;

    let sprinklerState = false;


if (randomMoisture < 30) {
  
  if (systemWeather.rain_probability > 60) {
  sprinklerState = false;
  sourceTag = 'weather_hold';  
} else {
  sprinklerState = true;
  sourceTag = 'auto_generated';
}
}                     

    try {
      await Telemetry.create({
        sensor_id: zone,
        soil_moisture_percent: randomMoisture,
        temperature_celsius: randomTemp,
        is_sprinkler_active: sprinklerState
      });
      console.log(`[${zone}] Moisture: ${randomMoisture}%, Temp: ${randomTemp}°C, Sprinkler: ${sprinklerState ? 'ON' : 'OFF'}`);
    } catch (error) {
      console.log(`Error saving data for ${zone}:`, error.message);
    }
  }
}, 5000);

process.on('SIGINT', async () => {
  clearInterval(interval);
  await mongoose.connection.close();
  console.log('Server shut down gracefully.');
  process.exit(0);
});
  }


app.get('/api/telemetry', async (req, res) => {
  try {
    const filter = req.query.zone ? { sensor_id: req.query.zone } : {};
    const data = await Telemetry.find(filter).sort({ timestamp: -1 }).limit(10);
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
});


app.get('/api/weather', async (req, res) => {
  const cityName = req.query.city || systemWeather.location;

  try {
    
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${cityName}&count=1`;
    const geoResponse = await fetch(geoUrl);
    const geoData = await geoResponse.json();

    if (!geoData.results || geoData.results.length === 0) {
      return res.status(404).json({ message: `Could not find location: ${cityName}` });
    }

    const lat = geoData.results[0].latitude;
    const long = geoData.results[0].longitude;

    
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${long}&current=temperature_2m,relative_humidity_2m,precipitation_probability,weathercode&daily=temperature_2m_max,precipitation_probability_max,weathercode&timezone=Africa%2FNairobi&forecast_days=5`;

    const weatherResponse = await fetch(weatherUrl);
    const weatherData = await weatherResponse.json();

    
    const currentTemp      = Math.round(weatherData.current.temperature_2m);
    const currentHumidity  = weatherData.current.relative_humidity_2m;
    const currentRainChance= weatherData.current.precipitation_probability;
    const currentCode      = weatherData.current.weathercode;

    
    const forecastDays     = weatherData.daily.time;                         
    const forecastTemps    = weatherData.daily.temperature_2m_max;           
    const forecastRain     = weatherData.daily.precipitation_probability_max;
    const forecastCodes    = weatherData.daily.weathercode;                  

    
    const tomorrowRain = forecastRain[1];
    systemWeather.location = cityName;
    systemWeather.rain_probability = tomorrowRain;

    res.json({
      message: `Weather data updated for ${cityName}`,
      location: cityName,
      coordinates: { lat, long },

      
      current: {
        temperature: currentTemp,
        humidity: currentHumidity,
        rain_probability: currentRainChance,
        condition: getConditionLabel(currentCode)
      },

      
      forecast: forecastDays.map((date, i) => ({
        date,
        day: getDayLabel(date, i),
        temp: Math.round(forecastTemps[i]),
        rain: forecastRain[i],
        icon: getWeatherIcon(forecastCodes[i])
      })),

      
      rain_probability_percent: tomorrowRain,
      system_status: tomorrowRain > 60
        ? "Rain expected. Sprinklers paused."
        : "No significant rain. Relying on soil sensors."
    });

  } catch (error) {
    res.status(500).json({ message: "Failed to fetch weather APIs", error: error.message });
  }
});

// ── Weather code helpers ──
// Open-Meteo uses WMO weather codes — map them to readable labels and emojis
function getConditionLabel(code) {
  if (code === 0)           return 'Clear sky';
  if (code <= 2)            return 'Partly cloudy';
  if (code === 3)           return 'Overcast';
  if (code <= 49)           return 'Foggy';
  if (code <= 59)           return 'Drizzle';
  if (code <= 69)           return 'Rain';
  if (code <= 79)           return 'Snow';
  if (code <= 84)           return 'Rain showers';
  if (code <= 99)           return 'Thunderstorm';
  return 'Unknown';
}

function getWeatherIcon(code) {
  if (code === 0)           return '☀️';
  if (code <= 2)            return '⛅';
  if (code === 3)           return '☁️';
  if (code <= 49)           return '🌫️';
  if (code <= 59)           return '🌦️';
  if (code <= 69)           return '🌧️';
  if (code <= 79)           return '❄️';
  if (code <= 84)           return '🌦️';
  if (code <= 99)           return '⛈️';
  return '🌡️';
}

function getDayLabel(dateStr, index) {
  if (index === 0) return 'Today';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', { weekday: 'short' }); 
}

app.post('/api/sprinkler/override', async (req, res) => {
  const { zone, state } = req.body;


  if (!zone || typeof state !== 'boolean') {
    return res.status(400).json({ 
      message: "Invalid request. Provide a zone (string) and state (true/false)." 
    });
  }

 
  if (!zones.includes(zone)) {
    return res.status(404).json({ 
      message: `Zone "${zone}" not found. Available zones: ${zones.join(', ')}` 
    });
  }

  try {
    const lastReading = await Telemetry.findOne({ sensor_id: zone }).sort({ timestamp: -1 });

    const overrideRecord = await Telemetry.create({
      sensor_id: zone,
      soil_moisture_percent: lastReading?.soil_moisture_percent ?? 50,
      temperature_celsius: lastReading?.temperature_celsius ?? 25,
      is_sprinkler_active: state,  
      source: 'manual_override'    
    });

    res.status(201).json({
      message: `Sprinkler for ${zone} manually set to ${state ? 'ON' : 'OFF'}.`,
      record: overrideRecord
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

app.post('/api/simulate/anomaly', async (req, res) => {
  const { zone, type } = req.body;

  if (!zone || !type) {
    return res.status(400).json({ 
      message: "Invalid request. Provide a zone (string) and type ('drought' or 'flood')." 
    });
  }

  if (!zones.includes(zone)) {
    return res.status(404).json({ 
      message: `Zone "${zone}" not found. Available zones: ${zones.join(', ')}` 
    });
  }

  
  const anomalyProfiles = {
    drought: {
      soil_moisture_percent: 5,   
      temperature_celsius: 42,    
      is_sprinkler_active: true,  
    },
    flood: {
      soil_moisture_percent: 95,  
      temperature_celsius: 18,    
      is_sprinkler_active: false, 
    }
  };

  const profile = anomalyProfiles[type];
  if (!profile) {
    return res.status(400).json({ 
      message: "Unknown anomaly type. Use 'drought' or 'flood'." 
    });
  }

  try {
    const anomalyRecord = await Telemetry.create({
      sensor_id: zone,
      ...profile,
      source: `anomaly_${type}`  // flags this record as a simulated anomaly
    });

    res.status(201).json({
      message: `${type.toUpperCase()} scenario injected into ${zone}.`,
      record: anomalyRecord
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// Start Server
const PORT = process.env.PORT || 5000;
app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Terraflow backend running on port ${PORT}`);
});