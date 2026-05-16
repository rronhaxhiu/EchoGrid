"use client";

import { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Hexasphere } from "hexasphere";
import { normalizeValue } from "@/lib/utils";

/**
 * Geodesic hex globe using arscan/hexasphere.js.
 *
 * Hexasphere builds a proper icosahedron-subdivided sphere where every tile
 * shares exact edge vertices with its neighbours → perfect tessellation.
 * 12 pentagonal tiles at the icosahedron corners are mathematically unavoidable.
 *
 * Tile counts by subdivision (T = 10s² + 2):
 *   s=1→12  s=2→42  s=3→92  s=4→162  s=5→252  s=6→362
 *
 * Depth fix: hexasphere boundary points sit at ~3.91 with radius=4 due to the
 * tile-shrink algorithm. We renormalize every vertex to LINE_RADIUS (4.025) so
 * all edges are clearly outside the opaque sphere mesh (3.95) and pass the
 * depth test.
 */

const SPHERE_RADIUS = 4;
// Must be > sphere mesh radius (SPHERE_RADIUS - 0.05 = 3.95)
const LINE_RADIUS = SPHERE_RADIUS + 0.025;
// Tile center is pushed to FILL_RADIUS so the fan triangles dome outward
// (flat polygons spanning boundary vertices dip below the sphere surface)
const FILL_RADIUS = SPHERE_RADIUS + 0.18;

// Neon gradient palettes — designed for additive blending on dark backgrounds
const PALETTES: Record<string, [THREE.Color, THREE.Color]> = {
  health:   [new THREE.Color("#cc1133"), new THREE.Color("#00ee77")],
  economy:  [new THREE.Color("#cc4400"), new THREE.Color("#ffcc00")],
  green:    [new THREE.Color("#1a8800"), new THREE.Color("#00ffaa")],
  mobility: [new THREE.Color("#1133bb"), new THREE.Color("#bb22ff")],
};
const GHOST_COLOR = new THREE.Color("#2a1860");

function getColor(t: number, variable: string): THREE.Color {
  const pal = PALETTES[variable] ?? PALETTES.health;
  return pal[0].clone().lerp(pal[1], t);
}

/** Smallest geodesic subdivision count that yields >= n tiles. */
function subdivisionsFor(n: number): number {
  return Math.max(1, Math.ceil(Math.sqrt(Math.max(0, n - 2) / 10)));
}

/** Module-level cache — avoids rebuilding for the same params. */
const hexCache = new Map<string, Hexasphere>();
function getHexasphere(subdivisions: number, radius: number): Hexasphere {
  const key = `${subdivisions}-${radius}`;
  if (!hexCache.has(key)) {
    // tileWidth=1.0 → tiles share exact boundary vertices → no gaps
    hexCache.set(key, new Hexasphere(radius, subdivisions, 1.0));
  }
  return hexCache.get(key)!;
}

/** Build a LineLoop from hexasphere boundary points, reprojected onto LINE_RADIUS. */
function makeLineLoop(
  boundary: { x: number; y: number; z: number }[],
  color: THREE.Color | THREE.ColorRepresentation,
  opacity = 0.85
): { line: THREE.LineLoop; mat: THREE.LineBasicMaterial } {
  const verts = boundary.map((p) =>
    new THREE.Vector3(p.x, p.y, p.z).normalize().multiplyScalar(LINE_RADIUS)
  );
  const geo = new THREE.BufferGeometry().setFromPoints(verts);
  const mat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  return { line: new THREE.LineLoop(geo, mat), mat };
}

interface TileObj {
  line: THREE.LineLoop;
  mat: THREE.LineBasicMaterial;
  targetColor: THREE.Color;
  /** Normalised Y of the tile center (−1 … +1) — used for the latitude ring. */
  normY: number;
  /** Tile center pushed to FILL_RADIUS — fan origin for fill/hit meshes. */
  center: THREE.Vector3;
  /** Invisible mesh covering the full tile interior — used for raycasting. */
  hitMesh: THREE.Mesh;
}

