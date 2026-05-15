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
2. Open the UI and click **Demo run +12 ticks** if no runs exist.
3. Pick a **run** and **variable**; scrub **Simulation time** to morph between snapshots (`globe.time`).

Hex tiles `(q, r)` are projected to lat/lng for display; magnitude is the selected variable per tile.
