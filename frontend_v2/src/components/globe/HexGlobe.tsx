"use client";

import { useEffect, useRef } from "react";
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
    // NormalBlending so dark colours actually paint over the fill below.
    // AdditiveBlending of near-black contributes nothing.
    blending: THREE.NormalBlending,
    depthWrite: false,
    depthTest: false,
  });
  const line = new THREE.LineLoop(geo, mat);
  // Render after fill meshes (renderOrder 0) so the border always sits on top
  line.renderOrder = 1;
  return { line, mat };
}

interface TileObj {
  line: THREE.LineLoop;
  mat: THREE.LineBasicMaterial;
  /** Filled polygon mesh that shows the variable color. */
  fill: THREE.Mesh;
  fillMat: THREE.MeshBasicMaterial;
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

  // Keep latest props accessible inside the long-lived animation loop closure.
  // useEffect deps are unreliable for this — refs are the correct React/Three.js pattern.
  const selectedVariableRef = useRef(selectedVariable);
  const tilesRef = useRef(tiles);
  // Track what was last rendered so we only recompute when something changed.
  const lastColorVariableRef = useRef("");
  const lastColorTilesRef = useRef<typeof tiles | null>(null);

  useEffect(() => {
    isAnimatingRef.current = isAnimating;
  }, [isAnimating]);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    selectedTileKeyRef.current = selectedTileKey;
  }, [selectedTileKey]);

  useEffect(() => {
    selectedVariableRef.current = selectedVariable;
  }, [selectedVariable]);

  useEffect(() => {
    tilesRef.current = tiles;
  }, [tiles]);

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
        // ── Recompute target colors whenever variable or tile data changes ──
        // This runs inside the animation loop (via refs) so it's never stale
        // regardless of React effect scheduling or closure captures.
        const curVariable = selectedVariableRef.current;
        const curTiles = tilesRef.current;
        if (
          curVariable !== lastColorVariableRef.current ||
          curTiles !== lastColorTilesRef.current
        ) {
          lastColorVariableRef.current = curVariable;
          lastColorTilesRef.current = curTiles;

          // Compute min/max for the active variable
          let cMin = Infinity, cMax = -Infinity;
          for (const vars of Object.values(curTiles)) {
            const v = (vars as Record<string, number>)[curVariable];
            if (v !== undefined) {
              if (v < cMin) cMin = v;
              if (v > cMax) cMax = v;
            }
          }
          if (cMin === Infinity) { cMin = 0; cMax = 100; }
          else if (cMin === cMax) { cMin -= 1; cMax += 1; }

          tileObjsRef.current.forEach((obj, key) => {
            const vars = curTiles[key] ?? {};
            const val = vars[curVariable] ?? 0;
            const t = normalizeValue(val, cMin, cMax);
            const newColor = getColor(t, curVariable);
            obj.targetColor.copy(newColor);
            // Apply immediately so the change is visible on the very next frame
            obj.fillMat.color.copy(newColor);
          });
        }

        // Ring phase: full cycle every ~18 s
        const ringPhase = time * 0.00035;
        const selKey = selectedTileKeyRef.current;
        tileObjsRef.current.forEach(({ fillMat, targetColor, normY }, key) => {
          // Smoothly chase the target color (live tick updates)
          fillMat.color.lerp(targetColor, 0.07);

          if (selKey && key === selKey) {
            fillMat.opacity = 0.65;
          } else {
            const wave = 0.5 + 0.5 * Math.sin(normY * Math.PI + ringPhase);
            fillMat.opacity = 0.30 + 0.20 * wave;
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

    // Compute initial colors using the current variable snapshot.
    // (Colors are kept fresh in the animation loop via refs; this just sets
    //  the starting state so tiles aren't black on first render.)
    const initVariable = selectedVariableRef.current;
    const initTiles = tilesRef.current;
    let iMin = Infinity, iMax = -Infinity;
    for (const vars of Object.values(initTiles)) {
      const v = (vars as Record<string, number>)[initVariable];
      if (v !== undefined) {
        if (v < iMin) iMin = v;
        if (v > iMax) iMax = v;
      }
    }
    if (iMin === Infinity) { iMin = 0; iMax = 100; }
    else if (iMin === iMax) { iMin -= 1; iMax += 1; }
    // Force next animation-loop color pass by resetting the cache keys
    lastColorVariableRef.current = "";
    lastColorTilesRef.current = null;

    const sortedKeys = [...keys].sort();

    hexsphere.tiles.forEach((geoTile, i) => {
      const key = sortedKeys[i];
      const isData = key !== undefined;
      const vars = isData ? initTiles[key] : {};
      const val = (vars as Record<string, number>)[initVariable] ?? 0;
      const t = isData ? normalizeValue(val, iMin, iMax) : 0;
      const color = isData ? getColor(t, initVariable) : GHOST_COLOR.clone();

      if (isData) {
        // Tile center pushed to FILL_RADIUS — fan origin for fill / hit meshes
        const center = new THREE.Vector3(
          geoTile.centerPoint.x,
          geoTile.centerPoint.y,
          geoTile.centerPoint.z,
        ).normalize().multiplyScalar(FILL_RADIUS);

        // Dummy line so TileObj.line / mat fields remain populated (raycasting
        // uses hitMesh, but the field is still referenced elsewhere).
        const { line, mat } = makeLineLoop(geoTile.boundary, GHOST_COLOR, 0);
        line.userData = { key };

        const posAttr = line.geometry.attributes.position as THREE.BufferAttribute;

        // Visible fill mesh — carries the variable color
        const fillMat = new THREE.MeshBasicMaterial({
          color: color.clone(),
          transparent: true,
          opacity: 0.25,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          depthTest: false,
          side: THREE.FrontSide,
        });
        const fill = buildFanMesh(posAttr, center, fillMat);
        layer.add(fill);

        // Invisible hit mesh so clicking anywhere inside the tile registers
        const hitMat = new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: 0,
          depthWrite: false,
          side: THREE.FrontSide,
        });
        const hitMesh = buildFanMesh(posAttr, center, hitMat);
        hitMesh.userData = { key };
        layer.add(hitMesh);

        const normY = geoTile.centerPoint.y / SPHERE_RADIUS;
        tileObjsRef.current.set(key, { line, mat, fill, fillMat, targetColor: color.clone(), normY, center, hitMesh });
      } else {
        // Ghost tile — keep the dim outline so the sphere shows a grid at rest
        const { line } = makeLineLoop(geoTile.boundary, GHOST_COLOR, 0.4);
        layer.add(line);
      }
    });
  // selectedVariable intentionally NOT in deps — color updates happen in the
  // animation loop via refs, which is always fresh. This effect only rebuilds
  // geometry when the set of tile keys changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiles]);

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
