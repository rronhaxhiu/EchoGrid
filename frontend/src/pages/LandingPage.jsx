import { AboutSection } from "@/components/landing/AboutSection";
import { CTASection } from "@/components/landing/CTASection";
import { FeatureSection } from "@/components/landing/FeatureSection";
import { HeroSection } from "@/components/landing/HeroSection";
import { StatsSection } from "@/components/landing/StatsSection";
import { VisualShowcase } from "@/components/landing/VisualShowcase";
import { Footer } from "@/components/layout/Footer";
import { StickyNavbar } from "@/components/layout/StickyNavbar";

export function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-white text-slate-950 transition-colors duration-500 dark:bg-[#02050c] dark:text-white">
      <StickyNavbar />
      <HeroSection />
      <AboutSection />
      <FeatureSection />
      <VisualShowcase />
      <StatsSection />
      <CTASection />
      <Footer />
    </main>
  );
}
