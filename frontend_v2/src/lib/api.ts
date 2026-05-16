import type {
  CreateRunRequest,
  RunMeta,
  RunListItem,
  TickResponse,
  WorldStateResponse,
  EventResponse,
  AddEventRequest,
  GenerateEventResponse,
  InterpretRunResponse,
  SnapshotListItem,
  VariableResponse,
  CreateVariableRequest,
  SetInfluenceRequest,
} from "@/types/simulation";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

async function requestBlob(path: string, options?: RequestInit): Promise<Blob> {
  const res = await fetch(`${BASE_URL}${path}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const detail =
      typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail);
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return res.blob();
}

// Runs
export const api = {
  runs: {
    create: (body: CreateRunRequest) =>
      request<RunMeta>("/runs", { method: "POST", body: JSON.stringify(body) }),
    list: (limit = 50, offset = 0) =>
      request<RunListItem[]>(`/runs?limit=${limit}&offset=${offset}`),
    get: (id: string) => request<RunMeta>(`/runs/${id}`),
    delete: (id: string) =>
      request<void>(`/runs/${id}`, { method: "DELETE" }),
  },

  simulation: {
    tick: (runId: string) =>
      request<TickResponse>(`/runs/${runId}/tick`, { method: "POST" }),
    ticks: (runId: string, n: number) =>
      request<{ run_id: string; ticks_run: number; current_tick: number; global_state: Record<string, number> }>(
        `/runs/${runId}/ticks`,
        { method: "POST", body: JSON.stringify({ n }) }
      ),
  },

  world: {
    getState: (runId: string) =>
      request<WorldStateResponse>(`/runs/${runId}/state`),
    getTile: (runId: string, q: number, r: number) =>
      request<{ q: number; r: number; variables: Record<string, number>; neighbor_count: number }>(
        `/runs/${runId}/tiles/${q}/${r}`
      ),
    alterTile: (runId: string, q: number, r: number, variable: string, delta: number) =>
      request<{ run_id: string; q: number; r: number; variable: string; delta: number; queued: boolean }>(
        `/runs/${runId}/tiles/${q}/${r}/alter`,
        { method: "POST", body: JSON.stringify({ variable, delta }) }
      ),
  },

  events: {
    add: (runId: string, body: AddEventRequest) =>
      request<EventResponse>(`/runs/${runId}/events`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    list: (runId: string) =>
      request<EventResponse[]>(`/runs/${runId}/events`),
    generate: (runId: string, prompt: string) =>
      request<GenerateEventResponse>(`/runs/${runId}/events/generate`, {
        method: "POST",
        body: JSON.stringify({ prompt }),
      }),
  },

  interpretation: {
    interpret: (
      runId: string,
      opts?: {
        compare_from_tick?: number;
        include_suggestions?: boolean;
        max_anomalies?: number;
        max_suggestions?: number;
      }
    ) =>
      request<InterpretRunResponse>(`/runs/${runId}/interpret`, {
        method: "POST",
        body: JSON.stringify(opts ?? {}),
      }),
  },

  snapshots: {
    list: (runId: string) =>
      request<SnapshotListItem[]>(`/runs/${runId}/snapshots`),
    get: (runId: string, tick: number) =>
      request<{ id: string; run_id: string; tick: number; is_diff: boolean; state: Record<string, Record<string, number>> }>(
        `/runs/${runId}/snapshots/${tick}`
      ),
  },

  influence: {
    set: (runId: string, body: SetInfluenceRequest) =>
      request<{ run_id: string; v1: string; v2: string; coefficient: number }>(
        `/runs/${runId}/influence`,
        { method: "POST", body: JSON.stringify(body) }
      ),
  },

  export: {
    run: (runId: string) =>
      request<Record<string, unknown>>(`/runs/${runId}/export`),
    runExcel: (runId: string) =>
      requestBlob(`/runs/${runId}/export.xlsx`),
    replay: (runId: string) =>
      request<Record<string, unknown>>(`/runs/${runId}/replay`, {
        method: "POST",
      }),
  },

  variables: {
    create: (body: CreateVariableRequest) =>
      request<VariableResponse>("/variables", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    list: () => request<VariableResponse[]>("/variables"),
    get: (id: string) => request<VariableResponse>(`/variables/${id}`),
    getByName: (name: string) =>
      request<VariableResponse>(`/variables/by-name/${name}`),
    update: (id: string, body: Partial<VariableResponse>) =>
      request<VariableResponse>(`/variables/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    delete: (id: string) =>
      request<void>(`/variables/${id}`, { method: "DELETE" }),
  },
};
