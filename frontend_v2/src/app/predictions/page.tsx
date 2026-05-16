import { PredictionsDashboard } from "@/components/predictions/PredictionsDashboard";
import { getPredictionDashboardData } from "@/lib/predictions";

export default async function PredictionsPage() {
  const data = await getPredictionDashboardData();

  return <PredictionsDashboard data={data} />;
}
