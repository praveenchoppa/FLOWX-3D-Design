/**
 * nasaService.js — NASA POWER climatology client (Step 7A).
 *
 * All NASA-specific URL construction and JSON parsing lives here.
 * Returns normalized monthly arrays only — no NASA field names escape this module.
 */

const NASA_MONTH_KEYS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

const NASA_FILL = -999;
const REQUEST_TIMEOUT_MS = 15_000;

/** Dev proxy avoids browser CORS blocks; prod hits NASA directly. */
function nasaApiBase() {
  return import.meta.env.DEV
    ? "/api/nasa-power"
    : "https://power.larc.nasa.gov/api";
}

function buildClimatologyUrl(latitude, longitude) {
  const params = new URLSearchParams({
    parameters: "ALLSKY_SFC_SW_DWN,T2M",
    community:  "RE",
    longitude:  String(longitude),
    latitude:   String(latitude),
    format:     "JSON",
  });
  return `${nasaApiBase()}/temporal/climatology/point?${params.toString()}`;
}

function monthValuesFromNasa(paramBlock) {
  if (!paramBlock || typeof paramBlock !== "object") return null;

  const values = NASA_MONTH_KEYS.map((key) => {
    const v = paramBlock[key];
    if (v == null || v === NASA_FILL || Number.isNaN(v)) return null;
    return Number(v);
  });

  if (values.some((v) => v == null)) return null;
  return values;
}

function average(values) {
  if (!values?.length) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/**
 * Fetch monthly climatology from NASA POWER.
 *
 * @returns {Promise<{ monthlyIrradiance: number[], monthlyTemp: number[], avgIrradiance: number, avgTemp: number }>}
 */
export async function fetchNasaClimatology(latitude, longitude, options = {}) {
  const { signal } = options;
  const url = buildClimatologyUrl(latitude, longitude);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const onParentAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) {
      clearTimeout(timer);
      throw new DOMException("Aborted", "AbortError");
    }
    signal.addEventListener("abort", onParentAbort);
  }

  let response;
  try {
    response = await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onParentAbort);
  }

  if (!response.ok) {
    throw new Error(`NASA POWER HTTP ${response.status}`);
  }

  const json = await response.json();
  const params = json?.properties?.parameter;

  const monthlyIrradiance = monthValuesFromNasa(params?.ALLSKY_SFC_SW_DWN);
  const monthlyTemp       = monthValuesFromNasa(params?.T2M);

  if (!monthlyIrradiance || !monthlyTemp) {
    throw new Error("NASA POWER returned incomplete climatology data");
  }

  const annIrr = params.ALLSKY_SFC_SW_DWN?.ANN;
  const annTemp = params.T2M?.ANN;

  const avgIrradiance = (annIrr != null && annIrr !== NASA_FILL)
    ? Number(annIrr)
    : average(monthlyIrradiance);

  const avgTemp = (annTemp != null && annTemp !== NASA_FILL)
    ? Number(annTemp)
    : average(monthlyTemp);

  return {
    monthlyIrradiance,
    monthlyTemp,
    avgIrradiance,
    avgTemp,
  };
}
