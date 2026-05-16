"use client";

import { useEffect, useRef } from "react";

import type { H3HexCell } from "@/lib/sim-h3-layer";

import "cesium/Source/Widgets/widgets.css";

declare global {
  interface Window {
    CESIUM_BASE_URL?: string;
  }
}

export interface CesiumH3GlobeProps {
  cells: H3HexCell[];
  min: number;
  max: number;
  extrusionScale?: number;
  variableLabel?: string;
}

function normalize(value: number, min: number, max: number): number {
  if (max <= min) return 0.5;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

export function CesiumH3Globe({
  cells,
  min,
  max,
  extrusionScale = 95_000,
  variableLabel = "value",
}: CesiumH3GlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let viewer: import("cesium").Viewer | undefined;
    let ro: ResizeObserver | undefined;
    let cancelled = false;

    (async () => {
      window.CESIUM_BASE_URL = "/cesium/";
      const Cesium = await import("cesium");
      if (cancelled) return;

      viewer = new Cesium.Viewer(el, {
        baseLayer: false,
        terrainProvider: new Cesium.EllipsoidTerrainProvider(),
        animation: false,
        timeline: false,
        fullscreenButton: true,
        vrButton: false,
        geocoder: false,
        homeButton: true,
        infoBox: true,
        sceneModePicker: true,
        selectionIndicator: true,
        navigationHelpButton: false,
        baseLayerPicker: false,
      });

      const imageryProvider =
        await Cesium.TileMapServiceImageryProvider.fromUrl(
          Cesium.buildModuleUrl("Assets/Textures/NaturalEarthII"),
        );
      viewer.imageryLayers.addImageryProvider(imageryProvider);

      const globe = viewer.scene.globe;
      globe.depthTestAgainstTerrain = true;
      globe.maximumScreenSpaceError = 1.2;
      globe.tileCacheSize = 800;

      const s = viewer.scene;
      s.fog.enabled = true;
      s.fog.density = 2.2e-4;

      ro = new ResizeObserver(() => {
        viewer?.resize();
      });
      ro.observe(el);

      const applyCells = () => {
        if (!viewer || viewer.isDestroyed()) return;
        viewer.entities.removeAll();

        if (cells.length === 0) return;

        const heavy = cells.length > 8000;
        const west = -180;
        const south = -85;
        const east = 180;
        const north = 85;

        for (const cell of cells) {
          const t = normalize(cell.value, min, max);
          const extruded = 6_000 + t * extrusionScale;
          const hue = (1 - t) * 0.33;
          const color = Cesium.Color.fromHsl(hue, 0.82, 0.52, heavy ? 0.58 : 0.72);

          const flat: number[] = [];
          for (const [lat, lng] of cell.boundary) {
            flat.push(lng, lat, 0);
          }

          viewer.entities.add({
            name: cell.h3Index,
            description: `${variableLabel}: <b>${cell.value.toFixed(2)}</b><br/>H3: <code>${cell.h3Index}</code>`,
            polygon: {
              hierarchy: new Cesium.PolygonHierarchy(
                Cesium.Cartesian3.fromDegreesArrayHeights(flat),
              ),
              extrudedHeight: extruded,
              material: color,
              outline: !heavy,
              outlineColor: Cesium.Color.BLACK.withAlpha(0.28),
              outlineWidth: 1,
            },
          });
        }

        viewer.camera.flyTo({
          destination: Cesium.Rectangle.fromDegrees(west, south, east, north),
          duration: 0.6,
        });
      };

      applyCells();
    })();

    return () => {
      cancelled = true;
      ro?.disconnect();
      if (viewer && !viewer.isDestroyed()) {
        viewer.destroy();
      }
    };
  }, [cells, min, max, extrusionScale, variableLabel]);

  return (
    <div
      ref={containerRef}
      className="h-full min-h-[280px] w-full [&_.cesium-viewer-toolbar]:left-3 [&_.cesium-viewer-toolbar]:right-auto [&_.cesium-viewer-toolbar]:top-3"
    />
  );
}
