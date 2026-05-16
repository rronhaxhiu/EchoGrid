import { FeatureCard } from "@/components/landing/FeatureCard";
import { SectionContainer } from "@/components/landing/SectionContainer";
import { featureRows } from "@/data/landingContent";

export function FeatureSection() {
  return (
    <SectionContainer
      className="bg-slate-50 dark:bg-[#040914]"
      description="Each feature block is structured for later replacement with live API data, timeline state, and region-aware rendering controls."
      eyebrow="Features"
      id="features"
      title="Simulation tools built around the planet."
    >
      <div className="mt-14 grid gap-5">
        {featureRows.map((feature, index) => (
          <FeatureCard feature={feature} index={index} key={feature.title} />
        ))}
      </div>
    </SectionContainer>
  );
}
