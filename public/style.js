
const state = {
  zones: {
    1: { moisture: 28, temp: 27, sprinkler: true,  manual: false },
    2: { moisture: 64, temp: 26, sprinkler: false, manual: false }
  },
  moistureHistory: {
    1: [72, 65, 58, 44, 36, 29, 28, 31, 28, 28],
    2: [80, 76, 70, 68, 65, 63, 64, 62, 64, 64]
  },
  tempHistory: [24, 25, 26, 27, 26, 27, 28, 27, 27, 27],
  secondsAgo: 0
};

function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2,'0');
  const m = String(now.getMinutes()).padStart(2,'0');
  const s = String(now.getSeconds()).padStart(2,'0');
  document.getElementById('clock-badge').textContent = `${h}:${m}:${s}`;
}
setInterval(updateClock, 1000);
updateClock();


const chartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 400 },
  plugins: { legend: { display: false }, tooltip: {
    backgroundColor: '#1c2520',
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    titleColor: '#8aa898',
    bodyColor: '#e8f0ec',
    padding: 10,
    titleFont: { family: "'DM Mono', monospace", size: 10 },
    bodyFont: { family: "'DM Mono', monospace", size: 11 }
  }},
  scales: {
    x: {
      grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
      ticks: { color: '#4d6459', font: { family: "'DM Mono', monospace", size: 9 }, maxRotation: 0 }
    },
    y: {
      grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
      ticks: { color: '#4d6459', font: { family: "'DM Mono', monospace", size: 9 }, padding: 6 }
    }
  }
};

const labels = ['R1','R2','R3','R4','R5','R6','R7','R8','R9','R10'];

const moistureChart = new Chart(document.getElementById('chart-moisture'), {
  type: 'line',
  data: {
    labels,
    datasets: [
      {
        label: 'Zone 1',
        data: [...state.moistureHistory[1]],
        borderColor: '#e05050',
        backgroundColor: 'rgba(224,80,80,0.06)',
        borderWidth: 1.5,
        pointRadius: 3,
        pointBackgroundColor: '#e05050',
        fill: true,
        tension: 0.35
      },
      {
        label: 'Zone 2',
        data: [...state.moistureHistory[2]],
        borderColor: '#2adf8e',
        backgroundColor: 'rgba(42,223,142,0.06)',
        borderWidth: 1.5,
        pointRadius: 3,
        pointBackgroundColor: '#2adf8e',
        fill: true,
        tension: 0.35
      },
      {
        label: 'Trigger (30%)',
        data: Array(10).fill(30),
        borderColor: 'rgba(240,165,0,0.4)',
        borderWidth: 1,
        borderDash: [4, 4],
        pointRadius: 0,
        fill: false,
        tension: 0
      }
    ]
  },
  options: {
    ...chartDefaults,
    scales: {
      ...chartDefaults.scales,
      y: { ...chartDefaults.scales.y, min: 0, max: 100,
        ticks: { ...chartDefaults.scales.y.ticks, callback: v => v + '%' } }
    }
  }
});

const tempChart = new Chart(document.getElementById('chart-temp'), {
  type: 'line',
  data: {
    labels,
    datasets: [{
      label: 'Zone 1 temp',
      data: [...state.tempHistory],
      borderColor: '#f0a500',
      backgroundColor: 'rgba(240,165,0,0.07)',
      borderWidth: 1.5,
      pointRadius: 3,
      pointBackgroundColor: '#f0a500',
      fill: true,
      tension: 0.35
    }]
  },
  options: {
    ...chartDefaults,
    scales: {
      ...chartDefaults.scales,
      y: { ...chartDefaults.scales.y, min: 15, max: 45,
        ticks: { ...chartDefaults.scales.y.ticks, callback: v => v + '°' } }
    }
  }
});


async function fetchRealData() {
  try {
    
const [z1Data, z2Data] = await Promise.all([
  fetch('/api/telemetry?zone=zone_1').then(r => r.json()),
  fetch('/api/telemetry?zone=zone_2').then(r => r.json())
]);

    if (z1Data.length > 0) {
        const latest1 = z1Data[0];
        state.zones[1].moisture = latest1.soil_moisture_percent;
        state.zones[1].temp = latest1.temperature_celsius;
        state.zones[1].sprinkler = latest1.is_sprinkler_active;
        
        state.moistureHistory[1].shift();
        state.moistureHistory[1].push(latest1.soil_moisture_percent);
        
        state.tempHistory.shift();
        state.tempHistory.push(latest1.temperature_celsius);
    }

    if (z2Data.length > 0) {
        const latest2 = z2Data[0];
        state.zones[2].moisture = latest2.soil_moisture_percent;
        state.zones[2].temp = latest2.temperature_celsius;
        state.zones[2].sprinkler = latest2.is_sprinkler_active;
        
        state.moistureHistory[2].shift();
        state.moistureHistory[2].push(latest2.soil_moisture_percent);
    }

    state.secondsAgo = 0;
    updateUI(); // This is the frontend team's function that updates the screen
  } catch (error) {
    console.error("Backend offline. Make sure server.js is running!", error);
  }
}


