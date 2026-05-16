"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Hexasphere } from "hexasphere";
import { normalizeValue } from "@/lib/utils";

const SPHERE_RADIUS = 4;
const SURFACE_BASE_RADIUS = SPHERE_RADIUS + 0.04;
const FIELD_EXTENT = 5.4;

const PALETTES: Record<string, [THREE.Color, THREE.Color]> = {
  health: [new THREE.Color("#cc1133"), new THREE.Color("#00ee77")],
  economy: [new THREE.Color("#cc4400"), new THREE.Color("#ffcc00")],
  green: [new THREE.Color("#1a8800"), new THREE.Color("#00ffaa")],
  mobility: [new THREE.Color("#1133bb"), new THREE.Color("#bb22ff")],
};

const PEST_LOW = new THREE.Color("#22c55e");
const PEST_MID = new THREE.Color("#facc15");
const PEST_HIGH = new THREE.Color("#ef4444");
const GHOST_COLOR = new THREE.Color("#2a1860");
const UP = new THREE.Vector3(0, 1, 0);
const NORTH = new THREE.Vector3(0, 1, 0);
const EAST = new THREE.Vector3(1, 0, 0);
const TEMP_A = new THREE.Vector3();
const TEMP_B = new THREE.Vector3();
const TEMP_C = new THREE.Vector3();

export type GlobeSurfaceMode = "globe" | "field";
export type GlobeVisualizationMode = "parameter" | "pest";

interface PolygonFrame {
  baseCenter: THREE.Vector3;
  normal: THREE.Vector3;
  points: THREE.Vector2[];
}

interface TileObj {
  bodyGroup: THREE.Group;
  currentHeight: number;
  grass: THREE.Group;
  hitMesh: THREE.Mesh;
  riskScore: number;
  root: THREE.Group;
  sideMat: THREE.MeshBasicMaterial;
  targetColor: THREE.Color;
  targetHeight: number;
  topGroup: THREE.Group;
  topLine: THREE.LineLoop;
  topMat: THREE.MeshBasicMaterial;
}

function getColor(t: number, variable: string): THREE.Color {
  const palette = PALETTES[variable] ?? PALETTES.health;
  return palette[0].clone().lerp(palette[1], t);
}

function getPestColor(score: number): THREE.Color {
  if (score < 0.5) {
    return PEST_LOW.clone().lerp(PEST_MID, score / 0.5);
  }
  return PEST_MID.clone().lerp(PEST_HIGH, (score - 0.5) / 0.5);
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function derivePestRiskScore(vars: Record<string, number>) {
  const health = clamp01((vars.health ?? 0) / 100);
  const green = clamp01((vars.green ?? 0) / 100);
  const mobility = clamp01((vars.mobility ?? 0) / 100);
  const economy = clamp01((vars.economy ?? 0) / 100);

  return clamp01(
    (1 - green) * 0.4 +
      (1 - health) * 0.35 +
      mobility * 0.15 +
      economy * 0.1
  );
}

function subdivisionsFor(n: number): number {
  return Math.max(1, Math.ceil(Math.sqrt(Math.max(0, n - 2) / 10)));
}

const hexCache = new Map<string, Hexasphere>();
function getHexasphere(subdivisions: number, radius: number): Hexasphere {
  const key = `${subdivisions}-${radius}`;
  if (!hexCache.has(key)) {
    hexCache.set(key, new Hexasphere(radius, subdivisions, 1.0));
  }
  return hexCache.get(key)!;
}

function computeTargetHeight(
  score: number,
  mode: GlobeSurfaceMode,
  visualizationMode: GlobeVisualizationMode
) {
  if (mode === "field") {
    const compressed =
      visualizationMode === "pest"
        ? Math.max(0, (score - 0.34) / 0.66)
        : Math.max(0, (score - 0.45) / 0.55);
    return 0.04 + compressed * 2.9;
  }

  return 0.06 + score * (visualizationMode === "pest" ? 0.92 : 0.72);
}

function fieldHexSize(hexRadius: number) {
  return Math.min(0.74, FIELD_EXTENT / Math.max(3, hexRadius * 2.7));
}

function axialToFieldCenter(q: number, r: number, hexRadius: number) {
  const size = fieldHexSize(hexRadius);
  return new THREE.Vector3(
    size * Math.sqrt(3) * (q + r / 2),
    0,
    size * 1.5 * r
  );
}

function regularHexPoints(radius: number) {
  const points: THREE.Vector2[] = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = Math.PI / 6 + (Math.PI / 3) * i;
    points.push(new THREE.Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius));
  }
  return points;
}

