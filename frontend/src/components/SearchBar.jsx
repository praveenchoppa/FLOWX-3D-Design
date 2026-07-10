import { useState } from "react";
import { FiSearch } from "react-icons/fi";
import { searchLocation, reverseGeocode } from "../services/geocoding";

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

export default function SearchBar({ setLocation }) {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async () => {
    const q = query.trim();
    if (!q) return;

    setIsLoading(true);
    setError(null);

    try {
      const coords = parseCoords(q);

      if (coords) {
        // Raw coordinate input — reverse-geocode to fill address
        const address = await reverseGeocode(coords.lat, coords.lng);
        setLocation({ address, lat: coords.lat, lng: coords.lng });
        setQuery("");
      } else {
        // Address / city text — forward geocode
        const result = await searchLocation(q);
        if (!result) {
          setError("No results found. Try a different address.");
          return;
        }
        setLocation(result);
        setQuery("");
      }
    } catch {
      setError("Search failed. Check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative">
      <div
        className="
        w-[420px] h-[38px]
        rounded-xl
        border border-[#23324A]
        bg-[rgba(7,17,32,0.8)] backdrop-blur-sm
        flex items-center
        px-4 gap-3
        shadow-[0_0_20px_rgba(79,140,255,0.07)]
        "
      >
        <FiSearch className="text-[#94A3B8] text-sm shrink-0" />

        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSearch();
          }}
          placeholder="Search address, city or coordinates..."
          className="
          flex-1
          bg-transparent
          text-[#F8FAFC] text-sm
          outline-none
          placeholder:text-[#94A3B8]/55
          "
          disabled={isLoading}
        />

        {/* ⌘K hint — hidden while loading */}
        {!isLoading && (
          <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md border border-[#23324A] shrink-0">
            <span className="text-[10px] text-[#94A3B8]/60 leading-none">⌘K</span>
          </div>
        )}

        <button
          onClick={handleSearch}
          disabled={isLoading}
          className={`
          shrink-0
          px-3 py-1
          rounded-lg
          bg-[#4F8CFF]
          text-xs font-semibold text-white
          transition-opacity duration-150
          ${isLoading ? "opacity-55 cursor-not-allowed" : "hover:opacity-90 cursor-pointer"}
          `}
        >
          {isLoading ? "..." : "Search"}
        </button>
      </div>

      {/* Inline error — absolute, drops below the header */}
      {error && (
        <div className="absolute top-full left-0 mt-1.5 z-[9999] px-3 py-1.5 rounded-lg bg-[#071120] border border-red-500/25 text-[11px] text-red-400 whitespace-nowrap shadow-lg">
          {error}
        </div>
      )}
    </div>
  );
}
