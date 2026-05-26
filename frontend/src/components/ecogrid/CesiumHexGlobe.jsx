import { useEffect, useRef, useState } from "react";

import "cesium/Build/Cesium/Widgets/widgets.css";

const DETAILED_IMAGERY_URL =
  "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const OSM_IMAGERY_URL = "https://tile.openstreetmap.org/";
const LOCAL_IMAGERY_URL = "Assets/Textures/NaturalEarthII";
const MAX_RESOLUTION_SCALE = 2;
const GRID_FILL_ALPHA = 0.12;
const GRID_OUTLINE_ALPHA = 0.38;
const SELECTED_GRID_ALPHA = 0.3;
const GRID_BASE_HEIGHT = 1_200;
const GRID_VALUE_HEIGHT = 3_200;

function createDetailedImageryProvider(Cesium) {
  return new Cesium.UrlTemplateImageryProvider({
    url: DETAILED_IMAGERY_URL,
    credit: "Tiles © Esri",
    enablePickFeatures: false,
    hasAlphaChannel: false,
    maximumLevel: 19,
  });
}

function createOsmImageryProvider(Cesium) {
  return new Cesium.OpenStreetMapImageryProvider({
    url: OSM_IMAGERY_URL,
    maximumLevel: 19,
    retinaTiles: true,
  });
}

function createLocalImageryProvider(Cesium) {
  return Cesium.TileMapServiceImageryProvider.fromUrl(
    Cesium.buildModuleUrl(LOCAL_IMAGERY_URL),
  );
}

async function addBaseImageryLayers(Cesium, viewer, shouldCancel) {
  const localProvider = await createLocalImageryProvider(Cesium);
  if (shouldCancel()) {
    return;
  }

  viewer.imageryLayers.addImageryProvider(localProvider);

  try {
    const detailedProvider = createDetailedImageryProvider(Cesium);
    const detailedLayer =
      viewer.imageryLayers.addImageryProvider(detailedProvider);
    let detailedTileErrors = 0;

    detailedProvider.errorEvent.addEventListener(() => {
      detailedTileErrors += 1;

      if (
        detailedTileErrors >= 3 &&
        !shouldCancel() &&
        viewer.imageryLayers.contains(detailedLayer)
      ) {
        viewer.imageryLayers.remove(detailedLayer, false);
        viewer.scene.requestRender();
      }
    });
  } catch {
    try {
      viewer.imageryLayers.addImageryProvider(createOsmImageryProvider(Cesium));
    } catch {
      // The local Natural Earth layer is already present.
    }
  }
}

