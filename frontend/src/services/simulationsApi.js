import { apiRequest } from "./apiClient";

export function listSimulationRuns(params = {}) {
  const search = new URLSearchParams(params).toString();
  return apiRequest(`/api/v1/runs${search ? `?${search}` : ""}`);
}

export function createSimulationRun(payload) {
  return apiRequest("/api/v1/runs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getSimulationRun(runId) {
  return apiRequest(`/api/v1/runs/${runId}`);
}

export function getWorldState(runId) {
  return apiRequest(`/api/v1/runs/${runId}/state`);
}

export function getTileState(runId, q, r) {
  return apiRequest(`/api/v1/runs/${runId}/tiles/${q}/${r}`);
}

export function listVariables() {
  return apiRequest("/api/v1/variables");
}
