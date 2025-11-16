
const API_KEY = "645a5c977e84a66af079f767eaa3f584"; 

// Elements (same as before)
const cityInput = document.getElementById("cityInput");
const searchBtn = document.getElementById("searchBtn");
const locBtn = document.getElementById("locBtn");
const unitToggle = document.getElementById("unitToggle");
const themeToggle = document.getElementById("themeToggle");

const placeEl = document.getElementById("place");
const timeLocalEl = document.getElementById("timeLocal");
const tempEl = document.getElementById("temp");
const descEl = document.getElementById("desc");
const iconLarge = document.getElementById("iconLarge");
const feelsEl = document.getElementById("feels");
const humEl = document.getElementById("hum");
const windEl = document.getElementById("wind");
const pressureEl = document.getElementById("pressure");
const sunriseEl = document.getElementById("sunrise");
const sunsetEl = document.getElementById("sunset");
const forecastEl = document.getElementById("forecast");
const weatherCard = document.getElementById("weatherCard");
const errorEl = document.getElementById("error");

const scene = document.getElementById("scene");
const sun = document.getElementById("sun");
const rainLayer = document.getElementById("rainLayer");

let isCelsius = true;
let currentCity = "";


function formatLocal(unixSec, tzOffsetSec = 0, opts = { hour: '2-digit', minute: '2-digit', hour12: true }) {
  const adjustedMs = (unixSec + (tzOffsetSec || 0)) * 1000;
  const d = new Date(adjustedMs);

  return d.toLocaleTimeString([], Object.assign({}, opts, { timeZone: 'UTC' }));
}


