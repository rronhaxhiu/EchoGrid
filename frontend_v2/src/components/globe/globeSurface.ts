import * as THREE from "three";

export type GlobeSurfaceMode = "hex" | "earth";

const WATER_TOP = "#071b32";
const WATER_BOTTOM = "#02101f";
const LAND = "#2f6f4f";
const LAND_HIGHLIGHT = "#75b66f";
const ICE = "#d7edf2";

let earthTexture: THREE.CanvasTexture | null = null;
const materialCache = new Map<GlobeSurfaceMode, THREE.MeshBasicMaterial>();

function project(lon: number, lat: number, width: number, height: number) {
  return {
    x: ((lon + 180) / 360) * width,
    y: ((90 - lat) / 180) * height,
  };
}

function drawPolygon(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  points: Array<[number, number]>,
) {
  if (points.length === 0) return;
  const first = project(points[0][0], points[0][1], width, height);
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < points.length; i++) {
    const point = project(points[i][0], points[i][1], width, height);
    ctx.lineTo(point.x, point.y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawLatBand(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.strokeStyle = "rgba(160, 220, 255, 0.08)";
  ctx.lineWidth = 1;
  for (let lat = -60; lat <= 60; lat += 30) {
    const y = project(0, lat, width, height).y;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawLand(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.fillStyle = LAND;
  ctx.strokeStyle = "rgba(172, 255, 190, 0.35)";
  ctx.lineWidth = 2;

  const continents: Array<Array<[number, number]>> = [
    // North America
    [[-168, 68], [-140, 72], [-110, 70], [-80, 56], [-58, 48], [-62, 30], [-90, 16], [-104, 22], [-118, 34], [-130, 50], [-154, 58]],
    // South America
    [[-82, 12], [-68, 10], [-50, -2], [-38, -18], [-46, -36], [-58, -55], [-72, -48], [-76, -28], [-84, -10]],
    // Europe and Asia
    [[-10, 36], [8, 58], [36, 70], [74, 66], [112, 58], [148, 48], [170, 60], [180, 44], [152, 26], [124, 18], [102, 4], [78, 8], [58, 24], [34, 28], [12, 36]],
    // Africa
    [[-18, 32], [8, 36], [34, 28], [48, 10], [42, -18], [28, -34], [12, -36], [-6, -24], [-14, -2]],
    // Australia
    [[112, -12], [132, -10], [154, -24], [146, -42], [118, -38], [108, -24]],
    // Greenland
    [[-54, 82], [-30, 76], [-24, 64], [-44, 58], [-62, 66], [-72, 76]],
    // Antarctica
    [[-180, -66], [-120, -72], [-60, -68], [0, -74], [60, -68], [120, -72], [180, -66], [180, -90], [-180, -90]],
  ];

  continents.forEach((continent) => drawPolygon(ctx, width, height, continent));

  ctx.fillStyle = LAND_HIGHLIGHT;
  ctx.globalAlpha = 0.2;
  continents.slice(0, -1).forEach((continent) => drawPolygon(ctx, width, height, continent));
  ctx.globalAlpha = 1;

  ctx.fillStyle = ICE;
  drawPolygon(ctx, width, height, [[-180, -72], [-120, -78], [-40, -74], [40, -79], [120, -75], [180, -72], [180, -90], [-180, -90]]);
}

function createEarthTexture(): THREE.CanvasTexture {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not create globe texture canvas context");
  }

  const ocean = ctx.createLinearGradient(0, 0, 0, height);
  ocean.addColorStop(0, WATER_TOP);
  ocean.addColorStop(0.55, "#04345a");
  ocean.addColorStop(1, WATER_BOTTOM);
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, width, height);

  drawLatBand(ctx, width, height);
  drawLand(ctx, width, height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

function getEarthTexture(maxAnisotropy: number) {
  if (!earthTexture) {
    earthTexture = createEarthTexture();
  }
  earthTexture.anisotropy = Math.max(1, Math.min(maxAnisotropy, 8));
  return earthTexture;
}

export function getGlobeSurfaceMaterial(
  mode: GlobeSurfaceMode,
  maxAnisotropy = 1,
): THREE.MeshBasicMaterial {
  const cached = materialCache.get(mode);
  if (cached) return cached;

  const material =
    mode === "earth"
      ? new THREE.MeshBasicMaterial({
          map: getEarthTexture(maxAnisotropy),
          color: 0xffffff,
        })
      : new THREE.MeshBasicMaterial({ color: 0x05030e });

  materialCache.set(mode, material);
  return material;
}
