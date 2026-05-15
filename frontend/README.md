# EchoGrid Frontend

Next.js dashboard with the [WebGL Globe](https://github.com/dataarts/webgl-globe) (`DAT.Globe`) wired to the hex simulation API.

## Prerequisites

- Node 20+
- Backend running at `http://localhost:8000` (see `../backend/README.md`)

## Setup

```bash
cd frontend
cp .env.local.example .env.local   # optional — defaults to localhost:8000
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Globe assets

Legacy Three.js r58 and textures live under `public/globe/`:

- `three.min.js` — **do not** replace with `npm install three` (breaks `globe.js`)
- `globe.js` — `DAT.Globe` renderer
- `world.jpg` — Earth texture

## Usage

1. Start the FastAPI backend.
2. Open http://localhost:3000 — fullscreen globe only (no controls).
3. The app auto-loads the latest run (or creates a demo run) and renders a **dense land lattice** (~1.1° spacing) using [Natural Earth land](https://github.com/nvkelso/natural-earth-vector) to skip oceans. Hex tile variables are sampled onto land via inverse-distance weighting (`health` by default).

Adjust density in `src/components/echo-grid-dashboard.tsx` (`LAND_STEP_DEG` — lower = more points).
