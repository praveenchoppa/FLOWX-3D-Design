/**
 * ConnectionLayer.jsx — Electrical wiring overlay (P5D intra + P5E homerun).
 */
import StringWiringLayer from "./StringWiringLayer.jsx";
import HomerunWiringLayer from "./HomerunWiringLayer.jsx";

export default function ConnectionLayer({
  intraSegments = [],
  homerunSegments = [],
  selectedStringId = null,
}) {
  return (
    <>
      {intraSegments.length > 0 && (
        <StringWiringLayer
          segments={intraSegments}
          selectedStringId={selectedStringId}
        />
      )}
      {homerunSegments.length > 0 && (
        <HomerunWiringLayer
          segments={homerunSegments}
          selectedStringId={selectedStringId}
        />
      )}
    </>
  );
}
