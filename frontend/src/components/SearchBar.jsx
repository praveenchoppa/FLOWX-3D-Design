import { useState, useEffect, useRef, useCallback } from "react";
import { FiSearch, FiLoader, FiAlertCircle } from "react-icons/fi";
import { searchLocation, reverseGeocode } from "../services/geocoding";

const ERROR_DISMISS_MS = 4500;
const ERROR_EXIT_MS = 280;

/**
 * Parses "lat, lng" style coordinate strings.
 * Supports decimal degrees with optional ° symbol and N/S/E/W suffixes.
 * Returns { lat, lng } or null if not a valid coordinate pair.
 */
const COORD_RE =
  /^\s*(-?\d+(?:\.\d+)?)\s*°?\s*([NSns])?\s*,\s*(-?\d+(?:\.\d+)?)\s*°?\s*([EWew])?\s*$/;

function parseCoords(input) {
  const m = input.match(COORD_RE);
  if (!m) return null;
  let lat = parseFloat(m[1]);
  let lng = parseFloat(m[3]);
  if (m[2] && /[Ss]/i.test(m[2])) lat = -Math.abs(lat);
  if (m[4] && /[Ww]/i.test(m[4])) lng = -Math.abs(lng);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

const ERROR_COPY = {
  not_found: {
    title: "Location not found",
    subtitle: "Try a more specific address, city, or coordinates.",
  },
  network: {
    title: "Search failed",
    subtitle: "Check your connection and try again.",
  },
};

export default function SearchBar({ setLocation }) {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [errorVisible, setErrorVisible] = useState(false);
  const dismissTimerRef = useRef(null);
  const exitTimerRef = useRef(null);

  const clearErrorTimers = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
  }, []);

  const showError = useCallback((type) => {
    clearErrorTimers();
    setError(type);
    setErrorVisible(true);

    dismissTimerRef.current = setTimeout(() => {
      setErrorVisible(false);
      exitTimerRef.current = setTimeout(() => {
        setError(null);
      }, ERROR_EXIT_MS);
    }, ERROR_DISMISS_MS);
  }, [clearErrorTimers]);

  const dismissError = useCallback(() => {
    clearErrorTimers();
    setErrorVisible(false);
    exitTimerRef.current = setTimeout(() => setError(null), ERROR_EXIT_MS);
  }, [clearErrorTimers]);

  useEffect(() => () => clearErrorTimers(), [clearErrorTimers]);

  const handleSearch = async () => {
    const q = query.trim();
    if (!q || isLoading) return;

    setIsLoading(true);
    clearErrorTimers();
    setError(null);
    setErrorVisible(false);

    try {
      const coords = parseCoords(q);

      if (coords) {
        const address = await reverseGeocode(coords.lat, coords.lng);
        setLocation({ address, lat: coords.lat, lng: coords.lng });
        setQuery("");
      } else {
        const result = await searchLocation(q);
        if (!result) {
          showError("not_found");
          return;
        }
        setLocation(result);
        setQuery("");
      }
    } catch {
      showError("network");
    } finally {
      setIsLoading(false);
    }
  };

  const errorCopy = error ? ERROR_COPY[error] : null;

  return (
    <div className="relative w-full max-w-[480px]">
      <div
        className={`
          group/search
          w-full min-h-[44px]
          rounded-2xl
          border border-[#23324A]/70
          bg-[rgba(16,27,45,0.55)]
          backdrop-blur-md
          flex items-center
          px-3.5 gap-2.5
          shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_4px_24px_rgba(0,0,0,0.28)]
          ring-1 ring-white/[0.04]
          transition-all duration-200 ease-out
          hover:border-[#2e3f5c]/90
          hover:bg-[rgba(16,27,45,0.68)]
          hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_8px_32px_rgba(0,0,0,0.38)]
          focus-within:border-[#4F8CFF]/45
          focus-within:ring-2 focus-within:ring-[#4F8CFF]/25
          focus-within:bg-[rgba(16,27,45,0.72)]
          focus-within:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_8px_36px_rgba(79,140,255,0.12)]
          ${isLoading ? "opacity-95" : ""}
        `}
      >
        <FiSearch
          size={15}
          className="text-[#94A3B8] shrink-0 transition-colors duration-200 group-focus-within/search:text-[#4F8CFF]/80"
        />

        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (error) dismissError();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSearch();
          }}
          placeholder="Search address, city or coordinates..."
          className="
            flex-1 min-w-0
            bg-transparent
            text-[#F8FAFC] text-[13px] leading-snug
            outline-none
            placeholder:text-[#94A3B8]/50
            disabled:opacity-60
          "
          disabled={isLoading}
          aria-invalid={error != null}
          aria-describedby={error ? "search-error-message" : undefined}
        />

        {!isLoading && (
          <div className="hidden sm:flex items-center gap-0.5 px-2 py-1 rounded-md border border-[#23324A]/80 bg-[rgba(7,17,32,0.45)] shrink-0">
            <span className="text-[10px] text-[#94A3B8]/55 leading-none tracking-wide">⌘K</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleSearch}
          disabled={isLoading || !query.trim()}
          className={`
            shrink-0
            flex items-center justify-center gap-1.5
            min-w-[84px] px-3.5 py-2
            rounded-xl
            text-[12px] font-semibold text-white
            border border-[#4F8CFF]/30
            bg-gradient-to-b from-[#5a96ff] to-[#4F8CFF]
            shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_2px_8px_rgba(79,140,255,0.28)]
            transition-all duration-150
            ${isLoading || !query.trim()
              ? "opacity-50 cursor-not-allowed"
              : "hover:from-[#6aa3ff] hover:to-[#5a96ff] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_4px_14px_rgba(79,140,255,0.38)] active:scale-[0.98] cursor-pointer"
            }
          `}
        >
          {isLoading ? (
            <>
              <FiLoader size={13} className="animate-spin" />
              <span>Search</span>
            </>
          ) : (
            "Search"
          )}
        </button>
      </div>

      {errorCopy && (
        <div
          id="search-error-message"
          role="alert"
          aria-live="polite"
          className={`
            absolute left-0 right-0 top-[calc(100%+10px)] z-[300]
            rounded-xl
            border border-red-500/20
            bg-[rgba(7,17,32,0.94)]
            backdrop-blur-md
            px-4 py-3
            shadow-[0_12px_40px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.04)]
            transition-all duration-300 ease-out
            ${errorVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 -translate-y-1 pointer-events-none"
            }
          `}
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
              <FiAlertCircle size={14} className="text-red-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-red-300 leading-snug">
                {errorCopy.title}
              </p>
              <p className="mt-1 text-[12px] text-[#94A3B8] leading-relaxed">
                {errorCopy.subtitle}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
