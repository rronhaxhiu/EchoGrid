import {
  Activity,
  Archive,
  BarChart3,
  Droplets,
  Globe2,
  History,
  Leaf,
  LineChart,
  Network,
  Rocket,
  SlidersHorizontal,
  Thermometer,
  Users,
  Wind,
  Zap,
} from "lucide-react";

const icons = {
  activity: Activity,
  archive: Archive,
  barChart: BarChart3,
  droplets: Droplets,
  globe: Globe2,
  history: History,
  leaf: Leaf,
  lineChart: LineChart,
  network: Network,
  rocket: Rocket,
  sliders: SlidersHorizontal,
  thermometer: Thermometer,
  users: Users,
  wind: Wind,
  zap: Zap,
};

export function LandingIcon({ name, className, strokeWidth = 1.8 }) {
  const Icon = icons[name] || Activity;

  return <Icon aria-hidden="true" className={className} strokeWidth={strokeWidth} />;
}
