import { create } from "zustand";
import type {
  RunMeta,
  WorldStateResponse,
  SimulationStatus,
  VariableConfig,
  PredictionSchemaResponse,
} from "@/types/simulation";
import { DEFAULT_VARIABLE_CONFIGS } from "@/types/simulation";
import { api } from "@/lib/api";

export type InfluenceMatrix = Record<string, Record<string, number>>;

/** Default cross-variable influence coefficients. */
export const DEFAULT_INFLUENCE_MATRIX: InfluenceMatrix = {
  health:   { economy: 0.10, green: 0.05 },
  economy:  { health: 0.20, green: -0.10, mobility: 0.15 },
  green:    { health: 0.15, mobility: 0.05 },
  mobility: { economy: 0.20, health: 0.05, green: -0.05 },
};

interface SimulationState {
  // Active run
  activeRun: RunMeta | null;
  worldState: WorldStateResponse | null;
  status: SimulationStatus;
  tickInterval: ReturnType<typeof setInterval> | null;
  tickSpeed: number; // ms between ticks
  selectedVariable: string;

  // Run config form
  hexRadius: number;
  seed: number;
  spatialDecay: number;
  variableConfigs: VariableConfig[];

  // Global influence matrix — NOT tied to any run.
  // Edited freely in Settings, applied when a new run starts.
  influenceMatrix: InfluenceMatrix;

  // Optional CSV rows for per-tile initial values (assigned randomly at run start).
  csvRows: number[][] | null;
  csvMeta: { rowCount: number; columnCount: number; fileName: string } | null;

  // ML prediction (pest risk)
  predictionSchema: PredictionSchemaResponse | null;
  predictionLoading: boolean;

  // Error
  error: string | null;

  // Actions
  setHexRadius: (r: number) => void;
  setSeed: (s: number) => void;
  setSpatialDecay: (d: number) => void;
  setVariableConfigs: (configs: VariableConfig[]) => void;
  setSelectedVariable: (v: string) => void;
  setTickSpeed: (ms: number) => void;
  setInfluenceMatrix: (m: InfluenceMatrix) => void;
  setCsvRows: (
    rows: number[][] | null,
    meta?: { rowCount: number; columnCount: number; fileName: string } | null
  ) => void;

  startSimulation: () => Promise<void>;
  stopSimulation: () => void;
  pauseSimulation: () => void;
  resumeSimulation: () => void;

  fetchWorldState: () => Promise<void>;
  runTick: () => Promise<void>;

  fetchPredictionSchema: () => Promise<void>;
  predictRunTiles: (opts?: {
    model?: "xgb" | "nn" | "both";
    write_to_tiles?: boolean;
  }) => Promise<void>;

  setError: (msg: string | null) => void;
}

export const useSimulationStore = create<SimulationState>((set, get) => ({
  activeRun: null,
  worldState: null,
  status: "idle",
  tickInterval: null,
  tickSpeed: 1200,
  selectedVariable: "health",

  hexRadius: 5,
  seed: 42,
  spatialDecay: 0.3,
  variableConfigs: [...DEFAULT_VARIABLE_CONFIGS],
  influenceMatrix: { ...DEFAULT_INFLUENCE_MATRIX },
  csvRows: null,
  csvMeta: null,

  predictionSchema: null,
  predictionLoading: false,

  error: null,

  setHexRadius: (r) => set({ hexRadius: r }),
  setSeed: (s) => set({ seed: s }),
  setSpatialDecay: (d) => set({ spatialDecay: d }),
  setVariableConfigs: (configs) => set({ variableConfigs: configs }),
  setSelectedVariable: (v) => set({ selectedVariable: v }),
  setInfluenceMatrix: (m) => set({ influenceMatrix: m }),
  setCsvRows: (rows, meta = null) => set({ csvRows: rows, csvMeta: meta }),
  setTickSpeed: (ms) => {
    set({ tickSpeed: ms });
    // Restart interval if running
    const { status } = get();
    if (status === "running") {
      get().pauseSimulation();
      get().resumeSimulation();
    }
  },

  startSimulation: async () => {
    const { hexRadius, seed, spatialDecay, variableConfigs, influenceMatrix, csvRows } =
      get();
    set({ error: null });

    try {
      const activeVars = variableConfigs.filter((v) => v.enabled);

      // Build variable_specs: only include entries that have at least one meaningful spec field
      const variable_specs: Record<string, { min_value?: number | null; max_value?: number | null; is_integer?: boolean }> = {};
      for (const v of activeVars) {
        if (v.min_value != null || v.max_value != null || v.is_integer != null) {
          variable_specs[v.name] = {
            min_value: v.min_value ?? null,
            max_value: v.max_value ?? null,
            is_integer: v.is_integer ?? false,
          };
        }
      }

      const run = await api.runs.create({
        seed,
        hex_radius: hexRadius,
        variables: activeVars.map((v) => ({
          name: v.name,
          initial_value: v.initial_value,
        })),
        spatial_decay: spatialDecay,
        diff_snapshots: true,
        influence_config: influenceMatrix,
        ...(csvRows && csvRows.length > 0 ? { csv_rows: csvRows } : {}),
        ...(Object.keys(variable_specs).length > 0 ? { variable_specs } : {}),
      });

      // Fetch initial world state
      const worldState = await api.world.getState(run.id);

      set({
        activeRun: run,
        worldState,
        status: "paused",
        selectedVariable: activeVars[0]?.name ?? "health",
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to start simulation" });
    }
  },

  stopSimulation: () => {
    const { tickInterval } = get();
    if (tickInterval) clearInterval(tickInterval);
    set({
      status: "stopped",
      tickInterval: null,
    });
  },

  pauseSimulation: () => {
    const { tickInterval } = get();
    if (tickInterval) clearInterval(tickInterval);
    set({ status: "paused", tickInterval: null });
  },

  resumeSimulation: () => {
    const { activeRun, tickSpeed } = get();
    if (!activeRun) return;

    set({ status: "running" });

    const interval = setInterval(async () => {
      const { status: s, activeRun: r } = get();
      if (s !== "running" || !r) return;
      await get().runTick();
    }, tickSpeed);

    set({ tickInterval: interval });
  },

  runTick: async () => {
    const { activeRun } = get();
    if (!activeRun) return;

    try {
      await api.simulation.tick(activeRun.id);
      await get().fetchWorldState();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Tick failed" });
    }
  },

  fetchWorldState: async () => {
    const { activeRun } = get();
    if (!activeRun) return;

    try {
      const worldState = await api.world.getState(activeRun.id);
      set({
        worldState,
        activeRun: {
          ...get().activeRun!,
          current_tick: worldState.tick,
        },
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to fetch state" });
    }
  },

  fetchPredictionSchema: async () => {
    try {
      const predictionSchema = await api.prediction.schema();
      set({ predictionSchema });
    } catch {
      set({ predictionSchema: null });
    }
  },

  predictRunTiles: async (opts = {}) => {
    const { activeRun } = get();
    if (!activeRun) return;
    set({ predictionLoading: true, error: null });
    try {
      await api.prediction.predictTiles(activeRun.id, {
        model: opts.model ?? "xgb",
        write_to_tiles: opts.write_to_tiles ?? true,
        strict: false,
        fill_missing: 0,
      });
      await get().fetchWorldState();
      set({ selectedVariable: "pest_risk_label_xgb" });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Prediction failed",
      });
    } finally {
      set({ predictionLoading: false });
    }
  },

  setError: (msg) => set({ error: msg }),
}));
