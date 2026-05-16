export interface PredictionLocationLayout {
  accent: string;
  x: number;
  y: number;
}

export interface PredictionLocationSnapshot {
  anomalyCount: number;
  anomalyRate: number;
  avgHumidity: number;
  avgLightIntensity: number;
  avgRainfall: number;
  avgSoilMoisture: number;
  avgTemperature: number;
  avgYield: number;
  deviceCount: number;
  dominantCrop: string;
  irrigationRate: number;
  location: string;
  pestRiskLabel: string;
  pestRiskScore: number;
  sampleCount: number;
  season: string;
}

export interface PredictionTimelinePoint {
  anomalyCount: number;
  avgRisk: number;
  hotspotCount: number;
  timestamp: string;
}

export interface PredictionLocationTrendPoint {
  anomalyRate: number;
  pestRiskScore: number;
  timestamp: string;
}

export interface PredictionSummary {
  avgRisk: number;
  latestTimestamp: string;
  locationCount: number;
  mediumRiskLocations: number;
  timeRangeEnd: string;
  timeRangeStart: string;
  totalRows: number;
}

export interface PredictionDashboardData {
  locationLayouts: Record<string, PredictionLocationLayout>;
  locationTrends: Record<string, PredictionLocationTrendPoint[]>;
  locations: string[];
  snapshotsByTimestamp: Record<string, PredictionLocationSnapshot[]>;
  summary: PredictionSummary;
  timeline: PredictionTimelinePoint[];
  timestamps: string[];
}
