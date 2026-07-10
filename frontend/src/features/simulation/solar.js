/**
 * solar.js — Step 4A core solar math (renderer-agnostic).
 *
 * Thin wrapper around SunCalc that converts solar position into the 3D scene's
 * coordinate convention and provides the helpers the simulation UI needs.
 *
 * No React, no Three.js here — pure functions + plain objects, mirroring the
 * obstacleTypes.js pattern.  The 3D layer multiplies the unit direction vectors
 * by a scene radius; the panel formats the numbers.
 *
 * Scene coordinate convention (from roofGeometry3d.js):
 *   X = East   (positive = east)
 *   Y = Up     (positive = up)
 *   Z = South  (positive = south, negative = north)
 *
 * SunCalc conventions:
 *   altitude — radians above the horizon (0 = horizon, π/2 = zenith)
 *   azimuth  — radians measured FROM SOUTH, going clockwise toward WEST
 *              (0 = due south, +π/2 = west, −π/2 = east, ±π = north)
 *
 * IMPORTANT: these positions drive VISUAL shadow-mapping only (Step 4A).
 * The measured shadow/irradiance heatmap (4B) uses a separate raycast pass and
 * does not reuse anything here.
 */

import * as SunCalc from "suncalc";

const DEG2RAD = Math.PI / 180;

// ── SunCalc 2.x normalisation ────────────────────────────────────────────────
/**
 * SunCalc 2.0.0 (unlike the classic 1.x radians API) returns getPosition() in
 * DEGREES, with azimuth as a compass bearing measured CLOCKWISE FROM NORTH
 * (0 = N, 90 = E, 180 = S, 270 = W).  We normalise it once here into this
 * module's internal convention so every other helper can stay unchanged:
 *   • altitude → radians
 *   • azimuth  → radians, measured FROM SOUTH going +west (classic convention),
 *     i.e. azRad = (compassFromNorthDeg − 180) · π/180.
 *       compass 180 (S) → 0,  90 (E) → −π/2,  270 (W) → +π/2,  0 (N) → ±π  ✓
 */
function normalisePosition(pos) {
  return {
    altitude: pos.altitude * DEG2RAD,
    azimuth: (pos.azimuth - 180) * DEG2RAD,
    altitudeDeg: pos.altitude,
  };
}

// ── Daylight window for the time slider ──────────────────────────────────────
export const SIM_START = 6 * 60;   // 06:00 → 360 min
export const SIM_END   = 18 * 60;  // 18:00 → 1080 min
export const SIM_NOON  = 12 * 60;  // 12:00 → 720 min

// ── Date <-> minutes helpers ─────────────────────────────────────────────────

/**
 * Build a Date for the given calendar day at `minutes` past local midnight.
 * setMinutes() normalises values > 59 into hours, so 720 → 12:00.
 */
export function dayWithMinutes(day, minutes) {
  const d = new Date(day);
  d.setHours(0, 0, 0, 0);
  d.setMinutes(Math.round(minutes));
  return d;
}

/** Minutes past local midnight for a Date (fractional). */
export function dateToMinutes(date) {
  return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
}

// ── Angle helpers ────────────────────────────────────────────────────────────

export function radToDeg(r) {
  return (r * 180) / Math.PI;
}

/**
 * Convert SunCalc azimuth (from south, +west) into a compass bearing measured
 * clockwise from NORTH (0 = N, 90 = E, 180 = S, 270 = W) — the form users expect.
 */
export function azimuthToCompass(azimuthRad) {
  return (radToDeg(azimuthRad) + 180 + 360) % 360;
}

const CARDINALS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

/** Nearest 8-point cardinal label for a compass bearing in degrees. */
export function cardinal(compassDeg) {
  return CARDINALS[Math.round(compassDeg / 45) % 8];
}

// ── Sun direction in scene space ─────────────────────────────────────────────

/**
 * Unit vector pointing FROM the scene origin TOWARD the sun, in scene coords.
 *
 *   horizontal magnitude = cos(altitude)
 *   x = −cos(alt)·sin(az)   (west when az = +π/2 → −X = west ✓)
 *   y =  sin(alt)
 *   z =  cos(alt)·cos(az)   (south when az = 0 → +Z = south ✓)
 */
export function sunDirection(altitude, azimuth) {
  const c = Math.cos(altitude);
  return {
    x: -c * Math.sin(azimuth),
    y: Math.sin(altitude),
    z: c * Math.cos(azimuth),
  };
}

// ── Instantaneous sun state ──────────────────────────────────────────────────

/**
 * Full sun state for a given calendar day + time-of-day + location.
 *
 * @returns {{
 *   date: Date, altitude: number, azimuth: number,
 *   dir: {x:number,y:number,z:number}, belowHorizon: boolean
 * }}
 */