function formatLocalDateTime(unixSec, tzOffsetSec = 0) {
  const adjustedMs = (unixSec + (tzOffsetSec || 0)) * 1000;
  const d = new Date(adjustedMs);
  return d.toLocaleString([], { hour: '2-digit', minute: '2-digit', weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC', hour12: true });
}

function showError(msg){
  errorEl.textContent = msg;
  errorEl.classList.remove("hidden");
  setTimeout(()=> errorEl.classList.add("hidden"), 4200);
}
function clearError(){
  errorEl.textContent = "";
  errorEl.classList.add("hidden");
}

function weatherVisuals(main){
  main = (main || '').toLowerCase();
  let icon="☀️", mode="clear";
  if(main.includes("cloud")){ icon="☁️"; mode="clouds"; }
  else if(main.includes("rain")||main.includes("drizzle")){ icon="🌧️"; mode="rain"; }
  else if(main.includes("thunder")){ icon="⛈️"; mode="thunder"; }
  else if(main.includes("snow")){ icon="❄️"; mode="snow"; }
  else if(main.includes("mist")||main.includes("fog")){ icon="🌫️"; mode="clouds"; }
  return {icon, mode};
}

function setScene(mode, isDay) {

  if(isDay === false) {
    document.body.classList.add('dark');
  } else if(isDay === true) {
    document.body.classList.remove('dark');
  }
  rainLayer.style.opacity = (mode === 'rain' ? 0.92 : 0);
  sun.style.opacity = (mode === 'rain' ? 0.18 : (mode === 'clouds' ? 0.48 : 1));
}


function groupForecastByDay(list){
  const days = {};
  list.forEach(item=>{
    const date = new Date(item.dt * 1000);
    const key = date.toISOString().slice(0,10); 
    if(!days[key]) days[key] = [];
    days[key].push(item);
  });
  const ordered = Object.keys(days).sort().map(k => {
    const entries = days[k];
    const min = Math.min(...entries.map(e => e.main.temp_min));
    const max = Math.max(...entries.map(e => e.main.temp_max));
    const midday = entries.reduce((p,c) => {
      const targetHour = 12;
      const prevDiff = Math.abs(new Date(p.dt*1000).getHours() - targetHour);
      const curDiff = Math.abs(new Date(c.dt*1000).getHours() - targetHour);
      return curDiff < prevDiff ? c : p;
    }, entries[0]);
    return { date: k, min: Math.round(min), max: Math.round(max), icon: midday.weather[0].icon, main: midday.weather[0].main };
  });
  return ordered;
}

function renderForecastCards(dailyArray){
  forecastEl.innerHTML = "";
  const nowKey = new Date().toISOString().slice(0,10);
  const filtered = dailyArray.filter(d => d.date !== nowKey).slice(0,5);
  filtered.forEach(d => {
    const dayName = new Date(d.date).toLocaleDateString(undefined,{ weekday:'short' });
    const iconUrl = `https://openweathermap.org/img/wn/${d.icon}@2x.png`;
    const card = document.createElement('div');
    card.className = 'fcard';
    card.innerHTML = `<div class="day">${dayName}</div>
                      <img src="${iconUrl}" alt="" class="ficon"/>
                      <div class="temp-range">${d.max}° / ${d.min}°</div>`;
    forecastEl.appendChild(card);
  });
}


function populateUI(current, forecastGrouped){

  const tzOffset = current.timezone || 0;

  placeEl.textContent = `${current.name}, ${current.sys.country || ""}`;
  timeLocalEl.textContent = formatLocalDateTime(current.dt, tzOffset);

  const unitSuffix = isCelsius ? "°C" : "°F";
  tempEl.textContent = `${Math.round(current.main.temp)}${unitSuffix}`;
  descEl.textContent = current.weather[0].description;
  feelsEl.textContent = `${Math.round(current.main.feels_like)}${unitSuffix}`;
  humEl.textContent = `${current.main.humidity}%`;
  windEl.textContent = `${current.wind.speed} m/s`;
  pressureEl.textContent = `${current.main.pressure} hPa`;


  sunriseEl.textContent = formatLocal(current.sys.sunrise, tzOffset, { hour:'2-digit', minute:'2-digit', hour12: true });
  sunsetEl.textContent = formatLocal(current.sys.sunset, tzOffset, { hour:'2-digit', minute:'2-digit', hour12: true });

  const {icon, mode} = weatherVisuals(current.weather[0].main);
  iconLarge.textContent = icon;


  const localNowMs = (current.dt + tzOffset) * 1000;           
  const localSunriseMs = (current.sys.sunrise + tzOffset) * 1000;
  const localSunsetMs = (current.sys.sunset + tzOffset) * 1000;
  const isDay = (localNowMs >= localSunriseMs && localNowMs < localSunsetMs);


  setScene(mode, isDay);


  if(Array.isArray(forecastGrouped) && forecastGrouped.length) renderForecastCards(forecastGrouped);
  else forecastEl.innerHTML = ''; 

  weatherCard.classList.add('show');
  clearError();
}


async function fetchByCity(city){
  if(!city) return showError("Enter a city");
  try{
    clearError();
    const unit = isCelsius ? 'metric' : 'imperial';
    const curRes = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=${unit}&appid=${API_KEY}`);
    const current = await curRes.json();
    if(current.cod && current.cod !== 200){ showError(current.message || 'City not found'); return; }

    const fRes = await fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&units=${unit}&appid=${API_KEY}`);
    const forecast = await fRes.json();
    const grouped = groupForecastByDay(forecast.list || []);
    currentCity = current.name;
    populateUI(current, grouped);
  }catch(err){
    console.error(err);
    showError("Unable to fetch weather. Check your connection or try another city.");
  }
}

function tryGeolocation(){
  if(!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(async pos=>{
    const {latitude: lat, longitude: lon} = pos.coords;
    try{
      const unit = isCelsius ? 'metric' : 'imperial';
      const curRes = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=${unit}&appid=${API_KEY}`);
      const current = await curRes.json();
      if(current.cod && current.cod !== 200) return;
      const fRes = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=${unit}&appid=${API_KEY}`);
      const forecast = await fRes.json();
      const grouped = groupForecastByDay(forecast.list || []);
      currentCity = current.name || '';
      populateUI(current, grouped);
    }catch(e){ /* silent */ }
  }, err => { /* user denied or fail */ }, { timeout: 7000 });
}


searchBtn.addEventListener('click', ()=>{ const v = cityInput.value.trim(); if(v) fetchByCity(v); });
cityInput.addEventListener('keypress', e => { if(e.key === 'Enter'){ const v = cityInput.value.trim(); if(v) fetchByCity(v); } });
locBtn.addEventListener('click', ()=> tryGeolocation());

unitToggle.addEventListener('click', ()=> {
  isCelsius = !isCelsius;
  unitToggle.textContent = isCelsius ? '°C' : '°F';
  if(currentCity) fetchByCity(currentCity);
});

themeToggle.addEventListener('click', ()=> document.body.classList.toggle('dark'));


tryGeolocation();

