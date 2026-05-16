import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  PredictionDashboardData,
  PredictionLocationSnapshot,
  PredictionLocationTrendPoint,
  PredictionTimelinePoint,
} from "@/types/predictions";

const LOCATION_LAYOUTS = {
  Rajshahi: { x: 18, y: 32, accent: "#f97316" },
  Mymensingh: { x: 44, y: 22, accent: "#8b5cf6" },
  Dhaka: { x: 38, y: 46, accent: "#06b6d4" },
  Sylhet: { x: 71, y: 24, accent: "#10b981" },
  Khulna: { x: 28, y: 69, accent: "#84cc16" },
  Chattogram: { x: 69, y: 74, accent: "#ef4444" },
} as const;

const PEST_RISK_SCORES: Record<string, number> = {
  Low: 0.28,
  Medium: 0.64,
  High: 0.88,
};

interface AggregateBucket {
  anomalyCount: number;
  cropCounts: Record<string, number>;
  deviceIds: Set<string>;
  humidityTotal: number;
  irrigationCount: number;
  lightTotal: number;
  location: string;
  pestRiskScoreTotal: number;
  pestRiskWeightedCounts: Record<string, number>;
  rainfallTotal: number;
  rowCount: number;
  seasonCounts: Record<string, number>;
  soilMoistureTotal: number;
  temperatureTotal: number;
  yieldTotal: number;
}

export async function getPredictionDashboardData(): Promise<PredictionDashboardData> {
  const csvPath = path.resolve(process.cwd(), "..", "BIED_Smart_Agriculture_Dataset.csv");
  const csv = await readFile(csvPath, "utf-8");
  const rows = parseCsv(csv);
  const byTimestamp = new Map<string, Map<string, AggregateBucket>>();

  for (const row of rows) {
    const timestamp = row.timestamp;
    const location = row.location;
    if (!timestamp || !location) {
      continue;
    }

    let timestampBuckets = byTimestamp.get(timestamp);
    if (!timestampBuckets) {
      timestampBuckets = new Map();
      byTimestamp.set(timestamp, timestampBuckets);
    }

    let bucket = timestampBuckets.get(location);
    if (!bucket) {
      bucket = {
        anomalyCount: 0,
        cropCounts: {},
        deviceIds: new Set(),
        humidityTotal: 0,
        irrigationCount: 0,
        lightTotal: 0,
        location,
        pestRiskScoreTotal: 0,
        pestRiskWeightedCounts: {},
        rainfallTotal: 0,
        rowCount: 0,
        seasonCounts: {},
        soilMoistureTotal: 0,
        temperatureTotal: 0,
        yieldTotal: 0,
      };
      timestampBuckets.set(location, bucket);
    }

    bucket.rowCount += 1;
    bucket.temperatureTotal += toNumber(row.temperature);
    bucket.humidityTotal += toNumber(row.humidity);
    bucket.rainfallTotal += toNumber(row.rainfall);
    bucket.soilMoistureTotal += toNumber(row.soil_moisture);
    bucket.lightTotal += toNumber(row.light_intensity);
    bucket.yieldTotal += toNumber(row.yield_estimate);
    bucket.irrigationCount += row.irrigation_needed === "1" ? 1 : 0;
    bucket.anomalyCount += row.anomaly_flag === "1" ? 1 : 0;
    bucket.deviceIds.add(row.device_id);
    bucket.cropCounts[row.crop_type] = (bucket.cropCounts[row.crop_type] ?? 0) + 1;
    bucket.seasonCounts[row.season] = (bucket.seasonCounts[row.season] ?? 0) + 1;

    const pestRiskLabel = row.pest_risk || "Low";
    bucket.pestRiskWeightedCounts[pestRiskLabel] =
      (bucket.pestRiskWeightedCounts[pestRiskLabel] ?? 0) + 1;
    bucket.pestRiskScoreTotal += PEST_RISK_SCORES[pestRiskLabel] ?? 0.28;
  }

  const timestamps = [...byTimestamp.keys()].sort();
  const locations = [...new Set(rows.map((row) => row.location).filter(Boolean))].sort();

  const snapshotsByTimestamp: Record<string, PredictionLocationSnapshot[]> = {};
  const timeline: PredictionTimelinePoint[] = [];
  const locationTrends: Record<string, PredictionLocationTrendPoint[]> = {};

  for (const location of locations) {
    locationTrends[location] = [];
  }

  for (const timestamp of timestamps) {
    const locationSnapshots = [...(byTimestamp.get(timestamp)?.values() ?? [])]
      .map(toSnapshot)
      .sort((a, b) => b.pestRiskScore - a.pestRiskScore);

    snapshotsByTimestamp[timestamp] = locationSnapshots;

    const avgRisk =
      locationSnapshots.reduce((sum, snapshot) => sum + snapshot.pestRiskScore, 0) /
      Math.max(locationSnapshots.length, 1);

    timeline.push({
      anomalyCount: locationSnapshots.reduce((sum, snapshot) => sum + snapshot.anomalyCount, 0),
      avgRisk,
      hotspotCount: locationSnapshots.filter((snapshot) => snapshot.pestRiskScore >= 0.55).length,
      timestamp,
    });

    for (const snapshot of locationSnapshots) {
      locationTrends[snapshot.location].push({
        anomalyRate: snapshot.anomalyRate,
        pestRiskScore: snapshot.pestRiskScore,
        timestamp,
      });
    }
  }

  const latestTimestamp = timestamps[timestamps.length - 1] ?? "";
  const latestSnapshots = snapshotsByTimestamp[latestTimestamp] ?? [];

  return {
    locationLayouts: LOCATION_LAYOUTS,
    locationTrends,
    locations,
    snapshotsByTimestamp,
    summary: {
      avgRisk:
        latestSnapshots.reduce((sum, snapshot) => sum + snapshot.pestRiskScore, 0) /
        Math.max(latestSnapshots.length, 1),
      latestTimestamp,
      locationCount: locations.length,
      mediumRiskLocations: latestSnapshots.filter((snapshot) => snapshot.pestRiskLabel === "Medium")
        .length,
      timeRangeEnd: timestamps[timestamps.length - 1] ?? "",
      timeRangeStart: timestamps[0] ?? "",
      totalRows: rows.length,
    },
    timeline,
    timestamps,
  };
}

