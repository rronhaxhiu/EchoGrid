import { useCallback, useEffect, useMemo, useState } from "react";

import {
  createSimulationRun,
  getWorldState,
  listSimulationRuns,
} from "@/services/simulationsApi";
import {
  buildGlobalHexLayer,
  DEFAULT_GLOBE_VARIABLE,
} from "@/components/ecogrid/globeTileLayer";

const launchRunPayload = {
  seed: 2026,
  hex_radius: 8,
  variables: [
    { name: "health", initial_value: 72 },
    { name: "economy", initial_value: 58 },
    { name: "green", initial_value: 64 },
    { name: "mobility", initial_value: 46 },
  ],
  spatial_decay: 0.28,
  diff_snapshots: true,
};

export function useWorldRun() {
  const [run, setRun] = useState(null);
  const [worldState, setWorldState] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setStatus("loading");
    setError(null);

    try {
      const runs = await listSimulationRuns({ limit: 1 });
      const activeRun = runs[0] || (await createSimulationRun(launchRunPayload));
      const nextWorldState = await getWorldState(activeRun.id);

      setRun(activeRun);
      setWorldState(nextWorldState);
      setStatus("ready");
    } catch (nextError) {
      setRun(null);
      setWorldState(null);
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to load the world state.",
      );
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(load, 0);

    return () => window.clearTimeout(timeout);
  }, [load]);

  const layer = useMemo(
    () =>
      worldState
        ? buildGlobalHexLayer(worldState, DEFAULT_GLOBE_VARIABLE)
        : null,
    [worldState],
  );

  return {
    run,
    worldState,
    layer,
    status,
    error,
    reload: load,
    variableName: DEFAULT_GLOBE_VARIABLE,
  };
}
