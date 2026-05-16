import type {
  AddEventRequest,
  CreateRunRequest,
  EventResponse,
  RunListItem,
  RunMeta,
  SnapshotListItem,
  TickResponse,
  VariableResponse,
  WorldStateResponse,
} from "@/types/simulation";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    ...options,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  runs: {
    list(limit = 50, offset = 0) {
      return apiRequest<RunListItem[]>(`/api/v1/runs?limit=${limit}&offset=${offset}`);
    },
    create(payload: CreateRunRequest) {
      return apiRequest<RunMeta>("/api/v1/runs", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    get(runId: string) {
      return apiRequest<RunMeta>(`/api/v1/runs/${runId}`);
    },
    delete(runId: string) {
      return apiRequest<void>(`/api/v1/runs/${runId}`, { method: "DELETE" });
    },
  },
  world: {
    getState(runId: string) {
      return apiRequest<WorldStateResponse>(`/api/v1/runs/${runId}/state`);
    },
  },
  simulation: {
    tick(runId: string) {
      return apiRequest<TickResponse>(`/api/v1/runs/${runId}/tick`, {
        method: "POST",
      });
    },
  },
  events: {
    add(runId: string, payload: AddEventRequest) {
      return apiRequest<EventResponse>(`/api/v1/runs/${runId}/events`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
  },
  export: {
    run(runId: string) {
      return apiRequest<unknown>(`/api/v1/runs/${runId}/export`);
    },
  },
  snapshots: {
    list(runId: string) {
      return apiRequest<SnapshotListItem[]>(`/api/v1/runs/${runId}/snapshots`);
    },
  },
  variables: {
    list() {
      return apiRequest<VariableResponse[]>("/api/v1/variables");
    },
  },
};
