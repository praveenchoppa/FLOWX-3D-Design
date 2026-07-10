/**
 * EnergyPanel — Step 7 right-hand panel.
 *
 * Step 7A: NASA POWER (or fallback) climate data.
 * Step 7B: derived energy production from energyResult (read-only).
 */
import { FiSun, FiThermometer, FiClock, FiLoader, FiAlertCircle } from "react-icons/fi";

import {
  PanelShell, PanelHeader, KpiCard, DataRow,
  InstructionList, DIVIDER, SEC_LABEL, StaleDesignBanner,
} from "./panelUtils";
import ProductionAnalytics from "../energy/ProductionAnalytics";

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default function EnergyPanel({
  location = {},
  solarResource = null,
  solarResourceStatus = "idle", // idle | loading | ready | error
  solarResourceError = null,
  energyResult = null,
  isStaleDesign = false,
  onUpdateDesign = null,
  isUpdatingDesign = false,
}) {
  const hasLocation = location?.lat != null && location?.lng != null;
  const isFallback  = solarResource?.source === "fallback";
  const isNasa      = solarResource?.source === "nasa";

  const statusPill = (() => {
    if (!hasLocation) {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#94A3B8]/10 border border-[#94A3B8]/25">
          <span className="text-[10px] font-semibold text-[#94A3B8]">No location</span>
        </div>
      );
    }
    if (solarResourceStatus === "loading") {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#4F8CFF]/10 border border-[#4F8CFF]/25">
          <FiLoader size={10} className="text-[#4F8CFF] animate-spin" />
          <span className="text-[10px] font-semibold text-[#4F8CFF]">Loading</span>
        </div>
      );
    }
    if (solarResourceStatus === "error") {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/25">
          <FiAlertCircle size={10} className="text-red-400" />
          <span className="text-[10px] font-semibold text-red-400">Error</span>
        </div>
      );
    }
    if (isFallback) {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FFB547]/10 border border-[#FFB547]/25">
          <span className="text-[10px] font-semibold text-[#FFB547]">Estimated data</span>
        </div>
      );
    }
    if (isNasa) {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#00E38C]/10 border border-[#00E38C]/25">
          <div className="w-1.5 h-1.5 rounded-full bg-[#00E38C]" />
          <span className="text-[10px] font-semibold text-[#00E38C]">NASA POWER</span>
        </div>
      );
    }
    return null;
  })();

  return (
    <PanelShell>
      <PanelHeader
        label="Energy"
        subtitle="Solar resource & production analytics"
        pill={statusPill}
      />

      <StaleDesignBanner
        show={isStaleDesign}
        onUpdateDesign={onUpdateDesign}
        isUpdatingDesign={isUpdatingDesign}
      />

      {DIVIDER}

      {!hasLocation && (
        <div className="flex items-start gap-2.5 px-3 py-3 rounded-xl bg-[#FFB547]/8 border border-[#FFB547]/25">
          <FiAlertCircle size={14} className="text-[#FFB547] shrink-0 mt-0.5" />
          <p className="text-[11px] text-[#94A3B8] leading-relaxed">
            Set a project location in Step 1 (latitude and longitude) to load solar
            irradiance and temperature data.
          </p>
        </div>
      )}

      {hasLocation && solarResourceStatus === "loading" && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <FiLoader size={22} className="text-[#4F8CFF] animate-spin" />
          <p className="text-[11px] text-[#94A3B8]">
            Fetching NASA POWER climatology for{" "}
            {location.lat.toFixed(4)}°, {location.lng.toFixed(4)}°…
          </p>
        </div>
      )}

      {hasLocation && solarResourceStatus === "error" && (
        <div className="flex items-start gap-2.5 px-3 py-3 rounded-xl bg-red-500/8 border border-red-500/25">
          <FiAlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-[#94A3B8] leading-relaxed">
            {solarResourceError ?? "Could not load solar resource data."}
          </p>
        </div>
      )}

      {hasLocation && solarResourceStatus === "ready" && solarResource && (
        <>
          {isFallback && (
            <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-[#FFB547]/8 border border-[#FFB547]/25">
              <FiAlertCircle size={12} className="text-[#FFB547] shrink-0 mt-0.5" />
              <p className="text-[10px] text-[#94A3B8] leading-relaxed">
                NASA POWER was unavailable — showing estimated climate data from the
                nearest bundled profile
                {solarResource.fallbackProfileId
                  ? ` (${solarResource.fallbackProfileId})`
                  : ""}.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2 px-3 py-4 rounded-xl bg-[#FFB547]/8 border border-[#FFB547]/30">
            <span className="text-[9px] font-bold tracking-[0.2em] text-[#FFB547] uppercase">
              Site Solar Resource
            </span>
            <div className="flex gap-2">
              <KpiCard
                label="Avg Irradiance"
                value={`${solarResource.avgIrradiance.toFixed(2)} kWh/m²/day`}
                accent="text-[#FFB547]"
              />
              <KpiCard
                label="Peak Sun Hours"
                value={`${solarResource.peakSunHours.toFixed(2)} h/day`}
                accent="text-[#F8FAFC]"
              />
            </div>
            <KpiCard
              label="Avg Temperature (2 m)"
              value={`${solarResource.avgTemp.toFixed(1)} °C`}
              accent="text-[#4F8CFF]"
            />
            <p className="text-[10px] text-[#94A3B8] leading-relaxed">
              20-year monthly climatology (Jan 2001 – Dec 2020). Peak sun hours are
              derived from average irradiance (1 kWh/m²/day ≈ 1 PSH).
            </p>
          </div>

          {DIVIDER}

          <div className="flex flex-col gap-2">
            <span className={SEC_LABEL} style={{ marginBottom: 0 }}>
              <FiSun size={10} className="inline mr-1" />
              Monthly Irradiance (GHI)
            </span>
            <div className="rounded-xl border border-[#23324A] overflow-hidden">
              {MONTH_LABELS.map((month, i) => (
                <DataRow
                  key={month}
                  label={month}
                  value={`${solarResource.monthlyIrradiance[i].toFixed(2)} kWh/m²/day`}
                  isLast={i === MONTH_LABELS.length - 1}
                />
              ))}
            </div>
          </div>

          {DIVIDER}

          <div className="flex flex-col gap-2">
            <span className={SEC_LABEL} style={{ marginBottom: 0 }}>
              <FiThermometer size={10} className="inline mr-1" />
              Monthly Temperature (2 m)
            </span>
            <div className="rounded-xl border border-[#23324A] overflow-hidden">
              {MONTH_LABELS.map((month, i) => (
                <DataRow
                  key={month}
                  label={month}
                  value={`${solarResource.monthlyTemp[i].toFixed(1)} °C`}
                  isLast={i === MONTH_LABELS.length - 1}
                />
              ))}
            </div>
          </div>

          <div className="px-3 py-2 rounded-lg bg-[rgba(7,17,32,0.4)] border border-[#23324A]/50">
            <p className="text-[9px] text-[#4a5c75] leading-relaxed">
              <FiClock size={9} className="inline mr-1" />
              Fetched {new Date(solarResource.fetchedAt).toLocaleString()} ·{" "}
              {location.lat.toFixed(5)}°, {location.lng.toFixed(5)}°
            </p>
          </div>
        </>
      )}

      {hasLocation && solarResourceStatus === "ready" && energyResult && (
        <>
          {DIVIDER}
          <ProductionAnalytics energyResult={energyResult} />
        </>
      )}

      {hasLocation && solarResourceStatus === "ready" && !energyResult && (
        <>
          {DIVIDER}
          <div className="flex items-start gap-2.5 px-3 py-3 rounded-xl bg-[#94A3B8]/8 border border-[#94A3B8]/20">
            <FiAlertCircle size={14} className="text-[#94A3B8] shrink-0 mt-0.5" />
            <p className="text-[11px] text-[#94A3B8] leading-relaxed">
              Place panels in Step 6 and run shadow analysis in Step 4 to compute
              energy production. Arrays need measured exposure scores per region.
            </p>
          </div>
        </>
      )}

      {DIVIDER}

      <InstructionList items={[
        "Solar resource is fetched once per project location and cached for energy estimates",
        "Production analytics read directly from energyResult — no recalculation in charts",
        "Monthly and array charts update automatically when panels or arrays change",
        "Financials, ROI, and 3D production overlays are deferred to later steps",
      ]} />
    </PanelShell>
  );
}