function makeFieldPolygonFrame(key: string, hexRadius: number): PolygonFrame {
  const [q, r] = key.split(",").map(Number);
  const size = fieldHexSize(hexRadius);

  return {
    baseCenter: axialToFieldCenter(q, r, hexRadius),
    normal: UP.clone(),
    points: regularHexPoints(size * 0.94),
  };
}

function makeGlobePolygonFrame(tile: Hexasphere["tiles"][number]): PolygonFrame {
  const boundaryCenter = tile.boundary.reduce<THREE.Vector3>(
    (sum, point) => sum.add(new THREE.Vector3(point.x, point.y, point.z)),
    new THREE.Vector3()
  );
  boundaryCenter.divideScalar(tile.boundary.length);

  const normal = boundaryCenter.normalize();
  const baseCenter = normal.clone().multiplyScalar(SURFACE_BASE_RADIUS);

  const projectedNorth = TEMP_A
    .copy(NORTH)
    .sub(TEMP_B.copy(normal).multiplyScalar(NORTH.dot(normal)));
  const tangent =
    projectedNorth.lengthSq() > 1e-6
      ? projectedNorth.normalize().clone()
      : TEMP_A
          .copy(EAST)
          .sub(TEMP_B.copy(normal).multiplyScalar(EAST.dot(normal)))
          .normalize()
          .clone();
  const bitangent = TEMP_B.copy(normal).cross(tangent).normalize().clone();

  const points = tile.boundary.map((point) => {
    const surfacePoint = new THREE.Vector3(point.x, point.y, point.z)
      .normalize()
      .multiplyScalar(SURFACE_BASE_RADIUS);
    const delta = TEMP_C.copy(surfacePoint).sub(baseCenter);
    return new THREE.Vector2(delta.dot(tangent), delta.dot(bitangent));
  });

  return {
    baseCenter,
    normal,
    points,
  };
}

