/**
 * fallbackSolarProfiles.js — bundled local climate profiles (Step 7A).
 *
 * Representative monthly GHI (kWh/m²/day) and 2 m air temperature (°C).
 * Values reflect typical Indian solar atlases / regional climatology — not synthetic noise.
 */

/** @typedef {{ id: string, label: string, latitude: number, longitude: number, monthlyIrradiance: number[], monthlyTemp: number[] }} FallbackProfile */

/** @type {FallbackProfile} */
export const INDIA_DEFAULT_PROFILE = {
  id:        "india",
  label:     "India (national average)",
  latitude:  20.5937,
  longitude: 78.9629,
  // Pan-India representative monthly GHI (kWh/m²/day)
  monthlyIrradiance: [4.5, 5.2, 6.0, 6.5, 6.3, 5.2, 4.3, 4.2, 5.0, 5.3, 4.8, 4.4],
  // °C at 2 m
  monthlyTemp:       [19.5, 22.5, 27.0, 31.0, 33.0, 30.5, 27.5, 26.5, 27.0, 26.0, 22.5, 19.0],
};

/** @type {FallbackProfile[]} */
export const CITY_PROFILES = [
  {
    id:        "hyderabad",
    label:     "Hyderabad",
    latitude:  17.3850,
    longitude: 78.4867,
    monthlyIrradiance: [4.90, 5.75, 6.24, 6.67, 6.68, 5.46, 4.62, 4.59, 4.88, 5.04, 4.87, 4.66],
    monthlyTemp:       [21.6, 24.9, 28.7, 31.7, 33.3, 28.8, 26.5, 25.5, 25.2, 24.1, 22.1, 20.8],
  },
  {
    id:        "delhi",
    label:     "Delhi NCR",
    latitude:  28.6139,
    longitude: 77.2090,
    monthlyIrradiance: [3.8, 4.8, 5.8, 6.5, 6.8, 6.2, 5.0, 4.8, 5.5, 5.6, 4.5, 3.6],
    monthlyTemp:       [14.0, 17.5, 23.5, 29.0, 33.5, 32.5, 29.5, 28.5, 28.0, 24.0, 18.5, 14.5],
  },
  {
    id:        "mumbai",
    label:     "Mumbai",
    latitude:  19.0760,
    longitude: 72.8777,
    monthlyIrradiance: [4.6, 5.4, 6.1, 6.4, 6.2, 4.8, 3.9, 3.8, 4.5, 5.2, 5.0, 4.5],
    monthlyTemp:       [24.5, 25.5, 27.5, 29.0, 30.5, 28.5, 27.0, 26.5, 26.5, 27.5, 26.5, 24.5],
  },
  {
    id:        "chennai",
    label:     "Chennai",
    latitude:  13.0827,
    longitude: 80.2707,
    monthlyIrradiance: [4.8, 5.6, 6.2, 6.5, 6.3, 5.0, 4.5, 4.6, 5.2, 5.0, 4.6, 4.5],
    monthlyTemp:       [25.5, 27.0, 29.5, 31.5, 33.0, 32.0, 30.5, 29.5, 29.5, 28.5, 26.5, 25.0],
  },
  {
    id:        "bangalore",
    label:     "Bangalore",
    latitude:  12.9716,
    longitude: 77.5946,
    monthlyIrradiance: [5.0, 5.8, 6.3, 6.5, 6.2, 5.0, 4.4, 4.5, 5.0, 5.2, 4.9, 4.8],
    monthlyTemp:       [21.5, 24.0, 27.0, 28.5, 27.5, 25.0, 23.5, 23.0, 23.5, 23.0, 21.5, 20.5],
  },
];

export const ALL_FALLBACK_PROFILES = [INDIA_DEFAULT_PROFILE, ...CITY_PROFILES];

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2
    + Math.cos((lat1 * Math.PI) / 180)
    * Math.cos((lat2 * Math.PI) / 180)
    * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Pick the nearest bundled profile for a project location.
 * Falls back to India national average when no city is closer than 600 km.
 */
export function nearestFallbackProfile(latitude, longitude) {
  let best = INDIA_DEFAULT_PROFILE;
  let bestDist = Infinity;

  for (const profile of CITY_PROFILES) {
    const d = haversineKm(latitude, longitude, profile.latitude, profile.longitude);
    if (d < bestDist) {
      bestDist = d;
      best = profile;
    }
  }

  if (bestDist > 600) return INDIA_DEFAULT_PROFILE;
  return best;
}