function normalize(value, min, max) {
  if (max <= min) {
    return 0.5;
  }

  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

function getCellColor(Cesium, value, min, max, alpha = GRID_FILL_ALPHA) {
  const intensity = normalize(value, min, max);
  const hue = 0.02 + intensity * 0.31;

  return Cesium.Color.fromHsl(hue, 0.78, 0.5, alpha);
}

function applyEntityStyle(Cesium, entity, selected) {
  if (!entity?.polygon) {
    return;
  }

  entity.polygon.material = selected
    ? Cesium.Color.CYAN.withAlpha(SELECTED_GRID_ALPHA)
    : entity.ecogridMaterial;
  entity.polygon.outlineColor = selected
    ? Cesium.Color.WHITE.withAlpha(0.95)
    : entity.ecogridOutlineColor;
  entity.polygon.outlineWidth = selected ? 3 : 2;
}

export function CesiumHexGlobe({
  cells = [],
  min = 0,
  max = 0,
  variableLabel = "Value",
  onTileSelect,
}) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const cesiumRef = useRef(null);
  const selectedEntityRef = useRef(null);
  const hasFlownRef = useRef(false);
  const onTileSelectRef = useRef(onTileSelect);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    onTileSelectRef.current = onTileSelect;
  }, [onTileSelect]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return undefined;
    }

    let cancelled = false;
    let resizeObserver;
    let clickHandler;

    async function initializeViewer() {
      try {
        window.CESIUM_BASE_URL = "/cesium/";
        const Cesium = await import("cesium");

        if (cancelled) {
          return;
        }

        cesiumRef.current = Cesium;

        const creditContainer = document.createElement("div");
        creditContainer.style.display = "none";

        const viewer = new Cesium.Viewer(element, {
          animation: false,
          baseLayer: false,
          baseLayerPicker: false,
          creditContainer,
          fullscreenButton: false,
          geocoder: false,
          homeButton: true,
          infoBox: false,
          navigationHelpButton: false,
          sceneModePicker: false,
          selectionIndicator: true,
          timeline: false,
          terrainProvider: new Cesium.EllipsoidTerrainProvider(),
          useBrowserRecommendedResolution: false,
          vrButton: false,
        });

        viewerRef.current = viewer;
        viewer.resolutionScale = Math.min(
          window.devicePixelRatio || 1,
          MAX_RESOLUTION_SCALE,
        );
        viewer.scene.globe.depthTestAgainstTerrain = false;
        viewer.scene.globe.enableLighting = false;
        viewer.scene.globe.maximumScreenSpaceError = 1.5;
        viewer.scene.globe.tileCacheSize = 1_000;
        viewer.scene.fog.enabled = true;
        viewer.scene.fog.density = 1.7e-4;
        viewer.scene.screenSpaceCameraController.minimumZoomDistance = 25_000;

        await addBaseImageryLayers(
          Cesium,
          viewer,
          () => cancelled || viewer.isDestroyed(),
        );
        if (cancelled || viewer.isDestroyed()) {
          return;
        }

        resizeObserver = new ResizeObserver(() => viewer.resize());
        resizeObserver.observe(element);

        clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        clickHandler.setInputAction((movement) => {
          const picked = viewer.scene.pick(movement.position);
          const entity = Cesium.defined(picked) ? picked.id : null;

          if (!entity?.ecogridTile) {
            applyEntityStyle(Cesium, selectedEntityRef.current, false);
            selectedEntityRef.current = null;
            onTileSelectRef.current?.(null);
            viewer.scene.requestRender();
            return;
          }

          applyEntityStyle(Cesium, selectedEntityRef.current, false);
          selectedEntityRef.current = entity;
          applyEntityStyle(Cesium, entity, true);
          viewer.selectedEntity = entity;
          onTileSelectRef.current?.(entity.ecogridTile);
          viewer.scene.requestRender();
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        setReady(true);
      } catch (nextError) {
        if (!cancelled) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "Unable to initialize Cesium.",
          );
        }
      }
    }

    initializeViewer();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      clickHandler?.destroy();

      const viewer = viewerRef.current;
      if (viewer && !viewer.isDestroyed()) {
        viewer.destroy();
      }
    };
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;

    if (!ready || !viewer || !Cesium || viewer.isDestroyed()) {
      return;
    }

    viewer.entities.removeAll();
    selectedEntityRef.current = null;

    for (const cell of cells) {
      const flatBoundary = cell.boundary.flatMap(([lat, lng]) => [lng, lat]);
      const material = getCellColor(Cesium, cell.value, min, max);
      const outlineColor = getCellColor(
        Cesium,
        cell.value,
        min,
        max,
        GRID_OUTLINE_ALPHA,
      );
      const height =
        GRID_BASE_HEIGHT + normalize(cell.value, min, max) * GRID_VALUE_HEIGHT;
      const entity = viewer.entities.add({
        id: `ecogrid-${cell.h3Index}`,
        name: `${cell.variableLabel}: ${cell.value.toFixed(1)}`,
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(
            Cesium.Cartesian3.fromDegreesArray(flatBoundary),
          ),
          height,
          material,
          outline: true,
          outlineColor,
          outlineWidth: 2,
        },
      });

      entity.ecogridMaterial = material;
      entity.ecogridOutlineColor = outlineColor;
      entity.ecogridTile = cell;
    }

    if (cells.length > 0 && !hasFlownRef.current) {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(-45, 22, 24_000_000),
        duration: 0.8,
      });
      hasFlownRef.current = true;
    }

    viewer.scene.requestRender();
  }, [cells, max, min, ready]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        ref={containerRef}
        className="h-full w-full [&_.cesium-viewer-toolbar]:left-4 [&_.cesium-viewer-toolbar]:right-auto [&_.cesium-viewer-toolbar]:top-24"
      />
      {!ready && !error ? (
        <div className="absolute inset-0 grid place-items-center bg-[#02050c] text-sm text-cyan-100/75">
          Preparing globe
        </div>
      ) : null}
      {error ? (
        <div className="absolute inset-0 grid place-items-center bg-[#02050c] px-6 text-center text-sm text-rose-100">
          {error}
        </div>
      ) : null}
      <div className="pointer-events-none absolute bottom-4 left-4 rounded-lg border border-white/10 bg-black/42 px-3 py-2 text-xs text-white/62 backdrop-blur-xl">
        {cells.length.toLocaleString()} global hexes · {variableLabel}
      </div>
    </div>
  );
}
