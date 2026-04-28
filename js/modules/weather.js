import { qi } from '../state.js';
import { settings } from '../main.js';

/* ══════════════════════════════════════════════
   WEATHER
══════════════════════════════════════════════ */
export function fetchWeather() {
    const { city = 'London', units = 'metric' } = settings;
    const sym = units === 'metric' ? '°C' : '°F';
    qi('hwCity').textContent = city;

    fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=bfe9d30f9b49ebd45b89ccb0835c9210&units=${units}`)
        .then(r => {
            if (!r.ok) throw new Error('Network response was not ok');
            return r.json();
        })
        .then(d => {
            if (!d || !d.main || !d.weather) throw new Error('Invalid data format');
            
            qi('hwTemp').textContent = Math.round(d.main.temp) + sym;
            const desc = d.weather[0].description;
            qi('hwDesc').textContent = desc.charAt(0).toUpperCase() + desc.slice(1);
        })
        .catch((err) => {
            console.error("Weather Fetch Error:", err);
            qi('hwTemp').textContent = '--';
            qi('hwDesc').textContent = 'Error';
        });
}
