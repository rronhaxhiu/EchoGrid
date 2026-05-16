import { apiRequest } from "@/services/apiClient";

export async function listRuns() {
  return apiRequest("/api/v1/runs");
}

export async function createDemoRun() {
  return apiRequest("/api/v1/runs", {
    method: "POST",
    body: JSON.stringify({
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
    }),
  });
}

export async function loadRunSnapshots(runId: string) {
  const meta = await apiRequest(`/api/v1/runs/${runId}`);
  const snapshotsMeta = await apiRequest(`/api/v1/runs/${runId}/snapshots`);
  
  // Fetch full details for each snapshot
  const snapshots = await Promise.all(
    snapshotsMeta.map((s: any) => apiRequest(`/api/v1/runs/${runId}/snapshots/${s.tick}`))
  );

  return { meta, snapshots };
}
