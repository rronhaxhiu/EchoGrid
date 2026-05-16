// API types matching backend schemas

export interface VariableInput {
  name: string;
  initial_value: number | null;
}

export interface VariableSpec {
  min_value?: number | null;
  max_value?: number | null;
  is_integer?: boolean;
}

export interface CreateRunRequest {
  seed: number;
  hex_radius: number;
  variables: VariableInput[];
  spatial_decay: number;
  diff_snapshots: boolean;
  influence_config?: Record<string, Record<string, number>>;
  /** CSV rows: each inner array is one row, columns map to variables in order. */
  csv_rows?: number[][];
  /** Per-variable type + range constraints used to sanitize tile values before ML inference. */
  variable_specs?: Record<string, VariableSpec>;
}

export interface RunMeta {
  id: string;
  seed: number;
  hex_radius: number;
  variables: string[];
  global_initial_values: Record<string, number>;
  spatial_decay: number;
  influence_config: Record<string, Record<string, number>>;
  current_tick: number;
  tile_count: number;
  event_count: number;
  snapshot_count: number;
  created_at: string | null;
}

export interface RunListItem {
  id: string;
  seed: number;
  hex_radius: number;
  variables: string[];
  current_tick: number;
  created_at: string | null;
}

export interface TickResponse {
  run_id: string;
  tick: number;
  global_state: Record<string, number>;
  snapshot_id: string;
  is_diff: boolean;
}

export interface WorldStateResponse {
  run_id: string;
  tick: number;
  global_state: Record<string, number>;
  tile_count: number;
  /** Key is "{q},{r}", value is {variable: value} */
  tiles: Record<string, Record<string, number>>;
}

export interface TileStateResponse {
  q: number;
  r: number;
  variables: Record<string, number>;
  neighbor_count: number;
}

export interface EventResponse {
  id: string;
  run_id: string;
  tick: number;
  name: string;
  delta_map: Record<string, number>;
  target_tiles: [number, number][];
  source: string;
}

export interface AddEventRequest {
  tick: number;
  name: string;
  delta_map: Record<string, number>;
  target_tiles: [number, number][];
  source: "user" | "system" | "AI";
}

export interface GenerateEventResponse {
  event: AddEventRequest;
  llm_raw: string;
}

export interface InterpretRunResponse {
  run_id: string;
  tick: number;
  narrative: string;
  anomalies: AnomalyDetail[];
  suggestions: SuggestedEvent[];
  llm_raw: string;
}

export interface AnomalyDetail {
  variable: string;
  description: string;
  severity: "low" | "medium" | "high";
  affected_tiles: [number, number][];
}

export interface SuggestedEvent {
  name: string;
  description: string;
  delta_map: Record<string, number>;
  target_tiles: [number, number][];
  tick: number;
}

export interface SnapshotListItem {
  id: string;
  run_id: string;
  tick: number;
  is_diff: boolean;
  created_at: string | null;
}

export interface VariableResponse {
  id: string;
  name: string;
  display_name: string;
  description: string;
  default_initial_value: number;
  min_value: number | null;
  max_value: number | null;
  unit: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface CreateVariableRequest {
  name: string;
  display_name: string;
  description?: string;
  default_initial_value?: number;
  min_value?: number | null;
  max_value?: number | null;
  unit?: string;
}

export interface SetInfluenceRequest {
  v1: string;
  v2: string;
  coefficient: number;
}

// Frontend-only types
export type SimulationStatus = "idle" | "running" | "paused" | "stopped";

export interface VariableConfig {
  name: string;
  display_name: string;
  initial_value: number;
  enabled: boolean;
  color: string;
  icon: string;
  /** ML data spec: type and range for pre-prediction sanitization */
  min_value?: number | null;
  max_value?: number | null;
  is_integer?: boolean;
}

export interface PredictionSchemaResponse {
  available: boolean;
  feature_columns: string[];
  target: string;
  class_names: string[];
  backend?: string | null;
  label_encoding?: Record<string, number>;
  error?: string | null;
}

export interface PredictRunTilesRequest {
  model?: "xgb" | "nn" | "both";
  write_to_tiles?: boolean;
  strict?: boolean;
  fill_missing?: number;
}

export interface PredictRunTilesResponse {
  run_id: string;
  predictions: Record<
    string,
    {
      label?: string;
      probability_medium?: number;
      model?: string;
      xgb?: { label: string; probability_medium: number };
      nn?: { label: string; probability_medium: number };
    }
  >;
  tile_errors: Record<string, string[]>;
  tiles_predicted: number;
  tiles_skipped: number;
}

export const DEFAULT_VARIABLE_CONFIGS: VariableConfig[] = [
  {
    name: "health",
    display_name: "Health",
    initial_value: 100,
    enabled: true,
    color: "#34D399",
    icon: "",
  },
  {
    name: "economy",
    display_name: "Economy",
    initial_value: 50,
    enabled: true,
    color: "#FBBF24",
    icon: "",
  },
  {
    name: "green",
    display_name: "Environment",
    initial_value: 60,
    enabled: true,
    color: "#6EE7B7",
    icon: "",
  },
  {
    name: "mobility",
    display_name: "Mobility",
    initial_value: 40,
    enabled: true,
    color: "#818CF8",
    icon: "",
  },
];
