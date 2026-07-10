/**
 * solarResourceService.js — Step 7A solar resource boundary.
 *
 * UI and downstream steps (7B+) call ONLY this module — never nasaService directly.
 */

import { fetchNasaClimatology } from "./nasaService";
import { nearestFallbackProfile } from "./fallbackSolarProfiles";

/** In-memory cache keyed by roundLocationKey(lat, lng). Shared across the session. */
export const solarResourceCache = new Map();

/**
 * Round coordinates to 5 decimal places (~1.1 m) for cache keys.
 */
export function roundLocationKey(latitude, longitude) {
  return `${Number(latitude).toFixed(5)},${Number(longitude).toFixed(5)}`;
}

/**
 * Step 7A validation — requires ONLY latitude + longitude.
 */
export function validateSolarResourceInput(latitude, longitude) {
  if (latitude == null || longitude == null) {
    return {
      ok:      false,
      message: "Set a project location in Step 1 before loading solar resource data.",
    };
  }
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return { ok: false, message: "Project coordinates are invalid." };
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return { ok: false, message: "Project coordinates are out of range." };
  }
  return { ok: true, message: null };
}

function average(values) {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/** 1 kWh/m²/day ≈ 1 peak sun hour (derived — not a NASA field). */
export function derivePeakSunHours(avgIrradianceKwhM2Day) {
  return avgIrradianceKwhM2Day;
}

function buildResourceRecord({
  latitude,
  longitude,
  monthlyIrradiance,
  monthlyTemp,
  avgIrradiance,
  avgTemp,
  source,
  fallbackProfileId = null,
}) {
  const fetchedAt = new Date().toISOString();
  const avgIrr = +avgIrradiance.toFixed(3);
  const avgT   = +avgTemp.toFixed(2);

  return {
    latitude,
    longitude,
    monthlyIrradiance: monthlyIrradiance.map((v) => +v.toFixed(3)),
    monthlyTemp:       monthlyTemp.map((v) => +v.toFixed(2)),
    avgIrradiance:     avgIrr,
    avgTemp:           avgT,
    peakSunHours:      +derivePeakSunHours(avgIrr).toFixed(3),
    source,
    fallbackProfileId,
    fetchedAt,
  };
}

function buildFallbackResource(latitude, longitude) {
  const profile = nearestFallbackProfile(latitude, longitude);
  const avgIrradiance = average(profile.monthlyIrradiance);
  const avgTemp       = average(profile.monthlyTemp);

  return buildResourceRecord({
    latitude,
    longitude,
    monthlyIrradiance: profile.monthlyIrradiance,
    monthlyTemp:       profile.monthlyTemp,
    avgIrradiance,
    avgTemp,
    source:            "fallback",
    fallbackProfileId: profile.id,
  });
}

/**
 * Read cached solar resource for a location (7B/7C/7D read path).
 */
export function getCachedSolarResource(latitude, longitude) {
  const key = roundLocationKey(latitude, longitude);
  return solarResourceCache.get(key) ?? null;
}

/**
 * Fetch solar resource — NASA first, bundled profile on any failure.
 * Result is written to solarResourceCache by the caller after success.
 */
export async function fetchSolarResource(latitude, longitude, options = {}) {
  const validation = validateSolarResourceInput(latitude, longitude);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const cacheKey = roundLocationKey(latitude, longitude);
  const cached = solarResourceCache.get(cacheKey);
  if (cached) return cached;

  try {
    const nasa = await fetchNasaClimatology(latitude, longitude, options);
    const record = buildResourceRecord({
      latitude,
      longitude,
      monthlyIrradiance: nasa.monthlyIrradiance,
      monthlyTemp:       nasa.monthlyTemp,
      avgIrradiance:     nasa.avgIrradiance,
      avgTemp:           nasa.avgTemp,
      source:            "nasa",
    });
    solarResourceCache.set(cacheKey, record);
    return record;
  } catch (err) {
    if (err?.name === "AbortError") throw err;

    const fallback = buildFallbackResource(latitude, longitude);
    solarResourceCache.set(cacheKey, fallback);
    return fallback;
  }
}
