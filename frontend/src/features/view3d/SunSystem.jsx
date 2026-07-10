/**
 * SunSystem.jsx — Step 4A simulation visuals (lives inside the 3D <Canvas>).
 *
 * Renders, for the current sun direction:
 *   • one shadow-casting directional light (the sun) + outdoor fill lighting
 *   • the sun's full day-path arc (drei <Line>)
 *   • an emissive sun marker at the current position (hidden below horizon)
 *
 * Inputs are renderer-agnostic plain data computed by features/simulation/solar.js
 * (unit direction vectors in scene space) — this component only scales them by the
 * scene radius and configures Three.js lighting/shadows.
 *
 * These shadows are VISUAL ONLY (shadow-mapping).  The measured shadow/irradiance
 * heatmap is Step 4B and uses a separate raycast pass — nothing here is reused.
 */

import { useRef, useMemo, useEffect } from "react";
import { Line, Html } from "@react-three/drei";
import * as THREE from "three";

const clamp01 = (v) => Math.max(0, Math.min(1, v));

// Warm (low sun) → near-white (high sun); same hue family as the design tokens.
const COLOR_HORIZON = new THREE.Color("#ff8a3d");
const COLOR_ZENITH  = new THREE.Color("#fff3e0");

export default function SunSystem({
  sunDir,         // {x,y,z} unit vector toward the sun
  altitude,       // radians above horizon
  belowHorizon,   // boolean
  arcPoints,      // [{x,y,z}] unit vectors across the day
  arcHours = [],  // [{hour, label, dir}] hourly tick markers
  radius,         // scene bounding radius (metres)
  showSunPath = true,
  castShadows = true,
}) {
  const lightRef = useRef(null);

  // ── Derived scene scales ───────────────────────────────────────────────────
  const R         = Math.max(radius, 8);
  const arcRadius = R * 1.7;          // arc sits above and around the roof
  const lightDist = R * 4;            // far enough for near-parallel sun rays
  const shadowBox = R * 2.4;          // ortho shadow-camera half-extent

  // 0 at horizon → 1 at zenith; drives intensity + colour warmth.
  const t = clamp01(Math.sin(Math.max(altitude, 0)));

  const sunColor = useMemo(
    () => COLOR_HORIZON.clone().lerp(COLOR_ZENITH, t),
    [t],
  );
  const intensity = belowHorizon ? 0 : THREE.MathUtils.lerp(0.55, 1.85, t);

  const lightPos  = [sunDir.x * lightDist, sunDir.y * lightDist, sunDir.z * lightDist];
  const markerPos = [sunDir.x * arcRadius, sunDir.y * arcRadius, sunDir.z * arcRadius];

  const linePoints = useMemo(
    () => arcPoints.map((p) => [p.x * arcRadius, p.y * arcRadius, p.z * arcRadius]),
    [arcPoints, arcRadius],
  );

  // ── Shadow-camera configuration (single caster, sensible quality) ───────────
  useEffect(() => {
    const l = lightRef.current;
    if (!l) return;
    l.shadow.mapSize.set(2048, 2048);
    l.shadow.camera.near = 0.5;
    l.shadow.camera.far  = lightDist * 2.6;
    l.shadow.camera.left   = -shadowBox;
    l.shadow.camera.right  =  shadowBox;
    l.shadow.camera.top    =  shadowBox;
    l.shadow.camera.bottom = -shadowBox;
    l.shadow.bias = -0.0004;
    l.shadow.normalBias = 0.02;
    l.shadow.camera.updateProjectionMatrix();
  }, [lightDist, shadowBox]);

  return (
    <>
      {/* ── Outdoor fill: cool sky ambient + hemisphere, deliberately low so the
           sun's directional shadows read clearly ── */}
      <ambientLight intensity={0.28} color="#cfe0f5" />
      <hemisphereLight args={["#bcd6ff", "#0e1726", 0.45]} />

      {/* ── The sun: one shadow-casting directional light, aimed at the origin
           (default target). Intensity 0 below horizon (night). ── */}
      <directionalLight
        ref={lightRef}
        position={lightPos}
        intensity={intensity}
        color={sunColor}
        castShadow={castShadows}
      />

      {/* ── Sun arc — the day's full path across the sky ── */}
      {showSunPath && linePoints.length > 1 && (
        <Line
          points={linePoints}
          color="#FFB547"
          lineWidth={1.6}
          transparent
          opacity={0.45}
          depthWrite={false}
        />
      )}

      {/* ── Hour labels along the arc ── */}
      {/* Show every other hour when there are many markers to avoid crowding. */}
      {showSunPath && arcHours
        .filter(({ hour }) => arcHours.length <= 8 || hour % 2 === 0)
        .map(({ hour, label, dir }) => {
          const pos = [dir.x * arcRadius, dir.y * arcRadius, dir.z * arcRadius];
          return (
            <Html
              key={hour}
              position={pos}
              center
              zIndexRange={[1, 10]}
              style={{ pointerEvents: "none", userSelect: "none" }}
            >
              <span
                style={{
                  display: "inline-block",
                  fontFamily: "system-ui, sans-serif",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "rgba(255,181,71,0.95)",
                  background: "rgba(7,17,32,0.72)",
                  border: "1px solid rgba(255,181,71,0.28)",
                  borderRadius: "4px",
                  padding: "1px 5px",
                  whiteSpace: "nowrap",
                  letterSpacing: "0.03em",
                  lineHeight: "1.5",
                }}
              >
                {label}
              </span>
            </Html>
          );
        })
      }

      {/* ── Current sun marker (hidden when the sun is below the horizon) ── */}
      {!belowHorizon && (
        <group position={markerPos}>
          {/* core */}
          <mesh>
            <sphereGeometry args={[Math.max(R * 0.05, 0.5), 24, 24]} />
            <meshBasicMaterial color={sunColor} toneMapped={false} />
          </mesh>
          {/* soft glow halo */}
          <mesh>
            <sphereGeometry args={[Math.max(R * 0.09, 0.9), 24, 24]} />
            <meshBasicMaterial
              color={sunColor}
              transparent
              opacity={0.22}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </group>
      )}
    </>
  );
}