function parseCsv(csv: string) {
  const lines = csv.trim().split(/\r?\n/);
  const headers = splitCsvLine(lines[0] ?? "");

  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return headers.reduce<Record<string, string>>((record, header, index) => {
      record[header] = values[index] ?? "";
      return record;
    }, {});
  });
}

function splitCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === "\"") {
      if (inQuotes && line[index + 1] === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current);
  return values;
}

function toSnapshot(bucket: AggregateBucket): PredictionLocationSnapshot {
  const sampleCount = bucket.rowCount;

  return {
    anomalyCount: bucket.anomalyCount,
    anomalyRate: bucket.anomalyCount / Math.max(sampleCount, 1),
    avgHumidity: bucket.humidityTotal / Math.max(sampleCount, 1),
    avgLightIntensity: bucket.lightTotal / Math.max(sampleCount, 1),
    avgRainfall: bucket.rainfallTotal / Math.max(sampleCount, 1),
    avgSoilMoisture: bucket.soilMoistureTotal / Math.max(sampleCount, 1),
    avgTemperature: bucket.temperatureTotal / Math.max(sampleCount, 1),
    avgYield: bucket.yieldTotal / Math.max(sampleCount, 1),
    deviceCount: bucket.deviceIds.size,
    dominantCrop: topLabel(bucket.cropCounts),
    irrigationRate: bucket.irrigationCount / Math.max(sampleCount, 1),
    location: bucket.location,
    pestRiskLabel: topLabel(bucket.pestRiskWeightedCounts),
    pestRiskScore: bucket.pestRiskScoreTotal / Math.max(sampleCount, 1),
    sampleCount,
    season: topLabel(bucket.seasonCounts),
  };
}

function topLabel(counts: Record<string, number>) {
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Unknown";
}

function toNumber(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
