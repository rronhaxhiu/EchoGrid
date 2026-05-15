# EchoGrid Frontend

Next.js app with **[CesiumJS](https://cesium.com/platform/cesiumjs/)** and **[Uber H3](https://h3geo.org/)** — geographic hex cells on the globe, colored and extruded by simulation variables (similar in spirit to [HexGlobe](https://github.com/ValyrianTech/HexGlobe)’s H3 + globe stack).

## Prerequisites

- Node 20+
- Backend at `http://localhost:8000` (see `../backend/README.md`)

## Setup

```bash
cd frontend
cp .env.local.example .env.local   # optional — defaults to localhost:8000
npm install                          # runs postinstall → copies Cesium → public/cesium/
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Note:** `npm run dev` / `npm run build` use **`--webpack`** so Cesium bundles correctly under Next.js 16.

## How it works

1. Loads the latest simulation run (or creates a demo run).
2. Maps each axial `(q,r)` tile center to lat/lng (`src/lib/hex-math.ts`).
3. Enumerates **Uber H3** cells over **continental land** (Natural Earth 110m) with an adaptive lat/lng sampler so coverage is dense and cells sit edge-to-edge at the chosen resolution (capped for GPU/CPU).
4. Simulation tile centers are mapped across **almost the full globe** (see `hex-math.ts`) and values on land are **inverse-distance weighted** from those centers. **Ocean has no meshes** (invisible); the backend/simulation is unchanged.
5. Coastal refinement: drops an H3 cell if its **center** falls in water, reducing “ocean hex” artifacts.

## Tuning (density vs performance)

| Constant | Location | Effect |
|----------|-----------|--------|
| `H3_RESOLUTION` | `echo-grid-dashboard.tsx` | **Higher** → smaller H3 hexes, more detail (with same cap, sampling auto-coarsens). |
| `LAND_SAMPLE_STEP_DEG` | same | Lower → denser land sampling → more complete H3 cover before cap. |
| `MAX_LAND_CELLS` | same | Hard cap; if exceeded, sampling step is relaxed automatically. |

Cesium: `maximumScreenSpaceError`, `tileCacheSize`, depth test against globe, fog — see `cesium-h3-globe.tsx`.

[H3 pentagon cells](https://h3geo.org/docs/core-library/coordsystems#icosahedron-vertices) exist at 12 icosahedron vertices; boundaries still render, but layouts can look special — same caveat as HexGlobe docs.

### PEELS / alternative partitions

For equal-area spherical layouts beyond H3’s icosahedral scheme, see [Peels](https://g-e-o-f.github.io/peels/) — useful reference if we later swap or blend indexing; not wired in yet.

## Configuration

| Constant | File | Purpose |
|----------|------|---------|
| `H3_RESOLUTION` | `echo-grid-dashboard.tsx` | H3 resolution 0–15 (smaller hexes = higher number) |
| `DEFAULT_VARIABLE` | same | Which tile variable drives color/height (`health`, etc.) |
| `extrusionScale` | `cesium-h3-globe.tsx` | How tall extrusions grow with value |

## Legacy WebGL globe (optional)

`public/globe/` still holds [webgl-globe](https://github.com/dataarts/webgl-globe) + r58 Three — unused by default; keep if you experiment with `GlobeView`.