function updateUI() {
  const z1 = state.zones[1];
  const z2 = state.zones[2];

  
  const avgMoisture = Math.round((z1.moisture + z2.moisture) / 2);
  const avgTemp     = Math.round((z1.temp + z2.temp) / 2);
  const activeSprinklers = (z1.sprinkler ? 1 : 0) + (z2.sprinkler ? 1 : 0);

  document.getElementById('val-moisture').innerHTML = avgMoisture + '<span class="unit">%</span>';
  document.getElementById('val-temp').innerHTML     = avgTemp     + '<span class="unit">°C</span>';
  document.getElementById('val-sprinklers').innerHTML = activeSprinklers + '<span class="unit">/2</span>';
  document.getElementById('val-reading').textContent  = 'just now';

  setMetricStatus('m-moisture', 'lbl-moisture',
    avgMoisture < 30 ? ['danger','is-danger','Critically dry'] :
    avgMoisture > 80 ? ['warn','is-warn','Waterlogged'] :
                       ['good','','Optimal range']);

  setMetricStatus('m-temp', 'lbl-temp',
    avgTemp > 35 ? ['danger','is-danger','High heat'] :
    avgTemp < 18 ? ['info','is-info','Cool conditions'] :
                   ['good','','Normal']);

  setMetricStatus('m-sprinklers', 'lbl-sprinklers',
    activeSprinklers === 2 ? ['warn','is-warn','Both zones running'] :
    activeSprinklers === 1 ? ['warn','is-warn', activeSprinklersLabel()] :
                             ['good','','All zones off']);

  
  document.getElementById('z1-meta').textContent = `${z1.moisture}% · ${z1.temp}°C · ${z1.manual ? 'manual' : 'auto'} ${z1.sprinkler ? 'ON' : 'OFF'}`;
  document.getElementById('z2-meta').textContent = `${z2.moisture}% · ${z2.temp}°C · ${z2.manual ? 'manual' : 'auto'} ${z2.sprinkler ? 'ON' : 'OFF'}`;

  
  setToggleBtn('btn-z1', z1.sprinkler);
  setToggleBtn('btn-z2', z2.sprinkler);

  
  updateBar('bar-fill-z1', 'bar-val-z1', z1.moisture);
  updateBar('bar-fill-z2', 'bar-val-z2', z2.moisture);

  
  moistureChart.data.datasets[0].data = [...state.moistureHistory[1]];
  moistureChart.data.datasets[1].data = [...state.moistureHistory[2]];
  moistureChart.update('none');
  tempChart.data.datasets[0].data = [...state.tempHistory];
  tempChart.update('none');

  
  document.getElementById('zones-badge').textContent = activeSprinklers + ' zone' + (activeSprinklers !== 1 ? 's' : '') + ' active';
}

function activeSprinklersLabel() {
  if (state.zones[1].sprinkler) return 'Zone 1 running';
  if (state.zones[2].sprinkler) return 'Zone 2 running';
  return '';
}

function setMetricStatus(cardId, lblId, [type, cardClass, text]) {
  const card = document.getElementById(cardId);
  const lbl  = document.getElementById(lblId);
  const statusEl = card.querySelector('.metric-status');

  
  card.classList.remove('is-danger','is-warn','is-info');
  if (cardClass) card.classList.add(cardClass);

  
  statusEl.className = 'metric-status status-' + type;
  lbl.textContent = text;
}

function setToggleBtn(btnId, isOn) {
  const btn = document.getElementById(btnId);
  btn.textContent = isOn ? 'ON' : 'OFF';
  btn.className = 'toggle-btn ' + (isOn ? 'on' : 'off');
}

function updateBar(fillId, valId, pct) {
  const fill = document.getElementById(fillId);
  const val  = document.getElementById(valId);
  fill.style.width = pct + '%';
  fill.className = 'bar-fill ' + (pct < 30 ? 'danger' : pct < 50 ? 'warn' : 'good');
  val.className = pct < 30 ? 'bar-value-danger' : pct < 50 ? 'bar-value-warn' : 'bar-value-good';
  val.textContent = pct + '%';
}



