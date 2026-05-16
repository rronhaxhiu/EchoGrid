import { create } from "zustand";
import type {
  RunMeta,
  WorldStateResponse,
  SimulationStatus,
  VariableConfig,
} from "@/types/simulation";
import { DEFAULT_VARIABLE_CONFIGS } from "@/types/simulation";
import { api } from "@/lib/api";

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

  // Error
  error: string | null;

  // Actions
  setHexRadius: (r: number) => void;
  setSeed: (s: number) => void;
  setSpatialDecay: (d: number) => void;
  setVariableConfigs: (configs: VariableConfig[]) => void;
  setSelectedVariable: (v: string) => void;
  setTickSpeed: (ms: number) => void;

  startSimulation: () => Promise<void>;
  stopSimulation: () => void;
  pauseSimulation: () => void;
  resumeSimulation: () => void;

  fetchWorldState: () => Promise<void>;
  runTick: () => Promise<void>;

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

  error: null,

  setHexRadius: (r) => set({ hexRadius: r }),
  setSeed: (s) => set({ seed: s }),
  setSpatialDecay: (d) => set({ spatialDecay: d }),
  setVariableConfigs: (configs) => set({ variableConfigs: configs }),
  setSelectedVariable: (v) => set({ selectedVariable: v }),
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
    const { hexRadius, seed, spatialDecay, variableConfigs } = get();
    set({ error: null });

    try {
      const activeVars = variableConfigs.filter((v) => v.enabled);
      const run = await api.runs.create({
        seed,
        hex_radius: hexRadius,
        variables: activeVars.map((v) => ({
          name: v.name,
          initial_value: v.initial_value,
        })),
        spatial_decay: spatialDecay,
        diff_snapshots: true,
      });

      // Fetch initial world state
      const worldState = await api.world.getState(run.id);

      set({
        activeRun: run,
        worldState,
        status: "running",
        selectedVariable: activeVars[0]?.name ?? "health",
      });

      // Start auto-tick polling
      const interval = setInterval(async () => {
        const { status: s, activeRun: r } = get();
        if (s !== "running" || !r) return;
        await get().runTick();
      }, get().tickSpeed);

      set({ tickInterval: interval });
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

  setError: (msg) => set({ error: msg }),
}));