function buildCapGeometry(points: THREE.Vector2[]) {
  const positions: number[] = [];
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    positions.push(0, 0, 0);
    positions.push(current.x, 0, current.y);
    positions.push(next.x, 0, next.y);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

function buildSideGeometry(points: THREE.Vector2[]) {
  const positions: number[] = [];
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];

    positions.push(current.x, 0, current.y);
    positions.push(next.x, 0, next.y);
    positions.push(next.x, 1, next.y);

    positions.push(current.x, 0, current.y);
    positions.push(next.x, 1, next.y);
    positions.push(current.x, 1, current.y);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function buildTopLine(points: THREE.Vector2[]) {
  const vertices = points.map((point) => new THREE.Vector3(point.x, 0, point.y));
  const geometry = new THREE.BufferGeometry().setFromPoints(vertices);
  const material = new THREE.LineBasicMaterial({
    color: "#dbeafe",
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    depthTest: false,
  });
  const line = new THREE.LineLoop(geometry, material);
  line.renderOrder = 6;
  return line;
}

function randomPointInHex(radius: number, seed: number) {
  const angle = ((seed * 73.421) % 360) * (Math.PI / 180);
  const radial = Math.sqrt(((seed * 37.217) % 1000) / 1000) * radius * 0.84;
  return new THREE.Vector3(Math.cos(angle) * radial, 0, Math.sin(angle) * radial);
}

function createGrassPatch(points: THREE.Vector2[]) {
  const group = new THREE.Group();
  const radius = Math.max(...points.map((point) => point.length()));
  const bladeGeo = new THREE.PlaneGeometry(0.065, 0.26);
  const bladeMat = new THREE.MeshBasicMaterial({
    color: "#67e88b",
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const primary = new THREE.InstancedMesh(bladeGeo, bladeMat, 18);
  const cross = new THREE.InstancedMesh(bladeGeo, bladeMat, 18);
  const matrix = new THREE.Matrix4();
  const quaternionA = new THREE.Quaternion();
  const quaternionB = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const position = new THREE.Vector3();

  for (let i = 0; i < 18; i += 1) {
    const point = randomPointInHex(radius, i + 1);
    position.set(point.x, 0.14 + (i % 4) * 0.012, point.z);
    quaternionA.setFromEuler(new THREE.Euler(0, ((i * 19) % 360) * (Math.PI / 180), 0.12));
    scale.setScalar(0.82 + (i % 5) * 0.06);
    matrix.compose(position, quaternionA, scale);
    primary.setMatrixAt(i, matrix);

    quaternionB.setFromEuler(
      new THREE.Euler(0, ((i * 19 + 90) % 360) * (Math.PI / 180), -0.1)
    );
    matrix.compose(position, quaternionB, scale);
    cross.setMatrixAt(i, matrix);
  }

  primary.instanceMatrix.needsUpdate = true;
  cross.instanceMatrix.needsUpdate = true;
  primary.renderOrder = 7;
  cross.renderOrder = 7;

  group.add(primary);
  group.add(cross);
  group.position.y = 0.02;
  return group;
}

function createTileMesh(frame: PolygonFrame) {
  const root = new THREE.Group();
  root.position.copy(frame.baseCenter);
  if (!frame.normal.equals(UP)) {
    root.quaternion.setFromUnitVectors(UP, frame.normal);
  }

  const bottomGeometry = buildCapGeometry(frame.points);
  const topGeometry = buildCapGeometry(frame.points);
  const sideGeometry = buildSideGeometry(frame.points);

  const bottomMat = new THREE.MeshBasicMaterial({
    color: "#0f172a",
    transparent: true,
    opacity: 0.84,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const sideMat = new THREE.MeshBasicMaterial({
    color: "#475569",
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const topMat = new THREE.MeshBasicMaterial({
    color: "#cbd5e1",
    transparent: true,
    opacity: 0.32,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const bottom = new THREE.Mesh(bottomGeometry, bottomMat);
  bottom.renderOrder = 1;
  root.add(bottom);

  const bodyGroup = new THREE.Group();
  const side = new THREE.Mesh(sideGeometry, sideMat);
  side.renderOrder = 2;
  bodyGroup.add(side);
  root.add(bodyGroup);

  const topGroup = new THREE.Group();
  const top = new THREE.Mesh(topGeometry, topMat);
  top.renderOrder = 5;
  topGroup.add(top);
  const topLine = buildTopLine(frame.points);
  topGroup.add(topLine);
  const grass = createGrassPatch(frame.points);
  grass.visible = false;
  topGroup.add(grass);
  root.add(topGroup);

  const hitMesh = new THREE.Mesh(
    topGeometry.clone(),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  topGroup.add(hitMesh);

  return {
    bodyGroup,
    grass,
    hitMesh,
    root,
    sideMat,
    topGroup,
    topLine,
    topMat,
  };
}

interface HexGlobeProps {
  autoRotate?: boolean;
  hexRadius: number;
  isAnimating: boolean;
  onTileClick?: (q: number, r: number, variables: Record<string, number>) => void;
  selectedTileKey?: string | null;
  selectedVariable: string;
  surfaceMode?: GlobeSurfaceMode;
  tiles: Record<string, Record<string, number>>;
  visualizationMode?: GlobeVisualizationMode;
}

export function HexGlobe({
  tiles,
  selectedVariable,
  hexRadius,
  isAnimating,
  autoRotate = true,
  selectedTileKey = null,
  onTileClick,
  surfaceMode = "globe",
  visualizationMode = "parameter",
}: HexGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const globeGroupRef = useRef<THREE.Group | null>(null);
  const tileLayerRef = useRef<THREE.Group | null>(null);
  const tileObjsRef = useRef<Map<string, TileObj>>(new Map());
  const frameRef = useRef<number>(0);
  const prevGeometrySignatureRef = useRef("");
  const selectedHighlightRef = useRef<THREE.Mesh | null>(null);
  const selectedHighlightHostRef = useRef<THREE.Group | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());

  const tilesRef = useRef(tiles);
  const selectedVariableRef = useRef(selectedVariable);
  const surfaceModeRef = useRef(surfaceMode);
  const visualizationModeRef = useRef(visualizationMode);
  const selectedTileKeyRef = useRef(selectedTileKey);
  const autoRotateRef = useRef(autoRotate);
  const isAnimatingRef = useRef(isAnimating);
  const lastVisualSignatureRef = useRef("");

  useEffect(() => {
    tilesRef.current = tiles;
  }, [tiles]);

  useEffect(() => {
    selectedVariableRef.current = selectedVariable;
  }, [selectedVariable]);

  useEffect(() => {
    surfaceModeRef.current = surfaceMode;
  }, [surfaceMode]);

  useEffect(() => {
    visualizationModeRef.current = visualizationMode;
  }, [visualizationMode]);

  useEffect(() => {
    selectedTileKeyRef.current = selectedTileKey;
  }, [selectedTileKey]);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    isAnimatingRef.current = isAnimating;
  }, [isAnimating]);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      200
    );
    camera.position.set(0, 0, 12);
    cameraRef.current = camera;

    const scene = new THREE.Scene();
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.rotateSpeed = 0.4;
    controls.zoomSpeed = 0.8;
    controls.minDistance = 7;
    controls.maxDistance = 24;
    controlsRef.current = controls;

    const globeGroup = new THREE.Group();
    scene.add(globeGroup);
    globeGroupRef.current = globeGroup;

    const sphereMesh = new THREE.Mesh(
      new THREE.SphereGeometry(SPHERE_RADIUS - 0.05, 48, 48),
      new THREE.MeshBasicMaterial({ color: 0x05030e, transparent: true, opacity: 0.95 })
    );
    globeGroup.add(sphereMesh);

    const atmosphereA = new THREE.Mesh(
      new THREE.SphereGeometry(SPHERE_RADIUS + 0.4, 48, 48),
      new THREE.MeshBasicMaterial({
        color: 0x4400aa,
        side: THREE.BackSide,
        transparent: true,
        opacity: 0.1,
      })
    );
    globeGroup.add(atmosphereA);

    const atmosphereB = new THREE.Mesh(
      new THREE.SphereGeometry(SPHERE_RADIUS + 0.9, 48, 48),
      new THREE.MeshBasicMaterial({
        color: 0x7722ee,
        side: THREE.BackSide,
        transparent: true,
        opacity: 0.04,
      })
    );
    globeGroup.add(atmosphereB);

    const stars = new THREE.Group();
    const starPositions = new Float32Array(1800 * 3);
    for (let i = 0; i < 1800; i += 1) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 50 + Math.random() * 20;
      starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      starPositions[i * 3 + 2] = radius * Math.cos(phi);
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
    stars.add(
      new THREE.Points(
        starGeometry,
        new THREE.PointsMaterial({
          color: 0xffffff,
          size: 0.08,
          transparent: true,
          opacity: 0.45,
        })
      )
    );
    scene.add(stars);

    const tileLayer = new THREE.Group();
    globeGroup.add(tileLayer);
    tileLayerRef.current = tileLayer;
    buildGhostLayer(tileLayer, surfaceModeRef.current, hexRadius);

    function animate(time: number) {
      frameRef.current = requestAnimationFrame(animate);
      controls.update();

      const currentSurface = surfaceModeRef.current;
      sphereMesh.visible = currentSurface === "globe";
      atmosphereA.visible = currentSurface === "globe";
      atmosphereB.visible = currentSurface === "globe";
      stars.visible = currentSurface === "globe";

      if (currentSurface === "globe" && autoRotateRef.current) {
        globeGroup.rotation.y += isAnimatingRef.current ? 0.0018 : 0.0007;
      } else if (currentSurface === "field") {
        globeGroup.rotation.x += (0 - globeGroup.rotation.x) * 0.12;
        globeGroup.rotation.y += (0 - globeGroup.rotation.y) * 0.12;
      }

      const currentVariable = selectedVariableRef.current;
      const currentTiles = tilesRef.current;
      const currentVisualization = visualizationModeRef.current;
      const visualSignature =
        `${currentSurface}-${currentVisualization}-${currentVariable}-` +
        Object.keys(currentTiles).sort().join(",");

      if (visualSignature !== lastVisualSignatureRef.current) {
        lastVisualSignatureRef.current = visualSignature;

        let min = Infinity;
        let max = -Infinity;
        for (const vars of Object.values(currentTiles)) {
          const value = vars[currentVariable];
          if (value !== undefined) {
            min = Math.min(min, value);
            max = Math.max(max, value);
          }
        }
        if (min === Infinity) {
          min = 0;
          max = 100;
        } else if (min === max) {
          min -= 1;
          max += 1;
        }

        tileObjsRef.current.forEach((tile, key) => {
          const vars = currentTiles[key] ?? {};
          const parameterScore = normalizeValue(vars[currentVariable] ?? 0, min, max);
          const pestScore = derivePestRiskScore(vars);
          const activeScore =
            currentVisualization === "pest" ? pestScore : parameterScore;
          const topColor =
            currentVisualization === "pest"
              ? getPestColor(pestScore)
              : getColor(parameterScore, currentVariable);

          tile.targetColor.copy(topColor);
          tile.riskScore = pestScore;
          tile.targetHeight = computeTargetHeight(
            activeScore,
            currentSurface,
            currentVisualization
          );
          tile.grass.visible = currentVisualization === "pest" && pestScore < 0.42;
        });
      }

      tileObjsRef.current.forEach((tile, key) => {
        tile.currentHeight += (tile.targetHeight - tile.currentHeight) * 0.12;
        tile.bodyGroup.scale.y = Math.max(0.02, tile.currentHeight);
        tile.topGroup.position.y = tile.currentHeight;

        tile.topMat.color.lerp(tile.targetColor, 0.09);
        tile.sideMat.color.lerp(tile.targetColor.clone().multiplyScalar(0.58), 0.09);

        const isSelected = selectedTileKeyRef.current === key;
        tile.topMat.opacity = isSelected
          ? 0.78
          : currentVisualization === "pest"
            ? 0.28 + tile.riskScore * 0.42
            : 0.24 + 0.12 * (0.5 + 0.5 * Math.sin(time * 0.0018 + tile.currentHeight * 3));

        const lineMaterial = tile.topLine.material as THREE.LineBasicMaterial;
        lineMaterial.color.lerp(tile.targetColor.clone().lerp(new THREE.Color("#ffffff"), 0.35), 0.09);
        lineMaterial.opacity = isSelected ? 1 : 0.7;
      });

      if (selectedHighlightRef.current && selectedHighlightHostRef.current) {
        selectedHighlightRef.current.position.y = 0.02;
        const material = selectedHighlightRef.current.material as THREE.MeshBasicMaterial;
        material.opacity = 0.2 + 0.14 * (0.5 + 0.5 * Math.sin(time * 0.004));
      }

      renderer.render(scene, camera);
    }

    requestAnimationFrame(animate);

    const onResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    };

    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", onResize);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [hexRadius]);

  useEffect(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    if (surfaceMode === "field") {
      camera.position.set(0, 8.4, 7.2);
      controls.target.set(0, 0, 0);
    } else {
      camera.position.set(0, 0, 12);
      controls.target.set(0, 0, 0);
    }
    controls.update();
  }, [surfaceMode]);

  useEffect(() => {
    const layer = tileLayerRef.current;
    if (!layer) return;

    const geometrySignature =
      `${surfaceMode}-${hexRadius}-` + Object.keys(tiles).sort().join(",");
    if (geometrySignature === prevGeometrySignatureRef.current) return;
    prevGeometrySignatureRef.current = geometrySignature;

    layer.clear();
    tileObjsRef.current.clear();
    selectedHighlightRef.current = null;
    selectedHighlightHostRef.current = null;

    const keys = Object.keys(tiles);
    if (keys.length === 0) {
      buildGhostLayer(layer, surfaceMode, hexRadius);
      return;
    }

    const sortedKeys = [...keys].sort();
    if (surfaceMode === "globe") {
      const subdivisions = subdivisionsFor(keys.length);
      const hexsphere = getHexasphere(subdivisions, SPHERE_RADIUS);

      hexsphere.tiles.forEach((tile, index) => {
        const key = sortedKeys[index];
        if (!key) return;
        const frame = makeGlobePolygonFrame(tile);
        const mesh = createTileMesh(frame);
        mesh.hitMesh.userData = { key };
        layer.add(mesh.root);
        tileObjsRef.current.set(key, {
          bodyGroup: mesh.bodyGroup,
          currentHeight: 0.02,
          grass: mesh.grass,
          hitMesh: mesh.hitMesh,
          riskScore: 0,
          root: mesh.root,
          sideMat: mesh.sideMat,
          targetColor: GHOST_COLOR.clone(),
          targetHeight: 0.02,
          topGroup: mesh.topGroup,
          topLine: mesh.topLine,
          topMat: mesh.topMat,
        });
      });
    } else {
      sortedKeys.forEach((key) => {
        const frame = makeFieldPolygonFrame(key, hexRadius);
        const mesh = createTileMesh(frame);
        mesh.hitMesh.userData = { key };
        layer.add(mesh.root);
        tileObjsRef.current.set(key, {
          bodyGroup: mesh.bodyGroup,
          currentHeight: 0.02,
          grass: mesh.grass,
          hitMesh: mesh.hitMesh,
          riskScore: 0,
          root: mesh.root,
          sideMat: mesh.sideMat,
          targetColor: GHOST_COLOR.clone(),
          targetHeight: 0.02,
          topGroup: mesh.topGroup,
          topLine: mesh.topLine,
          topMat: mesh.topMat,
        });
      });
    }

    lastVisualSignatureRef.current = "";
  }, [hexRadius, surfaceMode, tiles]);

  useEffect(() => {
    const previous = selectedHighlightRef.current;
    if (previous) {
      previous.parent?.remove(previous);
      previous.geometry.dispose();
      (previous.material as THREE.Material).dispose();
      selectedHighlightRef.current = null;
      selectedHighlightHostRef.current = null;
    }

    const selectedKey = selectedTileKey;
    if (!selectedKey) return;
    const tile = tileObjsRef.current.get(selectedKey);
    if (!tile) return;

    const highlight = new THREE.Mesh(
      (tile.hitMesh.geometry as THREE.BufferGeometry).clone(),
      new THREE.MeshBasicMaterial({
        color: tile.targetColor.clone().lerp(new THREE.Color("#ffffff"), 0.55),
        transparent: true,
        opacity: 0.28,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    highlight.renderOrder = 8;
    tile.topGroup.add(highlight);
    selectedHighlightRef.current = highlight;
    selectedHighlightHostRef.current = tile.topGroup;
  }, [selectedTileKey]);

  useEffect(() => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    if (!renderer || !camera || !onTileClick) return;

    function onClick(event: MouseEvent) {
      if (!renderer || !camera || !onTileClick) return;
      const rect = renderer.domElement.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(mouseRef.current, camera);

      const hitMeshes = Array.from(tileObjsRef.current.values()).map((tile) => tile.hitMesh);
      const hits = raycasterRef.current.intersectObjects(hitMeshes);
      if (!hits.length) return;

      const { key } = hits[0].object.userData as { key: string | null };
      if (!key) return;

      const [q, r] = key.split(",").map(Number);
      onTileClick(q, r, tiles[key] ?? {});
    }

    renderer.domElement.addEventListener("click", onClick);
    return () => renderer.domElement.removeEventListener("click", onClick);
  }, [onTileClick, tiles]);

  return <div ref={containerRef} className="w-full h-full" />;
}

function buildGhostLayer(
  layer: THREE.Group,
  mode: GlobeSurfaceMode,
  hexRadius: number
) {
  if (mode === "globe") {
    const hexsphere = getHexasphere(3, SPHERE_RADIUS);
    hexsphere.tiles.forEach((tile) => {
      const frame = makeGlobePolygonFrame(tile);
      const points = frame.points.map((point) => new THREE.Vector3(point.x, 0, point.y));
      const line = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({
          color: GHOST_COLOR,
          transparent: true,
          opacity: 0.5,
          depthWrite: false,
          depthTest: false,
        })
      );
      line.renderOrder = 3;
      const group = new THREE.Group();
      group.position.copy(frame.baseCenter);
      group.quaternion.setFromUnitVectors(UP, frame.normal);
      group.add(line);
      layer.add(group);
    });
    return;
  }

  const previewRadius = Math.min(3, Math.max(1, Math.floor(hexRadius)));
  for (let q = -previewRadius; q <= previewRadius; q += 1) {
    for (
      let r = Math.max(-previewRadius, -q - previewRadius);
      r <= Math.min(previewRadius, -q + previewRadius);
      r += 1
    ) {
      const frame = makeFieldPolygonFrame(`${q},${r}`, Math.max(hexRadius, previewRadius));
      const points = frame.points.map((point) => new THREE.Vector3(point.x, 0, point.y));
      const line = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({
          color: GHOST_COLOR,
          transparent: true,
          opacity: 0.5,
          depthWrite: false,
          depthTest: false,
        })
      );
      line.renderOrder = 3;
      const group = new THREE.Group();
      group.position.copy(frame.baseCenter);
      group.add(line);
      layer.add(group);
    }
  }
}