async function toggleZone(z) {
  const zoneName = `zone_${z}`;
  const currentState = state.zones[z].sprinkler;
  const newState = !currentState; // Flip the switch
  
  try {
      await fetch('/api/sprinkler/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone: zoneName, state: newState })
      });
      
      state.zones[z].manual = true;
      addLog(`Manual override: Zone ${z} forced ${newState ? 'ON' : 'OFF'}`, 'manual');
      showToast(`Zone ${z} forced ${newState ? 'ON' : 'OFF'}`, newState ? 'green' : 'blue');
      
      fetchRealData(); // Immediately grab the new data to update UI
      
      setTimeout(() => { state.zones[z].manual = false; }, 30000);
  } catch(error) {
      showToast("Error connecting to backend", "red");
  }
}


async function injectAnomaly(type) {
  const zoneVal = document.getElementById('anomaly-zone').value;
  const zonesToUpdate = zoneVal === 'all' ? [1, 2] : [parseInt(zoneVal)];

  try {
      for (let z of zonesToUpdate) {
          await fetch('/api/simulate/anomaly', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ zone: `zone_${z}`, type: type })
          });
          
          const zLabel = zoneVal === 'all' ? `All zones` : `Zone ${z}`;
          addLog(`${type.toUpperCase()} injected — ${zLabel}`, 'anomaly');
      }
      
      showToast(`${type.toUpperCase()} scenario injected!`, type === 'drought' ? 'amber' : 'blue');
      fetchRealData(); // Pull the new extreme data from the backend to show on charts
  } catch(error) {
      showToast("Failed to inject anomaly", "red");
  }
}


function addLog(text, tagType) {
  const log  = document.getElementById('activity-log');
  const now  = new Date();
  const time = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');

  const row = document.createElement('div');
  row.className = 'log-row';
  row.innerHTML = `<div class="log-time">${time}</div>
    <div class="log-text">${text}<span class="tag tag-${tagType}">${tagType}</span></div>`;

  log.insertBefore(row, log.firstChild);

  
  while (log.children.length > 8) log.removeChild(log.lastChild);
}


async function refreshWeather() {
  const cityInput = document.querySelector('.location-input').value;
  showToast(`Locating ${cityInput}...`, 'gray');

  try {
    const response = await fetch(`/api/weather?city=${encodeURIComponent(cityInput)}`);
    const data = await response.json();

    if (!response.ok) {
      showToast(data.message || 'Location not found', 'red');
      return;
    }

    
    updateWeatherStats(data.current);

  
    updateForecastCards(data.forecast);


    const banner = document.getElementById('decision-banner');
    const title  = document.getElementById('decision-title');
    const sub    = document.getElementById('decision-sub');

    if (data.rain_probability_percent > 60) {
      banner.className = 'decision-banner hold';
      title.textContent = `Irrigation held — rain expected`;
    } else {
      banner.className = 'decision-banner irrigate';
      title.textContent = `System active — no significant rain`;
    }
    sub.textContent = `${data.system_status} · ${data.rain_probability_percent}% probability`;

    showToast(`Weather updated for ${data.location}`, 'blue');
    addLog(`Location updated to ${data.location}`, 'weather');

  } catch (error) {
    showToast("Weather fetch failed — is the server running?", 'red');
  }
}

function updateWeatherStats(current) {
  
  const stats = document.querySelectorAll('.weather-stat-value');
  
  stats[0].textContent = current.condition;
  stats[1].innerHTML   = `${current.temperature}<span class="unit">°C</span>`;
  stats[2].innerHTML   = `${current.humidity}<span class="unit">%</span>`;
  stats[3].innerHTML   = `${current.rain_probability}<span class="unit">%</span>`;
}

function updateForecastCards(forecast) {
  const cards = document.querySelectorAll('.forecast-card');
  forecast.forEach((day, i) => {
    if (!cards[i]) return;
    cards[i].querySelector('.forecast-day').textContent  = day.day;
    cards[i].querySelector('.forecast-icon').textContent = day.icon;
    cards[i].querySelector('.forecast-temp').textContent = `${day.temp}°`;
    cards[i].querySelector('.forecast-rain').textContent = `${day.rain}%`;
  });
}

function showToast(text, color) {
  const colorMap = {
    green: '#2adf8e', blue: '#4da6f5',
    amber: '#f0a500', gray: '#8aa898', red: '#e05050'
  };

  const container = document.getElementById('toasts');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<div class="toast-dot" style="background:${colorMap[color] || colorMap.gray}"></div>${text}`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = '0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}

setInterval(() => {
  state.secondsAgo++;
  const el = document.getElementById('val-reading');
  if (state.secondsAgo < 60) {
    el.textContent = state.secondsAgo + 's ago';
  } else {
    el.textContent = Math.floor(state.secondsAgo / 60) + 'm ago';
  }
}, 1000);


updateUI();
setInterval(fetchRealData, 5000);