export function getSun(day, minutes, lat, lng) {
  const date = dayWithMinutes(day, minutes);
  const { altitude, azimuth, altitudeDeg } = normalisePosition(
    SunCalc.getPosition(date, lat, lng),
  );
  return {
    date,
    altitude,
    azimuth,
    dir: sunDirection(altitude, azimuth),
    belowHorizon: altitudeDeg <= 0,
  };
}

// ── Sunrise / sunset / solar noon ────────────────────────────────────────────

/**
 * Daylight times for the selected day + location, expressed both as Dates and
 * as minutes-past-midnight (for placing markers on the time slider).
 * Polar edge cases (no sunrise/sunset) yield null minute fields.
 */
export function getDayTimes(day, lat, lng) {
  const base = new Date(day);
  base.setHours(12, 0, 0, 0); // midday avoids DST edge issues in getTimes
  const t = SunCalc.getTimes(base, lat, lng);

  const toMin = (d) =>
    d instanceof Date && !isNaN(d) ? dateToMinutes(d) : null;

  return {
    sunrise:    t.sunrise,
    sunset:     t.sunset,
    solarNoon:  t.solarNoon,
    sunriseMin: toMin(t.sunrise),
    sunsetMin:  toMin(t.sunset),
    noonMin:    toMin(t.solarNoon),
  };
}

// ── Sun arc (full daylight path) ─────────────────────────────────────────────

/**
 * Sample the sun's path across the sky for the selected day, returning unit
 * direction vectors (scene space) for every sample where the sun is above the
 * horizon.  The 3D layer scales these by the scene radius to draw the arc.
 *
 * Samples span sunrise→sunset when available, else the full 24h as a fallback.
 */
export function sampleSunArc(day, lat, lng, samples = 64) {
  const { sunriseMin, sunsetMin } = getDayTimes(day, lat, lng);
  const start = sunriseMin ?? 0;
  const end   = sunsetMin ?? 24 * 60;
  if (end <= start) return [];

  const pts = [];
  for (let i = 0; i <= samples; i++) {
    const minutes = start + ((end - start) * i) / samples;
    const date = dayWithMinutes(day, minutes);
    const { altitude, azimuth, altitudeDeg } = normalisePosition(
      SunCalc.getPosition(date, lat, lng),
    );
    if (altitudeDeg > -1) pts.push(sunDirection(altitude, azimuth));
  }
  return pts;
}

// ── Sun arc hour markers (for labelled tick marks along the arc) ─────────────

/**
 * Sample the sun direction at each integer hour the sun is above the horizon,
 * for use as labelled tick marks along the arc in the 3D scene.
 *
 * Returns one entry per above-horizon integer hour.  Labels use the existing
 * formatTime() helper (e.g. "7 AM", "12 PM", "3 PM").
 *
 * @returns {Array<{ hour:number, label:string, dir:{x,y,z} }>}
 */
export function sampleHourMarkers(day, lat, lng) {
  const { sunriseMin, sunsetMin } = getDayTimes(day, lat, lng);
  if (sunriseMin == null || sunsetMin == null) return [];

  const firstHour = Math.ceil(sunriseMin / 60);
  const lastHour  = Math.floor(sunsetMin  / 60);
  const markers   = [];

  for (let hour = firstHour; hour <= lastHour; hour++) {
    const sun = getSun(day, hour * 60, lat, lng);
    if (sun.belowHorizon) continue;
    markers.push({ hour, label: formatTime(hour * 60), dir: sun.dir });
  }
  return markers;
}

// ── Formatting ───────────────────────────────────────────────────────────────

/** "6:05 AM" from minutes-past-midnight. */
export function formatTime(minutes) {
  const total = Math.round(minutes);
  let h = Math.floor(total / 60);
  const m = total % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** "Sat, 21 Jun 2026" from a Date. */
export function formatDate(date) {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ── Date presets ─────────────────────────────────────────────────────────────

/**
 * Preset calendar days, anchored to the year of `refDate` (default: now) so
 * "Today" and the seasonal markers live in the same year.  Each is a Date at
 * local midnight.
 */
export function presetDates(refDate = new Date()) {
  const year = refDate.getFullYear();
  const atMidnight = (y, m, d) => {
    const dt = new Date(y, m, d);
    dt.setHours(0, 0, 0, 0);
    return dt;
  };
  const today = new Date(refDate);
  today.setHours(0, 0, 0, 0);

  return {
    today,
    summer:  atMidnight(year, 5, 21),  // Jun 21 — summer solstice
    winter:  atMidnight(year, 11, 21), // Dec 21 — winter solstice
    equinox: atMidnight(year, 2, 21),  // Mar 21 — vernal equinox
  };
}

/** Same calendar day? (ignores time) */
export function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Parse a yyyy-mm-dd value (from <input type="date">) into a local-midnight Date. */
export function parseDateInput(value) {
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

/** Format a Date as yyyy-mm-dd for <input type="date">. */
export function toDateInputValue(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