/**
 * Fan-triangulate boundary vertices into a filled mesh using a center point
 * as the fan origin.  Using the tile's actual center (pushed to FILL_RADIUS)
 * instead of a boundary vertex means every triangle fans outward from a point
 * above the sphere surface, so no face can dip below it.
 * Triangles: [center, v_i, v_{(i+1) % n}] for i in 0..n-1.
 */
function buildFanMesh(
  posAttr: THREE.BufferAttribute,
  center: THREE.Vector3,
  material: THREE.Material,
): THREE.Mesh {
  const n = posAttr.count;
  const positions: number[] = [];
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    positions.push(center.x, center.y, center.z);
    positions.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
    positions.push(posAttr.getX(next), posAttr.getY(next), posAttr.getZ(next));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return new THREE.Mesh(geo, material);
}

interface HexGlobeProps {
  tiles: Record<string, Record<string, number>>;
  selectedVariable: string;
  hexRadius: number;
  isAnimating: boolean;
  autoRotate?: boolean;
  selectedTileKey?: string | null;
  onTileClick?: (q: number, r: number, variables: Record<string, number>) => void;
}

export function HexGlobe({
  tiles,
  selectedVariable,
  hexRadius,
  isAnimating,
  autoRotate = true,
  selectedTileKey = null,
  onTileClick,
}: HexGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const globeGroupRef = useRef<THREE.Group | null>(null);
  const tileLayerRef = useRef<THREE.Group | null>(null);
  const tileObjsRef = useRef<Map<string, TileObj>>(new Map());
  const frameRef = useRef<number>(0);
  const prevKeysRef = useRef<string>("");
  const isAnimatingRef = useRef(isAnimating);
  const autoRotateRef = useRef(autoRotate);
  const selectedTileKeyRef = useRef(selectedTileKey);
  const selectedHighlightRef = useRef<THREE.Mesh | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());

  useEffect(() => {
    isAnimatingRef.current = isAnimating;
  }, [isAnimating]);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    selectedTileKeyRef.current = selectedTileKey;
  }, [selectedTileKey]);

  const getMinMax = useCallback(
    (variable: string): [number, number] => {
      let min = Infinity, max = -Infinity;
      for (const vars of Object.values(tiles)) {
        const v = vars[variable];
        if (v !== undefined) {
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
      return min === Infinity ? [0, 100] : min === max ? [min - 1, max + 1] : [min, max];
    },
    [tiles]
  );

  // ─── Init Three.js scene (once) ───────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const W = container.clientWidth;
    const H = container.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 200);
    camera.position.set(0, 0, 12);
    cameraRef.current = camera;

    const scene = new THREE.Scene();

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.rotateSpeed = 0.4;
    controls.zoomSpeed = 0.8;
    controls.minDistance = 7;
    controls.maxDistance = 22;
    controlsRef.current = controls;

    const globeGroup = new THREE.Group();
    scene.add(globeGroup);
    globeGroupRef.current = globeGroup;

    // Opaque dark planet body — tiles sit on top via depth test
    globeGroup.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(SPHERE_RADIUS - 0.05, 48, 48),
        new THREE.MeshBasicMaterial({ color: 0x05030e })
      )
    );

    // Atmospheric glow
    globeGroup.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(SPHERE_RADIUS + 0.4, 48, 48),
        new THREE.MeshBasicMaterial({
          color: 0x4400aa, side: THREE.BackSide, transparent: true, opacity: 0.1,
        })
      )
    );
    globeGroup.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(SPHERE_RADIUS + 0.9, 48, 48),
        new THREE.MeshBasicMaterial({
          color: 0x7722ee, side: THREE.BackSide, transparent: true, opacity: 0.04,
        })
      )
    );

    // Stars
    const N = 1800;
    const sPos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const t = Math.random() * Math.PI * 2;
      const p = Math.acos(2 * Math.random() - 1);
      const r = 50 + Math.random() * 20;
      sPos[i * 3]     = r * Math.sin(p) * Math.cos(t);
      sPos[i * 3 + 1] = r * Math.sin(p) * Math.sin(t);
      sPos[i * 3 + 2] = r * Math.cos(p);
    }
    const sGeo = new THREE.BufferGeometry();
    sGeo.setAttribute("position", new THREE.Float32BufferAttribute(sPos, 3));
    scene.add(new THREE.Points(sGeo, new THREE.PointsMaterial({
      color: 0xffffff, size: 0.08, transparent: true, opacity: 0.45,
    })));

    // Tile layer — cleared and rebuilt per simulation run
    const tileLayer = new THREE.Group();
    globeGroup.add(tileLayer);
    tileLayerRef.current = tileLayer;
    buildGhostLayer(tileLayer);

    // ─── Animation loop ────────────────────────────────────────────────────
    // Ring effect: a band of increased brightness sweeps slowly from pole to
    // pole based on each tile's latitude (normY). No opacity pulsing.
    function animate(time: number) {
      frameRef.current = requestAnimationFrame(animate);
      controls.update();

      if (autoRotateRef.current) {
        globeGroup.rotation.y += isAnimatingRef.current ? 0.0018 : 0.0007;
      }

      if (tileObjsRef.current.size > 0) {
        // Ring phase: full cycle every ~18 s
        const ringPhase = time * 0.00035;
        const selKey = selectedTileKeyRef.current;
        tileObjsRef.current.forEach(({ mat, targetColor, normY }, key) => {
          mat.color.lerp(targetColor, 0.07);
          if (selKey && key === selKey) {
            mat.opacity = 1.0;
          } else {
            // Latitude ring: gentle brightness band, range 0.72 → 1.0
            const wave = 0.5 + 0.5 * Math.sin(normY * Math.PI + ringPhase);
            mat.opacity = 0.72 + 0.28 * wave;
          }
        });
      }

      // Pulse the fill highlight mesh
      if (selectedHighlightRef.current) {
        const fillMat = selectedHighlightRef.current.material as THREE.MeshBasicMaterial;
        fillMat.opacity = 0.25 + 0.15 * (0.5 + 0.5 * Math.sin(time * 0.004));
      }

      renderer.render(scene, camera);
    }
    requestAnimationFrame(animate);

    const onResize = () => {
      const w = container.clientWidth, h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", onResize);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement))
        container.removeChild(renderer.domElement);
    };
  }, []);

  // ─── Rebuild tile geometry when tile set changes ───────────────────────────
  useEffect(() => {
    const layer = tileLayerRef.current;
    if (!layer) return;

    const keys = Object.keys(tiles);
    const keysStr = keys.sort().join(",");
    if (keysStr === prevKeysRef.current) return;
    prevKeysRef.current = keysStr;

    layer.clear();
    tileObjsRef.current.clear();

    if (keys.length === 0) {
      buildGhostLayer(layer);
      return;
    }

    const n = keys.length;
    const subdivisions = subdivisionsFor(n);
    const hexsphere = getHexasphere(subdivisions, SPHERE_RADIUS);
    const [min, max] = getMinMax(selectedVariable);
    const sortedKeys = [...keys].sort();

    hexsphere.tiles.forEach((geoTile, i) => {
      const key = sortedKeys[i];
      const isData = key !== undefined;
      const vars = isData ? tiles[key] : {};
      const val = (vars as Record<string, number>)[selectedVariable] ?? 0;
      const t = isData ? normalizeValue(val, min, max) : 0;
      const color = isData ? getColor(t, selectedVariable) : GHOST_COLOR.clone();
      const opacity = isData ? 0.85 : 0.4;

      const { line, mat } = makeLineLoop(geoTile.boundary, color, opacity);
      line.userData = { key: key ?? null };
      layer.add(line);

      if (isData) {
        // Tile center pushed to FILL_RADIUS — fan origin for fill / hit meshes
        const center = new THREE.Vector3(
          geoTile.centerPoint.x,
          geoTile.centerPoint.y,
          geoTile.centerPoint.z,
        ).normalize().multiplyScalar(FILL_RADIUS);

        // Invisible hit mesh so clicking anywhere inside the tile registers
        const hitMat = new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: 0,
          depthWrite: false,
          side: THREE.FrontSide,
        });
        const posAttr = line.geometry.attributes.position as THREE.BufferAttribute;
        const hitMesh = buildFanMesh(posAttr, center, hitMat);
        hitMesh.userData = { key };
        layer.add(hitMesh);

        const normY = geoTile.centerPoint.y / SPHERE_RADIUS;
        tileObjsRef.current.set(key, { line, mat, targetColor: color.clone(), normY, center, hitMesh });
      }
    });
  }, [tiles, getMinMax, selectedVariable]);

  // ─── Update colors without rebuilding geometry ────────────────────────────
  useEffect(() => {
    if (tileObjsRef.current.size === 0) return;
    const [min, max] = getMinMax(selectedVariable);
    tileObjsRef.current.forEach((obj, key) => {
      const vars = tiles[key] ?? {};
      const val = vars[selectedVariable] ?? 0;
      const t = normalizeValue(val, min, max);
      obj.targetColor.copy(getColor(t, selectedVariable));
    });
  }, [selectedVariable, tiles, getMinMax]);

  // ─── Selected tile fill highlight ─────────────────────────────────────────
  useEffect(() => {
    // Tear down previous fill mesh
    const prev = selectedHighlightRef.current;
    if (prev) {
      prev.parent?.remove(prev);
      prev.geometry.dispose();
      (prev.material as THREE.Material).dispose();
      selectedHighlightRef.current = null;
    }

    const layer = tileLayerRef.current;
    if (!selectedTileKey || !layer) return;

    const tileObj = tileObjsRef.current.get(selectedTileKey);
    if (!tileObj) return;

    const posAttr = tileObj.line.geometry.attributes.position as THREE.BufferAttribute;
    const fillColor = tileObj.targetColor.clone().lerp(new THREE.Color("#ffffff"), 0.55);
    const fillMat = new THREE.MeshBasicMaterial({
      color: fillColor,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      // depthTest off so the dome faces never get clipped by the sphere body
      depthTest: false,
    });
    const mesh = buildFanMesh(posAttr, tileObj.center, fillMat);
    layer.add(mesh);
    selectedHighlightRef.current = mesh;
  }, [selectedTileKey]);

  // ─── Click / raycasting ───────────────────────────────────────────────────
  useEffect(() => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    if (!renderer || !camera || !onTileClick) return;

    function onClick(e: MouseEvent) {
      if (!renderer || !camera) return;
      const rect = renderer.domElement.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      const hitMeshes = Array.from(tileObjsRef.current.values()).map((t) => t.hitMesh);
      const hits = raycasterRef.current.intersectObjects(hitMeshes);
      if (hits.length > 0) {
        const { key } = hits[0].object.userData as { key: string | null };
        if (key) {
          const [q, r] = key.split(",").map(Number);
          onTileClick?.(q, r, tiles[key] ?? {});
        }
      }
    }

    renderer.domElement.addEventListener("click", onClick);
    return () => renderer.domElement.removeEventListener("click", onClick);
  }, [onTileClick, tiles]);

  return <div ref={containerRef} className="w-full h-full" />;
}

// ─── Ghost layer helper ───────────────────────────────────────────────────────
function buildGhostLayer(layer: THREE.Group) {
  const hexsphere = getHexasphere(3, SPHERE_RADIUS); // s=3 = 92 nicely-sized tiles
  hexsphere.tiles.forEach((tile) => {
    const { line } = makeLineLoop(tile.boundary, GHOST_COLOR, 0.5);
    layer.add(line);
  });
}
