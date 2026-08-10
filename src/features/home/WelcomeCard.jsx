import { useEffect, useState, useRef } from 'react';
import { Icon } from '../../components/Icon/Icon';
import { supabase } from '../../lib/supabase';
import styles from './HomeView.module.css';

function greetingFor(hour) {
  if (hour < 5) return 'Good Night';
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  if (hour < 21) return 'Good Evening';
  return 'Good Night';
}

function formatTime(date) {
  let h = date.getHours();
  const m = String(date.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}.${m} ${ampm}`;
}

function formatDate(date) {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

const TIMEZONE_FORMATTER = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' });

function getTimezone(date) {
  const parts = TIMEZONE_FORMATTER.formatToParts(date);
  const tz = parts.find(p => p.type === 'timeZoneName');
  return tz?.value || Intl.DateTimeFormat().resolvedOptions().timeZone;
}

// Open-Meteo weather_code → { label, icon }
const WEATHER_MAP = {
  0:  { label: 'Clear sky',         icon: 'meteocons:clear-day-fill' },
  1:  { label: 'Mostly clear',      icon: 'meteocons:clear-day-fill' },
  2:  { label: 'Partly Cloudy',     icon: 'meteocons:partly-cloudy-day-fill' },
  3:  { label: 'Overcast',          icon: 'meteocons:overcast-day-fill' },
  45: { label: 'Foggy',             icon: 'meteocons:fog-day-fill' },
  48: { label: 'Foggy',             icon: 'meteocons:fog-day-fill' },
  51: { label: 'Light drizzle',     icon: 'meteocons:drizzle-fill' },
  53: { label: 'Drizzle',           icon: 'meteocons:drizzle-fill' },
  55: { label: 'Heavy drizzle',     icon: 'meteocons:drizzle-fill' },
  61: { label: 'Light rain',        icon: 'meteocons:partly-cloudy-day-rain-fill' },
  63: { label: 'Rain',              icon: 'meteocons:rain-fill' },
  65: { label: 'Heavy rain',        icon: 'meteocons:rain-fill' },
  71: { label: 'Light snow',        icon: 'meteocons:snow-fill' },
  73: { label: 'Snow',              icon: 'meteocons:snow-fill' },
  75: { label: 'Heavy snow',        icon: 'meteocons:snow-fill' },
  80: { label: 'Rain showers',      icon: 'meteocons:partly-cloudy-day-rain-fill' },
  81: { label: 'Rain showers',      icon: 'meteocons:rain-fill' },
  82: { label: 'Heavy showers',     icon: 'meteocons:thunderstorms-rain-fill' },
  95: { label: 'Thunderstorms',     icon: 'meteocons:thunderstorms-fill' },
  96: { label: 'Thunderstorms',     icon: 'meteocons:thunderstorms-rain-fill' },
  99: { label: 'Thunderstorms',     icon: 'meteocons:thunderstorms-rain-fill' },
};

const FALLBACK_LOCATION = { city: 'Pune', country: 'India', lat: 18.5204, lon: 73.8567 };

const CITY_LIST = [
  { city: 'Mumbai', country: 'India', lat: 19.076, lon: 72.8777 },
  { city: 'Delhi', country: 'India', lat: 28.6139, lon: 77.209 },
  { city: 'Bangalore', country: 'India', lat: 12.9716, lon: 77.5946 },
  { city: 'Chennai', country: 'India', lat: 13.0827, lon: 80.2707 },
  { city: 'Hyderabad', country: 'India', lat: 17.385, lon: 78.4867 },
  { city: 'Pune', country: 'India', lat: 18.5204, lon: 73.8567 },
  { city: 'Kolkata', country: 'India', lat: 22.5726, lon: 88.3639 },
  { city: 'Ahmedabad', country: 'India', lat: 23.0225, lon: 72.5714 },
  { city: 'Jaipur', country: 'India', lat: 26.9124, lon: 75.7873 },
  { city: 'Lucknow', country: 'India', lat: 26.8467, lon: 80.9462 },
  { city: 'New York', country: 'US', lat: 40.7128, lon: -74.006 },
  { city: 'Los Angeles', country: 'US', lat: 34.0522, lon: -118.2437 },
  { city: 'Chicago', country: 'US', lat: 41.8781, lon: -87.6298 },
  { city: 'Houston', country: 'US', lat: 29.7604, lon: -95.3698 },
  { city: 'Phoenix', country: 'US', lat: 33.4484, lon: -112.074 },
  { city: 'San Francisco', country: 'US', lat: 37.7749, lon: -122.4194 },
  { city: 'Seattle', country: 'US', lat: 47.6062, lon: -122.3321 },
  { city: 'Boston', country: 'US', lat: 42.3601, lon: -71.0589 },
  { city: 'Miami', country: 'US', lat: 25.7617, lon: -80.1918 },
  { city: 'Denver', country: 'US', lat: 39.7392, lon: -104.9903 },
];

async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=10`,
      { headers: { 'Accept': 'application/json' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const addr = data.address || {};
    const city = addr.city || addr.town || addr.village || addr.county || addr.state || 'Unknown';
    const country = addr.country || '';
    return { city, country };
  } catch {
    return null;
  }
}

async function fetchWeather(lat, lon) {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&temperature_unit=celsius&daily=sunrise&timezone=auto`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return {
      temp: Math.round(data.current?.temperature_2m),
      code: data.current?.weather_code,
      sunrise: data.daily?.sunrise?.[0],
    };
  } catch {
    return null;
  }
}

export function WelcomeCard({ dragHandleClassName }) {
  const [now, setNow] = useState(() => new Date());
  const [firstName, setFirstName] = useState('there');
  const [location, setLocation] = useState(FALLBACK_LOCATION);
  const [weather, setWeather] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const meta = data?.session?.user?.user_metadata || {};
      const name =
        meta.first_name ||
        (meta.full_name ? meta.full_name.split(' ')[0] : null) ||
        (data?.session?.user?.email ? data.session.user.email.split('@')[0] : null);
      if (name) setFirstName(name.charAt(0).toUpperCase() + name.slice(1));
    });
  }, []);

  const resolveLocation = async (lat, lon) => {
    const [geo, w] = await Promise.all([reverseGeocode(lat, lon), fetchWeather(lat, lon)]);
    if (geo) setLocation({ ...geo, lat, lon });
    if (w) setWeather(w);
  };

  useEffect(() => {
    let cancelled = false;
    const resolve = async (lat, lon) => {
      const [geo, w] = await Promise.all([reverseGeocode(lat, lon), fetchWeather(lat, lon)]);
      if (cancelled) return;
      if (geo) setLocation({ ...geo, lat, lon });
      if (w) setWeather(w);
    };

    if (!navigator.geolocation) {
      resolve(FALLBACK_LOCATION.lat, FALLBACK_LOCATION.lon);
      return () => { cancelled = true; };
    }

    navigator.geolocation.getCurrentPosition(
      pos => resolve(pos.coords.latitude, pos.coords.longitude),
      () => resolve(FALLBACK_LOCATION.lat, FALLBACK_LOCATION.lon),
      { timeout: 8000, maximumAge: 15 * 60 * 1000 }
    );
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [dropdownOpen]);

  const handleCitySelect = (c) => {
    setLocation(c);
    setDropdownOpen(false);
    setWeather(null);
    resolveLocation(c.lat, c.lon);
  };

  const greeting = greetingFor(now.getHours());
  const info = weather ? WEATHER_MAP[weather.code] : null;
  const weatherLabel = info?.label || 'Partly Cloudy';
  const iconName = info?.icon || 'meteocons:partly-cloudy-day-rain-fill';
  const timezoneStr = getTimezone(now);
  const locationLabel = location.country
    ? `${location.city}, ${location.country}`
    : location.city;

  const indiaCities = CITY_LIST.filter(c => c.country === 'India');
  const usCities = CITY_LIST.filter(c => c.country === 'US');

  return (
    <div className={[styles.welcomeCard, dragHandleClassName].filter(Boolean).join(' ')}>
      <div className={styles.welcomeHeader}>
        <div className={styles.welcomeGreeting}>{greeting}, {firstName}</div>
        <div style={{ position: 'relative' }} ref={dropdownRef}>
          <button
            className={styles.welcomeLocation}
            type="button"
            onClick={() => setDropdownOpen(v => !v)}
          >
            <Icon name="solar:map-point-linear" size={14} />
            {locationLabel}
            <Icon name="solar:alt-arrow-down-linear" size={12} />
          </button>
          {dropdownOpen && (
            <div className={styles.locationDropdown}>
              <div className={styles.locationDropdownGroup}>India</div>
              {indiaCities.map(c => (
                <button
                  key={c.city}
                  className={styles.locationDropdownItem}
                  onClick={() => handleCitySelect(c)}
                  data-active={location.city === c.city && location.country === c.country ? '' : undefined}
                >
                  {c.city}
                </button>
              ))}
              <div className={styles.locationDropdownGroup}>United States</div>
              {usCities.map(c => (
                <button
                  key={c.city}
                  className={styles.locationDropdownItem}
                  onClick={() => handleCitySelect(c)}
                  data-active={location.city === c.city && location.country === c.country ? '' : undefined}
                >
                  {c.city}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className={styles.welcomeClock}>
        <div className={styles.welcomeTime}>{formatTime(now)}</div>
        <div className={styles.welcomeDate}>
          {formatDate(now)}
          <span className={styles.welcomeDateSep}>|</span>
          {timezoneStr}
        </div>
      </div>
      <div className={styles.welcomeWeather}>
        <div className={styles.welcomeWeatherBody}>
          <div className={styles.welcomeWeatherLabel}>Weather Forecast</div>
          <div className={styles.welcomeWeatherMain}>{weatherLabel}</div>
          <div className={styles.welcomeWeatherDesc}>Precipitation likely. Check later.</div>
        </div>
        <div className={styles.welcomeWeatherRight}>
          {weather?.temp != null && (
            <div className={styles.welcomeTemp}>
              {weather.temp}<span className={styles.welcomeTempUnit}>°C</span>
            </div>
          )}
          <Icon name={iconName} size={56} className={styles.welcomeWeatherIcon} />
        </div>
      </div>
    </div>
  );
}
